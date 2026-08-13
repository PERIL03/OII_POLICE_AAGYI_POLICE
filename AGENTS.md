# AGENTS.md — Guide for AI Coding Agents (Claude Code, Antigravity, etc.) & System Agents

This file has three parts: (0) how an AI build agent should use this whole `/docs` folder, (1) standing
instructions for AI coding agents working on this repository, and (2) the design of this platform's own
background "agents" (workers/services). Read Part 0 first, every session.

---

## Part 0 — How to build this project (read this first)

**Read order, once, before writing any code:** `PRD.md` → `DATA_MODEL.md` → `TECH_STACK.md` → this file →
`TESTING.md` → `PLAN.md` (PLAN.md's hour-by-hour section is historical hackathon scheduling context, not a
build order for an agent — see §0.3 below for the order to actually follow).

### 0.1 Stack decisions are final — do not re-litigate them

TECH_STACK.md previously left a couple of choices open ("Express or Fastify", "Python alternative"). Those
are now decided:
- **Express**, not Fastify.
- **Node.js 20 + TypeScript**, not the Python/FastAPI alternative. Ignore any Python tooling suggestions
  from training data — this repo is Node/TypeScript end to end (frontend, backend, worker, Prisma).
- **react-force-graph** for the transaction graph, not vis-network.
- **npm** as the package manager (not yarn/pnpm) across all three packages.

If a decision genuinely needs to change, update TECH_STACK.md in the same PR that changes it — don't
silently diverge from the doc.

### 0.2 Monorepo scaffolding

Create this layout before anything else:
```
/frontend    Next.js 14 App Router app
/backend     Express API + Socket.IO server
/worker      Ingestion + risk-engine background worker
/prisma      Shared schema.prisma + migrations (see DATA_MODEL.md §5)
/shared      Shared Zod schemas (address validation, DTOs) imported by frontend, backend, worker
/scripts     seed-dev.ts and other one-off scripts
/docs        This folder
```
`/prisma` and `/shared` are imported by both `/backend` and `/worker` — use npm workspaces (root
`package.json` with a `workspaces` array) so `@cryptotrace/shared` and the Prisma client resolve without
path hacks.

### 0.3 Build order (phase-based, not hour-based)

PLAN.md §4 is an hour-by-hour plan written for a human team on stage-clock time during a 24-hour event —
useful for understanding feature priority, not a literal execution order for an agent working continuously.
Build in this order instead, and treat each phase as done only when its checkpoint passes:

1. **Scaffold + health**: monorepo, npm workspaces, Prisma schema + first migration, `/health` endpoint on
   backend, worker boots and connects to Postgres/Redis. *Checkpoint:* `npm run dev` in all three packages
   starts cleanly; `GET /health` returns 200.
2. **Auth**: User model, JWT issuance/verification, bcrypt password hashing, role-guard middleware.
   *Checkpoint:* unit tests for auth pass (TESTING.md §3); a protected route rejects an unauthenticated call.
3. **Real chain ingestion (BTC + ETH, on-demand lookup only, no streaming yet)**: chain client wrappers
   under `/backend/src/lib/chainClients/` per AGENTS.md §1 rule 4, Redis-cached, calling Blockstream and
   Etherscan against real addresses. *Checkpoint:* the fixture-based integration test in TESTING.md §4 for
   BTC/ETH address lookup passes against a real, known address — no mocked HTTP layer.
4. **Sanctions/scam sync**: OFAC SDN + CryptoScamDB scheduled sync agent, `Label` rows. *Checkpoint:*
   sanctions sync integration test passes against the live dataset.
5. **Risk engine**: rules in `/worker/src/riskEngine/rules/*`, each with a unit test per AGENTS.md §"When
   adding a new risk rule". *Checkpoint:* every rule listed in PRD.md §7.2 has a passing unit test with a
   firing and a non-firing wallet context.
