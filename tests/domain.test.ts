import { describe, expect, it } from "vitest";
import {
  eligibleOptions,
  executeDecision,
  fixtureProposal,
  readTool,
  scenarios,
  validateProposal,
  verifyDecision,
} from "../shared/domain";
import { expectedByFamily } from "../shared/oracles";
const observed = ["get_case", "get_inventory", "get_policy"];
describe("Independent scenario labels", () => {
  it.each(scenarios)(
    "$id produces the independently labelled safe outcome",
    (s) => {
      const p = validateProposal(fixtureProposal(s.data), s.data, observed);
      expect(p.optionId).toBe(expectedByFamily[s.id.split("-")[0]]);
    },
  );
});
describe("Authority and evidence boundaries", () => {
  const data = scenarios[0].data;
  it("cannot propose before all sources were read", () =>
    expect(() =>
      validateProposal(fixtureProposal(data), data, ["get_case"]),
    ).toThrow("EVIDENCE_MISSING"));
  it("does not accept duplicate citations as three sources", () =>
    expect(() =>
      validateProposal(
        { ...fixtureProposal(data), evidenceIds: ["case", "case", "policy"] },
        data,
        observed,
      ),
    ).toThrow("EVIDENCE_MISSING"));
  it("blocks vehicle reservation outside warranty", () =>
    expect(() =>
      validateProposal(
        { ...fixtureProposal(data), optionId: "vehicle" },
        { ...data, warranty: false },
        observed,
      ),
    ).toThrow("POLICY_BLOCKED"));
  it("blocks vehicle reservation before delay threshold", () =>
    expect(eligibleOptions({ ...data, partStock: 0, delayDays: 2 })).toEqual([
      "handoff",
    ]));
  it("checks missing identity before stock or warranty", () =>
    expect(eligibleOptions({ ...data, vin: null })).toEqual(["clarify"]));
  it("blocks writes based on conflicting policy", () =>
    expect(() =>
      executeDecision({ ...data, policyConflict: true }, "part-local"),
    ).toThrow("STALE_PLAN"));
  it("blocks stale inventory", () =>
    expect(() =>
      executeDecision({ ...data, partStock: 0 }, "part-local"),
    ).toThrow("STALE_PLAN"));
  it("tool arguments cannot select a different case", () =>
    expect(() =>
      readTool("get_case", { caseId: "someone-else" }, data),
    ).toThrow());
  it("unknown tools cannot execute", () =>
    expect(() => readTool("execute_sql", {}, data)).toThrow("UNKNOWN_TOOL"));
  it("postcondition detects a double decrement", () => {
    const after = executeDecision(data, "part-local");
    expect(verifyDecision(data, after, "part-local")).toBe(true);
    expect(
      verifyDecision(
        data,
        { ...after, partStock: after.partStock - 1 },
        "part-local",
      ),
    ).toBe(false);
  });
});
