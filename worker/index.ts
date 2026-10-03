import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Env } from "./env";
import {
  DATASET_VERSION,
  PROMPT_VERSION,
  eligibleOptions,
  optionIds,
  publicScenarios,
  scenarios,
  type ServiceCase,
} from "../shared/domain";
import type { ApprovalRow, CallRow, EventRow, RunRow } from "../shared/types";
import { publicRun } from "../shared/types";
import { buildMetrics } from "../shared/metrics";
import { guardCall } from "./store";
export { CaseWorkflow } from "./workflow";
export { BudgetGuard } from "./guard";
const app = new Hono<{ Bindings: Env; Variables: { sid: string } }>();
const errors: Record<string, string> = {
  RATE_LIMITED: "Bu demo için günlük çalışma sınırına ulaşıldı.",
  BUDGET_EXCEEDED:
    "Model kullanım bütçesine ulaşıldı. Tamamlanan vakaları inceleyebilirsiniz.",
  MODEL_NOT_CONFIGURED: "Canlı model henüz yapılandırılmadı.",
  STALE_PLAN: "Plan değişti. Güncel öneriyi inceleyip tekrar onaylayın.",
};
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 4096,
    onError: (c) => c.json({ error: "İstek çok büyük." }, 413),
  }),
);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "same-origin");
  if (!["GET", "HEAD"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    const allowed =
      origin === new URL(c.req.url).origin ||
      (c.env.ENVIRONMENT === "development" &&
        /^http:\/\/(localhost|127\.0\.0\.1):(5174|8788)$/.test(origin ?? ""));
    // Evaluation requests additionally require a secret bearer token; public requests require same-origin JSON.
    const evaluation = Boolean(
      c.env.EVALUATION_TOKEN &&
      c.req.header("authorization") === `Bearer ${c.env.EVALUATION_TOKEN}`,
    );
    if (
      (!allowed && !evaluation) ||
      !c.req.header("content-type")?.startsWith("application/json")
    )
      return c.json({ error: "İstek kaynağı doğrulanamadı." }, 403);
  }
  await next();
});
app.get("/api/health", (c) =>
  c.json({ ok: true, service: "serviceops", dataset: DATASET_VERSION }),
);
app.use("/api/*", async (c, next) => {
  let sid = getCookie(c, "serviceops_session");
  let existing =
    sid && /^[a-f0-9]{64}$/.test(sid)
      ? await c.env.DB.prepare(
          "SELECT id FROM sessions WHERE id=? AND expires_at>?",
        )
          .bind(sid, Date.now())
          .first()
      : null;
  if (!existing) {
    if (c.req.path !== "/api/bootstrap")
      return c.json({ error: "Oturum süresi doldu. Sayfayı yenileyin." }, 401);
    sid = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await c.env.DB.prepare(
      "INSERT INTO sessions(id,created_at,expires_at) VALUES(?,?,?)",
    )
      .bind(sid, Date.now(), Date.now() + 7 * 86400000)
      .run();
    setCookie(c, "serviceops_session", sid, {
      httpOnly: true,
      secure: c.env.ENVIRONMENT === "production",
      sameSite: "Strict",
      path: "/",
      maxAge: 604800,
    });
  }
  c.set("sid", sid!);
  await next();
});
app.get("/api/bootstrap", async (c) =>
  c.json({
    scenarios: publicScenarios.map(({ data, ...s }) => s),
    mode: c.env.MODEL_MODE === "live" ? "live" : "fixture",
    model: c.env.OPENROUTER_MODEL,
    configured: Boolean(c.env.OPENROUTER_API_KEY),
    dataset: DATASET_VERSION,
    prompt: PROMPT_VERSION,
    environment: c.env.ENVIRONMENT,
  }),
);
app.get("/api/runs", async (c) => {
  const offset = Math.max(0, Math.min(500, Number(c.req.query("offset")) || 0));
  const result = await c.env.DB.prepare(
    "SELECT * FROM runs WHERE session_id=? AND source='visitor' ORDER BY created_at DESC LIMIT 21 OFFSET ?",
  )
    .bind(c.get("sid"), offset)
    .all<RunRow>();
  return c.json({
    runs: result.results.slice(0, 20).map(publicRun),
    hasMore: result.results.length > 20,
  });
});
app.post("/api/runs", async (c) => {
  const input = z
    .object({
      scenarioId: z.string().max(60),
      requestId: z.string().uuid(),
      source: z.enum(["visitor", "evaluation"]).default("visitor"),
    })
    .strict()
    .parse(await c.req.json());
  const isEval = input.source === "evaluation";
  if (
    isEval &&
    (!c.env.EVALUATION_TOKEN ||
      c.req.header("authorization") !== `Bearer ${c.env.EVALUATION_TOKEN}`)
  )
    return c.json({ error: "Değerlendirme yetkisi gerekiyor." }, 403);
  const scenario = (isEval ? scenarios : publicScenarios).find(
    (s) => s.id === input.scenarioId,
  );
  if (!scenario) return c.json({ error: "Senaryo bulunamadı." }, 404);
  const previous = await c.env.DB.prepare(
    "SELECT id,session_id,status FROM runs WHERE id=?",
  )
    .bind(input.requestId)
    .first<{ id: string; session_id: string; status: string }>();
  if (previous && previous.session_id !== c.get("sid"))
    return c.json({ error: "Çalışma bulunamadı." }, 404);
  if (!previous) {
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `serviceops:${new Date().toISOString().slice(0, 10)}:${ip}`,
      ),
    );
    await guardCall(c.env, "/admit", {
      session: c.get("sid"),
      ip: Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      source: input.source,
    });
    const mode = c.env.MODEL_MODE === "live" ? "live" : "fixture";
    if (mode === "live" && !c.env.OPENROUTER_API_KEY)
      return c.json({ error: errors.MODEL_NOT_CONFIGURED }, 503);
    if (c.env.ENVIRONMENT === "production" && mode !== "live")
      return c.json({ error: "Canlı demo yapılandırması tamamlanmadı." }, 503);
    const now = Date.now();
    await c.env.DB.prepare(
      "INSERT INTO runs(id,session_id,scenario_id,title,status,mode,source,case_json,created_at,updated_at,model,prompt_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        input.requestId,
        c.get("sid"),
        scenario.id,
        scenario.title,
        "queued",
        mode,
        input.source,
        JSON.stringify(scenario.data),
        now,
        now,
        mode === "live" ? c.env.OPENROUTER_MODEL : "fixture-provider",
        PROMPT_VERSION,
      )
      .run();
  }
  try {
    await c.env.CASES.create({
      id: input.requestId,
      params: { runId: input.requestId },
    });
  } catch {
    const instance = await c.env.CASES.get(input.requestId);
    const status = await instance.status();
    if (!status) throw new Error("WORKFLOW_START_FAILED");
  }
  return c.json({ id: input.requestId }, 202);
});
app.get("/api/runs/:id", async (c) => {
  const run = await c.env.DB.prepare(
    "SELECT * FROM runs WHERE id=? AND session_id=?",
  )
    .bind(c.req.param("id"), c.get("sid"))
    .first<RunRow>();
  if (!run) return c.json({ error: "Vaka bulunamadı." }, 404);
  const [events, calls, approvals, reservation] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM events WHERE run_id=? ORDER BY created_at,id",
    )
      .bind(run.id)
      .all<EventRow>(),
    c.env.DB.prepare(
      "SELECT * FROM model_calls WHERE run_id=? ORDER BY created_at",
    )
      .bind(run.id)
      .all<CallRow>(),
    c.env.DB.prepare(
      "SELECT * FROM approvals WHERE run_id=? ORDER BY plan_version",
    )
      .bind(run.id)
      .all<ApprovalRow>(),
    c.env.DB.prepare(
      "SELECT id,option_id,verified FROM reservations WHERE run_id=?",
    )
      .bind(run.id)
      .first(),
  ]);
  const data = JSON.parse(run.case_json) as ServiceCase;
  return c.json({
    run: publicRun(run),
    data,
    plan: run.plan_json ? JSON.parse(run.plan_json) : null,
    events: events.results,
    calls: calls.results,
    approvals: approvals.results,
    reservation,
    options: eligibleOptions(data),
  });
});
app.get("/api/runs/:id/runtime", async (c) => {
  const owned = await c.env.DB.prepare(
    "SELECT id FROM runs WHERE id=? AND session_id=?",
  )
    .bind(c.req.param("id"), c.get("sid"))
    .first<{ id: string }>();
  if (!owned) return c.json({ error: "Vaka bulunamadı." }, 404);
  const instance = await c.env.CASES.get(owned.id);
  const runtime = await instance.status();
  return c.json({ status: runtime.status, error: runtime.error?.name ?? null });
});
app.post("/api/runs/:id/approval", async (c) => {
  const input = z
    .object({
      version: z.number().int().positive(),
      decision: z.enum(["approve", "edit", "reject"]),
      optionId: z.enum(optionIds),
      note: z.string().max(500).default(""),
    })
    .strict()
    .parse(await c.req.json());
  const run = await c.env.DB.prepare(
    "SELECT * FROM runs WHERE id=? AND session_id=?",
  )
    .bind(c.req.param("id"), c.get("sid"))
    .first<RunRow>();
  if (!run) return c.json({ error: "Vaka bulunamadı." }, 404);
  const existing = await c.env.DB.prepare(
    "SELECT * FROM approvals WHERE run_id=? AND plan_version=?",
  )
    .bind(run.id, input.version)
    .first<ApprovalRow>();
  if (
    existing &&
    (existing.decision !== input.decision ||
      existing.option_id !== input.optionId ||
      existing.note !== input.note)
  )
    return c.json(
      { error: "Bu plan için farklı bir karar zaten kaydedilmiş." },
      409,
    );
  if (
    run.plan_version !== input.version ||
    (!existing && run.status !== "awaiting_approval")
  )
    return c.json({ error: errors.STALE_PLAN }, 409);
  if (!existing && Date.now() - (run.approval_started_at ?? 0) > 86400000)
    return c.json({ error: "Onay süresi doldu." }, 409);
  const plan = run.plan_json ? JSON.parse(run.plan_json) : null;
  if (
    !existing &&
    input.decision !== "reject" &&
    (!eligibleOptions(JSON.parse(run.case_json)).includes(input.optionId) ||
      (input.decision === "approve" && plan?.optionId !== input.optionId))
  )
    return c.json({ error: "Seçilen işlem geçerli plana uymuyor." }, 409);
  const id = existing?.id ?? crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO approvals(id,run_id,plan_version,decision,option_id,note,created_at) VALUES(?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      run.id,
      input.version,
      input.decision,
      input.optionId,
      input.note,
      Date.now(),
    )
    .run();
  const saved = await c.env.DB.prepare(
    "SELECT * FROM approvals WHERE run_id=? AND plan_version=?",
  )
    .bind(run.id, input.version)
    .first<ApprovalRow>();
  if (
    !saved ||
    saved.decision !== input.decision ||
    saved.option_id !== input.optionId ||
    saved.note !== input.note
  )
    return c.json(
      { error: "Karar başka bir istek tarafından kaydedildi." },
      409,
    );
  if (run.status === "awaiting_approval") {
    const instance = await c.env.CASES.get(run.id);
    await instance.sendEvent({
      type: `approval-v${input.version}`,
      payload: { approvalId: saved.id },
    });
  }
  return c.json({ ok: true, approvalId: saved.id });
});
app.get("/api/metrics", async (c) => {
  const days = c.req.query("days") === "30" ? 30 : 7,
    mode = c.req.query("mode") === "live" ? "live" : "fixture",
    since = Date.now() - days * 86400000;
  const bindings = [c.get("sid"), since, mode];
  const filter =
    "session_id=? AND created_at>=? AND mode=? AND source='visitor'";
  const sub = `SELECT id FROM runs WHERE ${filter} ORDER BY created_at DESC LIMIT 500`;
  const [rows, calls, events, approvals, count] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM runs WHERE ${filter} ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(...bindings)
      .all<RunRow>(),
    c.env.DB.prepare(`SELECT * FROM model_calls WHERE run_id IN (${sub})`)
      .bind(...bindings)
      .all<CallRow>(),
    c.env.DB.prepare(
      `SELECT kind,COUNT(*) AS n FROM events WHERE run_id IN (${sub}) GROUP BY kind`,
    )
      .bind(...bindings)
      .all<{ kind: string; n: number }>(),
    c.env.DB.prepare(`SELECT * FROM approvals WHERE run_id IN (${sub})`)
      .bind(...bindings)
      .all<ApprovalRow>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM runs WHERE ${filter}`)
      .bind(...bindings)
      .first<{ n: number }>(),
  ]);
  return c.json({
    metrics: buildMetrics(
      rows.results,
      calls.results,
      [],
      approvals.results,
      Date.now(),
      Object.fromEntries(events.results.map((e) => [e.kind, e.n])),
    ),
    scope: {
      days,
      mode,
      source: "visitor",
      sessionOnly: true,
      total: count?.n ?? 0,
      sampled: rows.results.length,
      truncated: (count?.n ?? 0) > 500,
    },
    updatedAt: Date.now(),
  });
});
app.get("/api/system", async (c) => {
  const [budget, vitals] = await Promise.all([
    guardCall(c.env, "/status", {}),
    c.env.DB.prepare(
      "SELECT name,value FROM web_vitals WHERE session_id=? AND created_at>? ORDER BY created_at DESC LIMIT 500",
    )
      .bind(c.get("sid"), Date.now() - 7 * 86400000)
      .all(),
  ]);
  return c.json({
    budget,
    vitals: vitals.results,
    model: c.env.OPENROUTER_MODEL,
    configured: Boolean(c.env.OPENROUTER_API_KEY),
    mode: c.env.MODEL_MODE,
    dataset: DATASET_VERSION,
    retentionDays: 30,
  });
});
app.post("/api/vitals", async (c) => {
  const p = z
    .object({
      id: z.string().max(100),
      name: z.enum(["LCP", "INP", "CLS"]),
      value: z.number().min(0).max(3600000),
    })
    .strict()
    .parse(await c.req.json());
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM web_vitals WHERE session_id=? AND created_at>?",
  )
    .bind(c.get("sid"), Date.now() - 86400000)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= 100) return c.json({ ok: true });
  await c.env.DB.prepare(
    "INSERT INTO web_vitals(id,session_id,name,value,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE session_id=excluded.session_id",
  )
    .bind(`${c.get("sid")}:${p.id}`, c.get("sid"), p.name, p.value, Date.now())
    .run();
  return c.json({ ok: true });
});
app.onError((error, c) => {
  if (error instanceof z.ZodError)
    return c.json({ error: "İstek biçimi geçersiz." }, 400);
  const code = error.message;
  return c.json(
    {
      error: errors[code] ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
      code: Object.hasOwn(errors, code) ? code : "INTERNAL_ERROR",
    },
    Object.hasOwn(errors, code) ? 429 : 500,
  );
});
app.notFound((c) => c.json({ error: "Uç nokta bulunamadı." }, 404));
export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    const cutoff = Date.now() - 30 * 86400000;
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM runs WHERE created_at<? AND status IN ('completed','failed','expired','rejected','needs_info','handed_off')",
      ).bind(cutoff),
      env.DB.prepare("DELETE FROM web_vitals WHERE created_at<?").bind(cutoff),
      env.DB.prepare(
        "DELETE FROM sessions WHERE expires_at<? AND id NOT IN(SELECT session_id FROM runs)",
      ).bind(Date.now()),
    ]);
  },
} satisfies ExportedHandler<Env>;
