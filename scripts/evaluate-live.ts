import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  scenarios,
  DATASET_VERSION,
  PROMPT_VERSION,
  terminalStatuses,
} from "../shared/domain";
import { expectedByFamily } from "../shared/oracles";
import type { RunDetail } from "../shared/types";
import type { LiveResult } from "../shared/evaluation-report";
const args = process.argv.slice(2);
const value = (name: string, fallback: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = value("--url", "http://localhost:8788").replace(/\/$/, "");
if (
  !/^https:\/\//.test(base) &&
  !/^http:\/\/(localhost|127\.0\.0\.1):8788$/.test(base)
)
  throw new Error("Use HTTPS for remote evaluation.");
const vars = await readFile(".dev.vars", "utf8").catch(() => "");
const token =
  process.env.EVALUATION_TOKEN ??
  vars.match(/^EVALUATION_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token)
  throw new Error(
    "Set EVALUATION_TOKEN in .dev.vars; do not pass secrets in command arguments.",
  );
let cookie = "";
async function request<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${base}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Authorization: `Bearer ${token}`,
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie")!.split(";")[0];
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(`${r.status}: ${result.error ?? "API error"}`);
  return result;
}
const boot = await request<{
  mode: string;
  configured: boolean;
  model: string;
}>("/bootstrap");
if (boot.mode !== "live" || !boot.configured)
  throw new Error(
    "Live evaluation requires a configured live provider. Fixture results cannot be published as model accuracy.",
  );
const sample = scenarios
  .filter((s) => value("--split", "all") !== "holdout" || s.split === "holdout")
  .slice(0, Math.min(40, Number(value("--limit", "40"))));
const results: LiveResult[] = [];
const startedAt = new Date().toISOString();
for (const s of sample) {
  let firstOption: string | null = null,
    detail: RunDetail | null = null,
    error: string | null = null;
  const id = crypto.randomUUID();
  try {
    await request("/runs", {
      scenarioId: s.id,
      requestId: id,
      source: "evaluation",
    });
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      detail = await request<RunDetail>(`/runs/${id}`);
      if (detail.plan && !firstOption) firstOption = detail.plan.optionId;
      if (terminalStatuses.includes(detail.run.status)) break;
      if (detail.run.status === "awaiting_approval" && detail.plan)
        await request(`/runs/${id}/approval`, {
          version: detail.run.plan_version,
          optionId: detail.plan.optionId,
          decision: "approve",
          note: "Otomatik değerlendirme: sentetik vaka.",
        });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!detail || !terminalStatuses.includes(detail.run.status))
      error = "EVALUATION_TIMEOUT";
  } catch (e) {
    error = (e as Error).message;
  }
  const expected = expectedByFamily[s.id.split("-")[0]],
    calls = detail?.calls ?? [];
  const result = {
    id: s.id,
    runId: id,
    split: s.split,
    expected,
    actual: firstOption,
    status: detail?.run.status ?? "unknown",
    passed: !error && firstOption === expected && detail?.run.verified === 1,
    provider: [...new Set(calls.map((c) => c.provider).filter(Boolean))],
    attempts: calls.length,
    cost:
      calls.length && calls.every((c) => c.cost !== null)
        ? calls.reduce((n, c) => n + c.cost!, 0)
        : null,
    latencyMs: detail?.run.finished_at
      ? detail.run.finished_at - detail.run.created_at
      : null,
    error: error ?? detail?.run.error_code ?? null,
  };
  results.push(result);
  console.log(`${s.id}: ${result.passed ? "PASS" : "FAIL"} (${result.status})`);
  if (error?.includes("429")) break;
}
const group = (split: string) => ({
  total: results.filter((r) => r.split === split).length,
  passed: results.filter((r) => r.split === split && r.passed).length,
});
const report = {
  kind: "live-agent-evaluation",
  startedAt,
  generatedAt: new Date().toISOString(),
  dataset: DATASET_VERSION,
  datasetHash: createHash("sha256")
    .update(JSON.stringify(scenarios))
    .digest("hex"),
  prompt: PROMPT_VERSION,
  model: boot.model,
  requested: sample.length,
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  split: { development: group("development"), holdout: group("holdout") },
  humanReview: false,
  results,
};
await mkdir("reports", { recursive: true });
const file = `reports/live-${Date.now()}.json`;
await writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${report.passed}/${report.total} live cases passed. Report: ${file}. No human-language review claimed.`,
);
if (args.includes("--publish") && report.total === sample.length)
  await writeFile(
    "public/live-evaluation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
if (
  report.total !== sample.length ||
  report.passed / report.total < 0.9 ||
  (report.split.holdout.total > 0 &&
    report.split.holdout.passed / report.split.holdout.total < 0.9)
)
  process.exitCode = 1;
