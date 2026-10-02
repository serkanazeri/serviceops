import type { Env } from "./env";
import type { RunRow } from "../shared/types";
export async function getRun(env: Env, id: string) {
  const run = await env.DB.prepare("SELECT * FROM runs WHERE id=?")
    .bind(id)
    .first<RunRow>();
  if (!run) throw new Error("RUN_NOT_FOUND");
  return run;
}
export async function event(
  env: Env,
  runId: string,
  key: string,
  kind: string,
  label: string,
  detail: unknown = {},
  duration: number | null = null,
) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO events(id,run_id,kind,label,detail_json,created_at,duration_ms) VALUES(?,?,?,?,?,?,?)",
  )
    .bind(
      `${runId}:${key}`,
      runId,
      kind,
      label,
      JSON.stringify(detail),
      Date.now(),
      duration,
    )
    .run();
}
export function guard(env: Env) {
  return env.BUDGET.get(env.BUDGET.idFromName("serviceops-global-v1"));
}
export async function guardCall<T>(
  env: Env,
  path: string,
  data: unknown,
): Promise<T> {
  const r = await guard(env).fetch(
    new Request(`https://guard${path}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );
  const body = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(body.error ?? "BUDGET_BLOCKED");
  return body;
}
