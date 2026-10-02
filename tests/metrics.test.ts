import { describe, expect, it } from "vitest";
import { buildMetrics, percentile } from "../shared/metrics";
import type { CallRow, RunRow } from "../shared/types";
const run = (p: Partial<RunRow>): RunRow => ({
  id: "r",
  session_id: "s",
  scenario_id: "part-1",
  title: "test",
  status: "completed",
  mode: "live",
  source: "visitor",
  case_json: "{}",
  plan_json: null,
  plan_version: 1,
  created_at: 0,
  updated_at: 10000,
  finished_at: 10000,
  approval_started_at: null,
  wait_ms: 7000,
  verified: 1,
  error_code: null,
  model: "test",
  prompt_version: "v1",
  ...p,
});
const call = (p: Partial<CallRow>): CallRow => ({
  id: "c",
  run_id: "r",
  status: "success",
  provider: "test",
  generation_id: "g",
  input_tokens: 100,
  output_tokens: 50,
  cost: 0.001,
  duration_ms: 100,
  created_at: 0,
  error_code: null,
  ...p,
});
describe("Metrics are cohort based and honest about missing evidence", () => {
  it("zero samples is unknown, not zero percent", () => {
    const m = buildMetrics([], [], [], []);
    expect(m.verifiedRate).toBe(null);
    expect(m.cost.reported).toBe(null);
    expect(m.latency.activeP50).toBe(null);
  });
  it("separates successful handoff from reservations and pending runs", () => {
    const m = buildMetrics(
      [
        run({}),
        run({ id: "h", status: "handed_off" }),
        run({
          id: "p",
          status: "awaiting_approval",
          verified: null,
          finished_at: null,
        }),
      ],
      [],
      [],
      [],
    );
    expect(m.total).toBe(3);
    expect(m.verifiedRate).toBe(1);
    expect(m.completed).toBe(1);
    expect(m.completionRate).toBe(0.5);
    expect(m.awaiting).toBe(1);
  });
  it("removes human wait from active duration", () => {
    const m = buildMetrics([run({})], [], [], []);
    expect(m.latency.activeP50).toBe(3000);
    expect(m.latency.totalP50).toBe(10000);
    expect(m.latency.waitP50).toBe(7000);
  });
  it("counts failed attempts in cost and blocks incomplete cost per resolution", () => {
    const m = buildMetrics(
      [run({})],
      [
        call({}),
        call({ id: "c2", status: "error", cost: 0.002 }),
        call({ id: "c3", status: "error", cost: null }),
      ],
      [],
      [],
    );
    expect(m.cost.reported).toBeCloseTo(0.003);
    expect(m.cost.coverage).toBeCloseTo(2 / 3);
    expect(m.cost.unknown).toBe(1);
    expect(m.cost.perResolution).toBe(null);
    expect(m.model.errorRate).toBeCloseTo(2 / 3);
  });
  it("does not mutate samples when calculating percentiles", () => {
    const values = [500, 100, 200];
    expect(percentile(values, 0.5)).toBe(200);
    expect(percentile(values, 0.95)).toBe(500);
    expect(values).toEqual([500, 100, 200]);
  });
});
