import type { OptionId } from "./domain";
// Independent labels, authored before model/prompt tuning. Never sent to the model.
export const expectedByFamily: Record<string, OptionId> = {
  part: "part-local",
  alternate: "part-alternate",
  vehicle: "vehicle",
  missing: "clarify",
  conflict: "handoff",
  unavailable: "handoff",
  changed: "part-local",
  timeout: "part-local",
};
