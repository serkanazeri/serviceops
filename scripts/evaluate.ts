import { mkdir, writeFile } from "node:fs/promises";
import {
  DATASET_VERSION,
  scenarios,
  fixtureProposal,
  validateProposal,
  executeDecision,
  verifyDecision,
} from "../shared/domain";
import { expectedByFamily } from "../shared/oracles";
const results = scenarios.map((s) => {
  const plan = validateProposal(fixtureProposal(s.data), s.data, [
    "get_case",
    "get_inventory",
    "get_policy",
  ]);
  const expected = expectedByFamily[s.id.split("-")[0]];
  const postcondition =
    ["handoff", "clarify"].includes(plan.optionId) ||
    verifyDecision(
      s.data,
      executeDecision(s.data, plan.optionId),
      plan.optionId,
    );
  return {
    id: s.id,
    split: s.split,
    expected,
    actual: plan.optionId,
    passed: expected === plan.optionId && postcondition,
  };
});
const summary = (split: string) => ({
  total: results.filter((r) => r.split === split).length,
  passed: results.filter((r) => r.split === split && r.passed).length,
});
const report = {
  generatedAt: new Date().toISOString(),
  dataset: DATASET_VERSION,
  kind: "deterministic-policy-contract",
  modelCalls: 0,
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  split: { development: summary("development"), holdout: summary("holdout") },
  results,
};
await mkdir("public", { recursive: true });
await writeFile(
  "public/evaluation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Policy contracts: ${report.passed}/${report.total}; holdout ${report.split.holdout.passed}/${report.split.holdout.total}. This is NOT an LLM evaluation.`,
);
if (report.passed !== report.total) process.exitCode = 1;
