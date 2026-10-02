import type { Metrics } from "../shared/metrics";
export type Bootstrap = {
  scenarios: { id: string; title: string; description: string; tag: string }[];
  mode: "live" | "fixture";
  model: string;
  configured: boolean;
  dataset: string;
  prompt: string;
};

export type MetricResponse = {
  metrics: Metrics;
  scope: {
    days: number;
    mode: string;
    sampled: number;
    total: number;
    truncated: boolean;
  };
  updatedAt: number;
};

export type EvalReport = {
  generatedAt: string;
  dataset: string;
  total: number;
  passed: number;
  split: {
    development: { total: number; passed: number };
    holdout: { total: number; passed: number };
  };
  results: {
    id: string;
    split: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
};

export type SystemData = {
  budget: {
    daily: number;
    monthly: number;
    evaluation: number;
    limits: { daily: number; monthly: number; evaluation: number };
  };
  vitals: { name: string; value: number }[];
  model: string;
  configured: boolean;
  mode: string;
  dataset: string;
  retentionDays: number;
};
