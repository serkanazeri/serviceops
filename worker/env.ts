import type { CaseWorkflow } from "./workflow";
import type { BudgetGuard } from "./guard";
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CASES: Workflow<{ runId: string }>;
  BUDGET: DurableObjectNamespace<BudgetGuard>;
  OPENROUTER_API_KEY?: string;
  EVALUATION_TOKEN?: string;
  MODEL_MODE: string;
  OPENROUTER_MODEL: string;
  ENVIRONMENT: string;
  DAILY_BUDGET_USD: string;
  MONTHLY_BUDGET_USD: string;
  EVAL_BUDGET_USD: string;
}
export type WorkflowClass = CaseWorkflow;
