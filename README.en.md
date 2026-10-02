# ServiceOps

**Evidence-backed service operations with human approval and measurable outcomes.**

[Türkçe](README.md) · [Architecture](docs/architecture.md) · [Metrics](docs/metrics.md) · [Evaluation](docs/evaluation.md)

Built by [Serkan Azeri](https://www.serkanazeri.com/) as a Forward Deployed AI Engineering reference project. ServiceOps handles service-delay cases at fictional Aster Mobility: read the case, inspect inventory and policy, propose a resolution, wait for a human decision, apply an authorized reservation, and verify persisted state.

![Turkish operations dashboard](docs/screenshots/dashboard-desktop.png)

## What this demonstrates

- Translating a business problem into explicit policies and verifiable postconditions.
- A bounded tool-calling agent with typed contracts and evidence requirements.
- Durable execution and human approval that survives closing a browser tab.
- Revalidation when inventory changes, transaction-backed idempotency and read-after-write verification.
- Metrics with documented denominators, sample counts, traffic separation and missing-cost handling.
- Turkish, responsive, installable PWA with an offline shell and online-only actions.

The scenario data is synthetic. Reservations are persisted in isolated demo records. No real customer is contacted. The default local provider is deterministic and visibly labelled; its results are never presented as LLM accuracy.

## Stack and choices

React, TypeScript and Vite provide the UI. Hono runs on Cloudflare Workers; Workflows checkpoints model/tool steps and waits for approval; D1 stores cases, audit events and reservations; a Durable Object serializes global budget reservations. OpenRouter serves the initial model candidate, `openai/gpt-6-luna`. Live task evaluation is required before claiming model quality.

A single bounded agent fits this task. Business policies stay in a pure module, while orchestration accepts Cloudflare coupling. Paperclip and a multi-agent hierarchy would add operational complexity without a demonstrated requirement here. External CRM connectors and enterprise identity are future extensions.

## Run locally

Requires Node.js 22.12+.

```bash
npm ci
cp .env.example .dev.vars
npm run db:local
npm run check
npm run preview
```

Open `http://localhost:8788`. No model key is required in `fixture` mode. This still exercises actual local Workflows and D1. To use a model, set `MODEL_MODE=live` and `OPENROUTER_API_KEY` in `.dev.vars`. Production refuses fixture-mode runs.

## Verification and limits

`npm test` covers domain rules and metric math. `npm run evaluate` checks 40 independently labelled policy cases (24 development, 16 held-out variants), without an LLM call. `npm run test:e2e` verifies approval, duplicates, stock drift, rejection, recovery, session isolation, responsive UI and offline shell behavior.

`npm run evaluate:live -- --url https://YOUR_WORKER.workers.dev --limit 40 --publish` creates a separate live report using an evaluation secret. Reports disclose model/prompt/dataset versions, sample counts, providers, cost coverage and failures. Human language review and manual time savings are not claimed without evidence. Held-out variants share scenario families and are not an independent real-world generalization benchmark.

Default model budgets are $1/day, $10/month and an additional $5 lifetime evaluation ceiling. Unknown-cost attempts retain their reservation. See the Turkish [operations guide](docs/operations.md) for deployment, rollback and retention. The complete rationale and limitations are documented in the primary [README](README.md).

MIT licensed. Live deployment status is recorded in the primary README only after verification.
