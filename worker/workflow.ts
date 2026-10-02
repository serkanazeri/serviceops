import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import type { Env } from "./env";
import type { ApprovalRow, RunRow } from "../shared/types";
import {
  eligibleOptions,
  executeDecision,
  fixtureProposal,
  optionLabels,
  readTool,
  validateProposal,
  verifyDecision,
  type OptionId,
  type Proposal,
  type ServiceCase,
} from "../shared/domain";
import { event, getRun } from "./store";
import { modelTurn, systemPrompt, type Message } from "./model";

export class CaseWorkflow extends WorkflowEntrypoint<Env, { runId: string }> {
  async plan(
    run: RunRow,
    data: ServiceCase,
    version: number,
    step: WorkflowStep,
  ): Promise<Proposal> {
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Bu servis vakasını incele ve geçerli politikaya göre çözüm öner.",
      },
    ];
    const observed: string[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const response: Message =
        run.mode === "fixture"
          ? {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: `fixture-${turn}`,
                  type: "function",
                  function:
                    turn < 3
                      ? {
                          name: ["get_case", "get_inventory", "get_policy"][
                            turn
                          ],
                          arguments: "{}",
                        }
                      : {
                          name: "propose_resolution",
                          arguments: JSON.stringify(fixtureProposal(data)),
                        },
                },
              ],
            }
          : await step.do(
              `v${version}-model-${turn}`,
              {
                retries: {
                  limit: 1,
                  delay: "3 seconds",
                  backoff: "exponential",
                },
                timeout: "60 seconds",
              },
              () => modelTurn(this.env, run, messages),
            );
      messages.push(response);
      for (const [index, call] of (response.tool_calls ?? []).entries()) {
        const name = call.function.name;
        const key = `v${version}-tool-${turn}-${index}`;
        const outcome = await step.do(
          key,
          { retries: { limit: 1, delay: "1 second" }, timeout: "10 seconds" },
          async () => {
            const start = Date.now();
            if (data.fault === "tool-timeout" && name === "get_inventory") {
              const faultId = `${run.id}:injected-timeout`;
              const fault = await this.env.DB.prepare(
                "SELECT id FROM events WHERE id=?",
              )
                .bind(faultId)
                .first();
              if (!fault) {
                await event(
                  this.env,
                  run.id,
                  "injected-timeout",
                  "tool_error",
                  "Stok servisi zaman aşımı · tekrar denenecek",
                  { tool: name, injected: true },
                  1000,
                );
                throw new Error("SIMULATED_TOOL_TIMEOUT");
              }
            }
            try {
              const args = JSON.parse(call.function.arguments);
              const result =
                name === "propose_resolution"
                  ? validateProposal(args, data, observed)
                  : readTool(name, args, data);
              await event(
                this.env,
                run.id,
                key,
                "tool_success",
                name === "propose_resolution"
                  ? "Çözüm önerisi doğrulandı"
                  : (
                      {
                        get_case: "Servis kaydı incelendi",
                        get_inventory: "Stoklar kontrol edildi",
                        get_policy: "Servis politikası incelendi",
                      } as Record<string, string>
                    )[name],
                { tool: name, arguments: args, result, mode: run.mode },
                Date.now() - start,
              );
              return { ok: true, resultJson: JSON.stringify(result) };
            } catch (error) {
              const code =
                error instanceof Error ? error.message : "INVALID_TOOL";
              await event(
                this.env,
                run.id,
                key,
                "policy_block",
                "Geçersiz araç isteği engellendi",
                { tool: name, code: code.slice(0, 160) },
              );
              return {
                ok: false,
                resultJson: JSON.stringify({
                  error:
                    "Araç veya öneri geçersiz. Üç kaynağı incele, politika ve şemaya uy.",
                }),
              };
            }
          },
        );
        if (outcome.ok && name === "propose_resolution")
          return JSON.parse(outcome.resultJson) as Proposal;
        if (outcome.ok) observed.push(name);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: outcome.resultJson,
        });
      }
    }
    throw new NonRetryableError("MAX_AGENT_TURNS");
  }

  async run(
    workflowEvent: WorkflowEvent<{ runId: string }>,
    step: WorkflowStep,
  ) {
    const runId = workflowEvent.payload.runId;
    try {
      const run = await step.do("start", async () => {
        const row = await getRun(this.env, runId);
        await this.env.DB.prepare(
          "UPDATE runs SET status='running',updated_at=? WHERE id=? AND status='queued'",
        )
          .bind(Date.now(), runId)
          .run();
        await event(
          this.env,
          runId,
          "start",
          "started",
          row.mode === "live"
            ? "Canlı agent çalışmaya başladı"
            : "Yerel test sağlayıcısı çalışmaya başladı",
          { mode: row.mode, model: row.model, prompt: row.prompt_version },
        );
        return row;
      });
      for (let version = 1; version <= 3; version++) {
        const data = await step.do(
          `v${version}-snapshot`,
          async () =>
            JSON.parse(
              (await getRun(this.env, runId)).case_json,
            ) as ServiceCase,
        );
        const plan = await this.plan(run, data, version, step);
        if (["handoff", "clarify"].includes(plan.optionId)) {
          await step.do(`v${version}-handoff`, async () => {
            const now = Date.now();
            await this.env.DB.prepare(
              "UPDATE runs SET status=?,plan_json=?,plan_version=?,verified=?,finished_at=?,updated_at=? WHERE id=?",
            )
              .bind(
                plan.optionId === "clarify" ? "needs_info" : "handed_off",
                JSON.stringify(plan),
                version,
                Number(eligibleOptions(data)[0] === plan.optionId),
                now,
                now,
                runId,
              )
              .run();
            await event(
              this.env,
              runId,
              `v${version}-handoff`,
              "verified",
              optionLabels[plan.optionId],
              { policyChecked: true, sideEffect: false },
            );
          });
          return { status: plan.optionId };
        }
        await step.do(`v${version}-publish-plan`, async () => {
          const now = Date.now();
          await this.env.DB.prepare(
            "UPDATE runs SET status='awaiting_approval',plan_json=?,plan_version=?,approval_started_at=?,updated_at=? WHERE id=? AND plan_version<?",
          )
            .bind(JSON.stringify(plan), version, now, now, runId, version)
            .run();
          await event(
            this.env,
            runId,
            `v${version}-approval`,
            "approval_wait",
            "İşlem için onayınız bekleniyor",
            { version, optionId: plan.optionId },
          );
        });
        let approvalEvent;
        try {
          approvalEvent = await step.waitForEvent<{ approvalId: string }>(
            `v${version}-approval-event`,
            { type: `approval-v${version}`, timeout: "24 hours" },
          );
        } catch {
          await step.do(`v${version}-expire`, async () => {
            const now = Date.now();
            await this.env.DB.prepare(
              "UPDATE runs SET status='expired',wait_ms=wait_ms+MAX(0,?-approval_started_at),approval_started_at=NULL,finished_at=?,updated_at=? WHERE id=? AND status='awaiting_approval'",
            )
              .bind(now, now, now, runId)
              .run();
            await event(
              this.env,
              runId,
              `v${version}-expired`,
              "expired",
              "24 saat içinde onay verilmedi; işlem yapılmadı",
            );
          });
          return { status: "expired" };
        }
        const approval = await step.do(
          `v${version}-read-approval`,
          async () => {
            const a = await this.env.DB.prepare(
              "SELECT * FROM approvals WHERE id=? AND run_id=? AND plan_version=?",
            )
              .bind(approvalEvent.payload.approvalId, runId, version)
              .first<ApprovalRow>();
            if (!a) throw new NonRetryableError("APPROVAL_INVALID");
            await this.env.DB.prepare(
              "UPDATE runs SET wait_ms=wait_ms+MAX(0,?-approval_started_at),approval_started_at=NULL,updated_at=? WHERE id=? AND plan_version=? AND approval_started_at IS NOT NULL",
            )
              .bind(a.created_at, Date.now(), runId, version)
              .run();
            await event(
              this.env,
              runId,
              `v${version}-decision`,
              "approval_decision",
              a.decision === "reject"
                ? "Öneri reddedildi"
                : a.decision === "edit"
                  ? "Öneri düzenlenerek onaylandı"
                  : "Öneri onaylandı",
              { decision: a.decision, optionId: a.option_id, note: a.note },
            );
            return a;
          },
        );
        if (approval.decision === "reject") {
          await step.do(`v${version}-reject`, async () => {
            const now = Date.now();
            await this.env.DB.prepare(
              "UPDATE runs SET status='rejected',finished_at=?,updated_at=? WHERE id=?",
            )
              .bind(now, now, runId)
              .run();
          });
          return { status: "rejected" };
        }
        const current = await step.do(`v${version}-revalidate`, async () => {
          const fresh = JSON.parse(
            (await getRun(this.env, runId)).case_json,
          ) as ServiceCase;
          if (fresh.fault === "stock-change" && version === 1) {
            fresh.partStock = 0;
            fresh.version++;
            await this.env.DB.prepare(
              "UPDATE runs SET case_json=?,status='running',updated_at=? WHERE id=? AND case_json=?",
            )
              .bind(
                JSON.stringify(fresh),
                Date.now(),
                runId,
                JSON.stringify(data),
              )
              .run();
            await event(
              this.env,
              runId,
              "stock-change",
              "replan",
              "Stok değişti; eski onay kullanılmadan yeni plan hazırlanıyor",
              { previousVersion: data.version, currentVersion: fresh.version },
            );
          }
          return JSON.parse(
            (await getRun(this.env, runId)).case_json,
          ) as ServiceCase;
        });
        if (
          current.version !== data.version ||
          !eligibleOptions(current).includes(approval.option_id as OptionId)
        )
          continue;
        await step.do(
          `v${version}-execute`,
          { retries: { limit: 2, delay: "1 second" } },
          async () => {
            const existing = await this.env.DB.prepare(
              "SELECT id FROM reservations WHERE run_id=?",
            )
              .bind(runId)
              .first();
            if (existing) return { alreadyApplied: true };
            const after = executeDecision(
                current,
                approval.option_id as OptionId,
              ),
              now = Date.now();
            // D1 batch is transactional. The run ID is the business operation's idempotency key.
            await this.env.DB.batch([
              this.env.DB.prepare(
                "INSERT OR IGNORE INTO reservations(id,run_id,option_id,before_json,after_json,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE id=? AND case_json=? AND plan_version=?)",
              ).bind(
                `reservation-${runId}`,
                runId,
                approval.option_id,
                JSON.stringify(current),
                JSON.stringify(after),
                now,
                runId,
                JSON.stringify(current),
                version,
              ),
              this.env.DB.prepare(
                "UPDATE runs SET case_json=?,status='executing',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM reservations WHERE run_id=? AND after_json=?)",
              ).bind(
                JSON.stringify(after),
                now,
                runId,
                runId,
                JSON.stringify(after),
              ),
            ]);
            if (
              !(await this.env.DB.prepare(
                "SELECT id FROM reservations WHERE run_id=?",
              )
                .bind(runId)
                .first())
            )
              throw new NonRetryableError("STALE_PLAN");
            await event(
              this.env,
              runId,
              "execute",
              "action",
              "Rezervasyon kaydı oluşturuldu",
              {
                operationId: `reservation-${runId}`,
                optionId: approval.option_id,
              },
            );
            return { alreadyApplied: false };
          },
        );
        await step.do(`v${version}-verify`, async () => {
          const record = await this.env.DB.prepare(
            "SELECT before_json,after_json,option_id FROM reservations WHERE run_id=?",
          )
            .bind(runId)
            .first<{
              before_json: string;
              after_json: string;
              option_id: OptionId;
            }>();
          const fresh = await getRun(this.env, runId);
          const verified = Boolean(
            record &&
            fresh.case_json === record.after_json &&
            verifyDecision(
              JSON.parse(record.before_json),
              JSON.parse(record.after_json),
              record.option_id,
            ),
          );
          if (!verified) throw new NonRetryableError("POSTCONDITION_FAILED");
          const now = Date.now();
          await this.env.DB.batch([
            this.env.DB.prepare(
              "UPDATE reservations SET verified=1 WHERE run_id=?",
            ).bind(runId),
            this.env.DB.prepare(
              "UPDATE runs SET status='completed',verified=1,finished_at=?,updated_at=? WHERE id=?",
            ).bind(now, now, runId),
          ]);
          await event(
            this.env,
            runId,
            "verify",
            "verified",
            "Sonuç kaynaktan yeniden okunarak doğrulandı",
            { stockDelta: -1, reservationCount: 1, operationVerified: true },
          );
        });
        return { status: "completed" };
      }
      throw new NonRetryableError("REPLAN_LIMIT");
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
          ? error.message
          : "WORKFLOW_ERROR";
      await step.do("record-failure", async () => {
        const now = Date.now();
        await this.env.DB.prepare(
          "UPDATE runs SET status='failed',error_code=?,finished_at=?,updated_at=? WHERE id=? AND status NOT IN ('completed','rejected','expired','handed_off','needs_info')",
        )
          .bind(code, now, now, runId)
          .run();
        await event(
          this.env,
          runId,
          "failed",
          "failed",
          "Akış güvenli biçimde durduruldu",
          { code },
        );
      });
      throw error;
    }
  }
}