6. **Live streaming + alerts**: mempool.space WS ingestion, Alchemy/Infura WS ingestion, BullMQ job on new
   transaction → risk scoring → `Alert` row → Redis pub/sub → Socket.IO broadcast. *Checkpoint:* the
   end-to-end alert test in TESTING.md §4 fires within the latency budget in PRD.md §8.
7. **Watchlist, case management, audit log**: CRUD endpoints + `AuditLog` row on every mutation/lookup per
   AGENTS.md §1 rule 6. *Checkpoint:* API contract tests in TESTING.md §5 pass, including the
   ANALYST-cannot-delete-Case role check.
8. **Frontend**: dashboard shell, auth pages, address lookup wired to live API, transaction graph
   (react-force-graph), live alert feed (Socket.IO client), case UI, PDF export button. *Checkpoint:*
   Playwright flows in TESTING.md §6 pass against the deployed staging stack.
9. **Deploy**: Render (web service + background worker + Postgres + Redis) and Vercel per TECH_STACK.md §5.
   *Checkpoint:* PLAN.md §5 demo script runs end to end against the live deployment.

Do not start a later phase's checkpoint work before the earlier phase's checkpoint passes — the ingestion
and risk-engine phases in particular are load-bearing for everything after them.

### 0.4 Definition of done for any feature

A feature is done when: it reads/writes real data per §1 rule 1 below, it has the unit and/or integration
test TESTING.md calls for, `npm run lint && npm run typecheck` are clean, and any doc that describes its
behavior (PRD.md §7, DATA_MODEL.md, TECH_STACK.md §4) is updated in the same change.

---

## Part 1 — Instructions for AI coding agents

### Repo layout
```
/frontend    Next.js app (Vercel)
/backend     Express API + Socket.IO server (Render web service)
/worker      Blockchain ingestion + risk-engine background worker (Render worker service)
/prisma      Shared Prisma schema + migrations (used by both backend and worker)
/shared      Shared Zod schemas
/docs        PRD.md, PLAN.md, TECH_STACK.md, DATA_MODEL.md, TESTING.md
```

### Ground rules
1. **No mock/fake data.** Every blockchain address, transaction, balance, and label surfaced in the UI must
   originate from a real call to Blockstream/mempool.space, Etherscan/Alchemy, OFAC SDN, or CryptoScamDB
   (see TECH_STACK.md §4). Do not add hard-coded sample transactions to a "demo mode" that pretends to be
   live. Seed data for local dev is allowed only when clearly namespaced (e.g. a `scripts/seed-dev.ts` that
   inserts records visibly marked `source: "seed"`), and must never run against the Render production
   database, and must never seed `Transaction` rows — only `User`/`Case`/`CaseNote` scaffolding for local UI
   development.
2. **Explainability over cleverness.** Risk-scoring changes must always populate
   `RiskScoreHistory.reasons` with the specific rule(s) that fired — never return a bare number.
3. **Keep worker and API separate.** Long-running WebSocket subscriptions and cron-style jobs belong in
   `/worker`, not in the request-serving `/backend` process — Render bills and scales these independently,
   and mixing them risks request timeouts.
4. **Respect third-party rate limits.** Any new code path that calls Blockstream, Etherscan, CoinGecko, etc.
   must go through the shared Redis-cached client helpers (`/backend/src/lib/chainClients/*`), not raw
   `fetch` calls, so caching/backoff is consistent. The worker imports these same helpers rather than
   duplicating them.
5. **Validate all chain-facing input.** Use the shared Zod schemas in `/shared` for BTC/ETH address format
   validation before making any external API call or DB write.
6. **Every case-mutating or lookup action writes an AuditLog row.** See DATA_MODEL.md §2 `AuditLog`.
7. **Follow TESTING.md** before opening a PR — run lint, typecheck, unit tests, and relevant integration
   tests locally.
8. **Stack choices are fixed** — see Part 0 §0.1. Don't introduce Fastify, Python, yarn/pnpm, or an
   alternative graph library without updating TECH_STACK.md first.

