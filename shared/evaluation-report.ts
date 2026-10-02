export interface LiveResult {
  id: string;
  runId: string;
  split: string;
  expected: string;
  actual: string | null;
  status: string;
  passed: boolean;
  provider: (string | null)[];
  attempts: number;
  cost: number | null;
  latencyMs: number | null;
  error: string | null;
}
export interface LiveReport {
  kind: "live-agent-evaluation";
  startedAt: string;
  generatedAt: string;
  dataset: string;
  datasetHash: string;
  prompt: string;
  model: string;
  requested: number;
  total: number;
  passed: number;
  split: {
    development: { total: number; passed: number };
    holdout: { total: number; passed: number };
  };
  humanReview: boolean;
  results: LiveResult[];
}
