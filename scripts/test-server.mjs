import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

// Every test run gets an isolated database, Workflow state, budget and empty secrets.
const directory = resolve(".wrangler/e2e", randomUUID());
await mkdir(directory, { recursive: true });
const config = resolve(directory, "wrangler.json");
await writeFile(
  config,
  JSON.stringify({
    name: "serviceops-e2e",
    main: resolve("worker/index.ts"),
    compatibility_date: "2026-10-02",
    compatibility_flags: ["nodejs_compat"],
    assets: {
      directory: resolve("dist"),
      binding: "ASSETS",
      not_found_handling: "single-page-application",
      run_worker_first: ["/api/*"],
    },
    vars: {
      ENVIRONMENT: "development",
      MODEL_MODE: "fixture",
      OPENROUTER_MODEL: "openai/gpt-6-luna",
      DAILY_BUDGET_USD: "1",
      MONTHLY_BUDGET_USD: "10",
      EVAL_BUDGET_USD: "5",
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: "serviceops-e2e",
        database_id: "00000000-0000-0000-0000-000000000001",
        migrations_dir: resolve("migrations"),
      },
    ],
    workflows: [
      {
        name: "serviceops-e2e-cases",
        binding: "CASES",
        class_name: "CaseWorkflow",
      },
    ],
    durable_objects: {
      bindings: [{ name: "BUDGET", class_name: "BudgetGuard" }],
    },
    migrations: [{ tag: "v1", new_sqlite_classes: ["BudgetGuard"] }],
  }),
);
await writeFile(
  resolve(directory, ".dev.vars"),
  "MODEL_MODE=fixture\nOPENROUTER_API_KEY=\nEVALUATION_TOKEN=\n",
);
const environment = {
  ...process.env,
  OPENROUTER_API_KEY: "",
  MODEL_MODE: "fixture",
  WRANGLER_LOG_PATH: resolve(directory, "wrangler.log"),
  WRANGLER_SEND_METRICS: "false",
};
const binary = resolve("node_modules/wrangler/bin/wrangler.js"),
  persist = resolve(directory, "state");
const migrate = spawnSync(
  process.execPath,
  [
    binary,
    "d1",
    "migrations",
    "apply",
    "serviceops-e2e",
    "--local",
    "--config",
    config,
    "--persist-to",
    persist,
  ],
  { stdio: "inherit", env: environment },
);
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const server = spawn(
  process.execPath,
  [
    binary,
    "dev",
    "--config",
    config,
    "--persist-to",
    persist,
    "--port",
    "8790",
  ],
  { stdio: "inherit", env: environment },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill(signal));
server.on("exit", async (code) => {
  await rm(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
