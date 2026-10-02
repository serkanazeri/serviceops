import type { Proposal, RunStatus, ServiceCase } from "./domain";
export interface RunRow {
  id: string;
  session_id: string;
  scenario_id: string;
  title: string;
  status: RunStatus;
  mode: "live" | "fixture";
  source: "visitor" | "evaluation";
  case_json: string;
  plan_json: string | null;
  plan_version: number;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
  approval_started_at: number | null;
  wait_ms: number;
  verified: number | null;
  error_code: string | null;
  model: string;
  prompt_version: string;
}
export interface EventRow {
  id: string;
  run_id: string;
  kind: string;
  label: string;
  detail_json: string;
  created_at: number;
  duration_ms: number | null;
}
export interface CallRow {
  id: string;
  run_id: string;
  status: string;
  provider: string | null;
  generation_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  duration_ms: number;
  created_at: number;
  error_code: string | null;
}
export interface ApprovalRow {
  id: string;
  run_id: string;
  plan_version: number;
  decision: "approve" | "edit" | "reject";
  option_id: string;
  note: string;
  created_at: number;
}
export type PublicRun = Omit<RunRow, "session_id" | "case_json">;
export function publicRun(row: RunRow): PublicRun {
  const { session_id: _session, case_json: _data, ...visible } = row;
  return visible;
}
export interface RunDetail {
  run: PublicRun;
  data: ServiceCase;
  plan: Proposal | null;
  events: EventRow[];
  calls: CallRow[];
  approvals: ApprovalRow[];
  options: string[];
  reservation: { id: string; option_id: string; verified: number } | null;
}
