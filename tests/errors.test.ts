import { describe, expect, it } from "vitest";
import { blocksEvaluation, workflowErrorCode } from "../shared/errors";

describe("Production Workflow error serialization", () => {
  it("preserves a provider error wrapped by Cloudflare", () => {
    const code = workflowErrorCode(
      new Error("NonRetryableError: PROVIDER_404"),
    );
    expect(code).toBe("PROVIDER_404");
    expect(blocksEvaluation(code)).toBe(true);
  });
  it("accepts serialized errors across runtime boundaries", () => {
    expect(
      workflowErrorCode({
        message: "Error: NonRetryableError: BUDGET_EXCEEDED",
      }),
    ).toBe("BUDGET_EXCEEDED");
    expect(workflowErrorCode(new Error("POSTCONDITION_FAILED"))).toBe(
      "POSTCONDITION_FAILED",
    );
  });
  it("never publishes arbitrary error content", () => {
    for (const error of [
      null,
      {},
      new Error("Provider failure: private details"),
      new Error("A".repeat(81)),
    ])
      expect(workflowErrorCode(error)).toBe("WORKFLOW_ERROR");
  });
  it("stops an evaluation on configuration errors while retaining case failures", () => {
    expect(blocksEvaluation("PROVIDER_400")).toBe(true);
    expect(blocksEvaluation("PROVIDER_402")).toBe(true);
    expect(blocksEvaluation("MAX_AGENT_TURNS")).toBe(false);
    expect(blocksEvaluation(null)).toBe(false);
  });
});