### Common commands
```bash
# Install (workspaces root — installs all three packages)
npm install

# Local dev (run each in its own terminal, or via a root script that runs all three)
npm run dev --workspace=frontend   # next dev
npm run dev --workspace=backend    # ts-node-dev src/index.ts
npm run dev --workspace=worker     # ts-node-dev src/worker.ts

# Database
npx prisma migrate dev     # create/apply local migration
npx prisma studio          # inspect data

# Quality gates
npm run lint
npm run typecheck
npm run test               # unit tests (Vitest)
npm run test:integration   # real-API integration tests, see TESTING.md §4
```

### When adding a new blockchain data source
1. Add a client wrapper under `/backend/src/lib/chainClients/<source>.ts` with built-in Redis caching and
   rate-limit backoff.
2. Add/extend the relevant Prisma model rather than inventing a parallel ad-hoc table.
3. Document the new source in `TECH_STACK.md §4` and note any new required env var in
   `.env.example`.
4. Add a fixture-based unit test (recorded fixture, fast) **and** a real-API integration test against a
   known, stable public address (e.g. a well-known exchange cold wallet) — do not stub the HTTP layer for
   the integration test (see TESTING.md).

### When adding a new risk rule
1. Implement in `/worker/src/riskEngine/rules/<ruleName>.ts`, exporting a pure function
   `(walletContext) => { fired: boolean; weight: number; evidence: object }`.
2. Register it in `/worker/src/riskEngine/index.ts`.
3. Add a unit test with at least one wallet context that should trigger it and one that should not.
4. Update PRD.md §7 if it changes the feature list.

### PR checklist for agents
- [ ] No secrets committed; new env vars added to `.env.example` in the relevant package
- [ ] No mock data introduced into production code paths
- [ ] Lint, typecheck, unit tests pass
- [ ] Prisma migration included if schema changed, and DATA_MODEL.md updated
- [ ] Docs (`/docs/*.md`) updated if behavior/architecture changed

---

## Part 2 — The Platform's Own Background Agents (System Design)

These are the automated "agents" the running system operates in production, distinct from AI coding agents
above.

| Agent | Runs in | Trigger | Responsibility |
|---|---|---|---|
| **BTC Ingestion Agent** | `/worker` | Persistent mempool.space WebSocket connection | Streams new mempool + confirmed BTC transactions; upserts `Wallet`/`Transaction`/`TxInput`/`TxOutput` rows |
| **ETH Ingestion Agent** | `/worker` | Persistent Alchemy/Infura WebSocket (`eth_subscribe`) + Etherscan polling for backfill | Streams new ETH transactions and ERC-20 transfers; upserts `Wallet`/`Transaction` rows |
| **Risk-Scoring Agent** | `/worker` | Fired on every new `Transaction` touching a known `Wallet` (queue job via BullMQ) | Evaluates all registered rules (blacklist match, fan-out/in, structuring, dormant reactivation, mixer interaction); writes `RiskScoreHistory`, updates `Wallet.currentRiskScore` |
| **Sanctions/Scam Sync Agent** | `/worker` | Scheduled cron (every 6h) | Downloads OFAC SDN digital-currency list + CryptoScamDB dataset, diffs against existing `Label` rows, inserts new labels, re-triggers risk scoring for newly labeled wallets |
| **Alert Dispatch Agent** | `/backend` (subscribes to Redis pub/sub published by worker) | New `Alert` row created | Broadcasts over Socket.IO to connected clients whose session has access to the relevant case/watchlist; optionally sends email |
| **Price Sync Agent** | `/worker` | Scheduled cron (every 5 min) | Refreshes BTC/ETH → USD/INR from CoinGecko, caches in Redis, used to populate `amountUsdAtTime` |

All agents are stateless with respect to process restarts — durable state lives in Postgres, transient
coordination in Redis, so Render can restart the worker service without losing data (in-flight WebSocket
reconnects and resumes from last known block height / mempool state).
