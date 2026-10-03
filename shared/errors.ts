// Workflows serializes thrown errors and can prefix their original message.
// Keep only a bounded machine code; never expose arbitrary provider error text.
export function workflowErrorCode(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? error.message
      : undefined;
  if (typeof message !== "string") return "WORKFLOW_ERROR";
  const code = message.replace(/^(?:(?:Error|NonRetryableError):\s*)+/, "");
  return /^[A-Z][A-Z_0-9]{0,79}$/.test(code) ? code : "WORKFLOW_ERROR";
}

export function blocksEvaluation(code: string | null): boolean {
  return [
    "PROVIDER_400",
    "PROVIDER_401",
    "PROVIDER_402",
    "PROVIDER_403",
    "PROVIDER_404",
    "MODEL_NOT_CONFIGURED",
    "BUDGET_EXCEEDED",
  ].includes(code ?? "");
}
