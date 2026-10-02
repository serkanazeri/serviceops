import { terminalStatuses } from "./presentation";
import type { ApprovalRow, CallRow, EventRow, RunRow } from "./types";
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(p * ordered.length) - 1)];
}
export function ratio(n: number, d: number) {
  return d ? n / d : null;
}
export function buildMetrics(
  runs: RunRow[],
  calls: CallRow[],
  events: EventRow[],
  approvals: ApprovalRow[],
  now = Date.now(),
  eventCounts?: Record<string, number>,
) {
  const countEvents = (kind: string) =>
    eventCounts
      ? (eventCounts[kind] ?? 0)
      : events.filter((e) => e.kind === kind).length;
  const terminal = runs.filter((r) => terminalStatuses.includes(r.status));
  const judged = runs.filter((r) => r.verified !== null),
    solved = runs.filter((r) => r.status === "completed" && r.verified === 1);
  const finished = runs.filter((r) => r.finished_at !== null),
    active = finished.map((r) =>
      Math.max(0, r.finished_at! - r.created_at - r.wait_ms),
    );
  const total = finished.map((r) => r.finished_at! - r.created_at),
    wait = finished.map((r) => r.wait_ms);
  const reported = calls.filter((c) => c.cost !== null),
    cost = reported.reduce((n, c) => n + c.cost!, 0);
  const successCalls = calls.filter((c) => c.status === "success"),
    errors = calls.filter((c) => c.status === "error");
  const toolOk = countEvents("tool_success"),
    toolError = countEvents("tool_error") + countEvents("policy_block");
  return {
    total: runs.length,
    terminal: terminal.length,
    completed: solved.length,
    evaluated: judged.length,
    verified: judged.filter((r) => r.verified === 1).length,
    verifiedRate: ratio(
      judged.filter((r) => r.verified === 1).length,
      judged.length,
    ),
    completionRate: ratio(solved.length, terminal.length),
    active: runs.filter((r) =>
      ["queued", "running", "executing"].includes(r.status),
    ).length,
    awaiting: runs.filter((r) => r.status === "awaiting_approval").length,
    handedOff: runs.filter((r) => r.status === "handed_off").length,
    needsInfo: runs.filter((r) => r.status === "needs_info").length,
    failed: runs.filter((r) => r.status === "failed").length,
    rejected: runs.filter((r) => r.status === "rejected").length,
    latency: {
      sample: finished.length,
      activeP50: percentile(active, 0.5),
      activeP95: percentile(active, 0.95),
      totalP50: percentile(total, 0.5),
      totalP95: percentile(total, 0.95),
      waitP50: percentile(wait, 0.5),
    },
    approvals: {
      total: approvals.length,
      accepted: approvals.filter((a) => a.decision === "approve").length,
      edited: approvals.filter((a) => a.decision === "edit").length,
      rejected: approvals.filter((a) => a.decision === "reject").length,
    },
    model: {
      attempts: calls.length,
      success: successCalls.length,
      errors: errors.length,
      timeouts: errors.filter((c) => c.error_code === "MODEL_TIMEOUT").length,
      errorRate: ratio(errors.length, calls.length),
      p95: percentile(
        calls.map((c) => c.duration_ms),
        0.95,
      ),
      input: calls.reduce((n, c) => n + (c.input_tokens ?? 0), 0),
      output: calls.reduce((n, c) => n + (c.output_tokens ?? 0), 0),
    },
    cost: {
      reported: reported.length ? cost : null,
      coverage: ratio(reported.length, calls.length),
      unknown: calls.length - reported.length,
      perResolution:
        solved.length && reported.length === calls.length && calls.length
          ? cost / solved.length
          : null,
    },
    tools: {
      attempts: toolOk + toolError,
      errors: toolError,
      successRate: ratio(toolOk, toolOk + toolError),
      policyBlocks: countEvents("policy_block"),
      replans: countEvents("replan"),
    },
    oldestApprovalMs: Math.max(
      0,
      ...runs
        .filter((r) => r.status === "awaiting_approval")
        .map((r) => now - (r.approval_started_at ?? now)),
    ),
    stale: runs.filter(
      (r) =>
        ["queued", "running", "executing"].includes(r.status) &&
        now - r.updated_at > 300000,
    ).length,
    series: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000).toISOString().slice(0, 10);
      const dayRuns = runs.filter((r) =>
        new Date(r.created_at).toISOString().startsWith(d),
      );
      return {
        day: d,
        total: dayRuns.length,
        completed: dayRuns.filter((r) => r.verified === 1).length,
      };
    }),
  };
}
export type Metrics = ReturnType<typeof buildMetrics>;
