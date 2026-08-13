# TESTING.md — Testing Strategy: CryptoTrace

> Each phase in AGENTS.md §0.3 names a checkpoint — this file defines what that checkpoint actually runs.
> Write the test alongside the feature, not after; a phase isn't done until its checkpoint test is green.

Given no-mock-data as a product requirement, testing is split into **fast unit tests with recorded
fixtures** and **real-API integration tests against live, stable public data**, so we get both CI speed and
confidence that the system genuinely works against real chains.

## 1. Test Pyramid

```
        ┌───────────────────────┐
        │  E2E (Playwright)      │  a few critical flows
        ├───────────────────────┤
        │  Integration            │  real external APIs (scheduled/manual), DB-backed
        ├───────────────────────┤
        │  Unit                    │  pure logic: risk rules, validators, formatters
        └───────────────────────┘
```

## 2. Tooling

| Layer | Tool |
|---|---|
| Unit tests | Vitest |
| API/integration tests | Vitest + Supertest, against a real Render/staging Postgres or local Postgres via Docker |
| E2E tests | Playwright, run against Vercel preview deployment + Render staging backend |
| Contract/schema validation | Zod schemas shared (from `/shared`) and tested on both frontend and backend |
| Load/rate-limit testing | k6 (lightweight script against staging, run manually before finale) |

> Vitest, not Jest — TECH_STACK.md and AGENTS.md's common commands both assume Vitest; don't mix test
> runners across packages.

## 3. Unit Tests (fast, no network)

- **Risk-engine rules** (`/worker/src/riskEngine/rules/*`): each rule tested in isolation with constructed
  `walletContext` objects — e.g. `fanOut.test.ts` asserts the rule fires when a wallet sends to >10 distinct
  new addresses within 1 hour, and does not fire for 2 recipients.
- **Address validators**: BTC (bech32/base58check) and ETH (checksum) format validators, including
  known-bad inputs.
- **Serializers/formatters**: amount conversion (sats↔BTC, wei↔ETH), risk-score-to-badge-color mapping.
- **Auth**: JWT issuance/verification, role-guard middleware, password hashing round-trip.

Target: unit tests run in <30s locally and in CI on every push.

## 4. Integration Tests (real external data — the "no mock data" proof)

These call the **actual** public APIs against well-known, stable addresses so they double as a live
regression check that our integrations still work:

| Test | Real target | Assertion |
|---|---|---|
| BTC address lookup | A known, long-lived exchange cold-wallet BTC address | Returns >0 transactions, balance is a non-negative Decimal, response persisted to `Wallet`/`Transaction` tables |
| BTC live mempool stream | mempool.space WebSocket | Test harness opens the real WS connection and asserts at least one `mempool-transactions` event is received within a bounded timeout (e.g. 60s) — proves live streaming actually works, not just REST polling |
| ETH address lookup | A known ETH exchange/contract address | Etherscan response parsed correctly, ERC-20 transfers ingested |
| Sanctions sync | Live OFAC SDN digital-currency CSV | Downloaded file parses, at least N known sanctioned addresses present, `Label` rows created with `source = OFAC_SDN` |
| Scam dataset sync | CryptoScamDB public dataset | Downloaded/parsed, `Label` rows created with `source = CRYPTOSCAMDB` |
| Price sync | CoinGecko API | Returns a plausible BTC/ETH price (sanity range check, not exact value) |
| End-to-end alert | Local/staging DB + worker | Insert a watchlisted test address we control (small testnet or personal mainnet wallet) → send/receive a **real** minimal transaction → assert an `Alert` row is created and a Socket.IO event is emitted within the expected latency budget (see PRD.md §8) |

**CI vs. pre-demo cadence**: the always-on network calls (address lookups, sanctions sync) run on every CI
push against real APIs but are wrapped with retry/backoff and are non-blocking (marked `flaky-ok`) so
third-party downtime doesn't block merges; the full live-alert end-to-end test is run **manually before the
finale demo**, not on every CI push, to avoid spending real funds/gas repeatedly and to avoid third-party
rate-limit exhaustion.

## 5. API Contract Tests

- Supertest suite hitting the real Render-deployed staging backend for each REST endpoint: auth, wallet
  lookup, watchlist CRUD, case CRUD, alert feed, report export — asserting status codes, response shape
  (Zod schema), and auth/role enforcement (e.g., an `ANALYST` cannot delete a `Case`).

## 6. E2E Tests (Playwright, against staging Vercel + Render)

Critical user flows to automate:
1. Login → address lookup → risk score and label evidence visible.
2. Add address to watchlist → (backend triggers a simulated-but-real ingestion event via a controlled test
   transaction) → alert appears in the live feed without a page refresh (proves WebSocket path).
3. Create case → attach evidence → add note → export PDF → file downloads and contains the case title and
   attached address.
4. Role enforcement: an `ANALYST` account cannot access admin-only user-management screen.

## 7. Manual QA Checklist (before Grand Finale demo)

- [ ] Re-verify all three deployments are green: Vercel frontend, Render web service, Render worker (check
      `/health` on backend and worker heartbeat log).
- [ ] Confirm mempool.space and Etherscan WebSocket/API connections are currently alive (check worker logs
      for recent heartbeats).
- [ ] Pre-warm cache for the exact demo addresses (run a lookup 10–15 min before going on stage).
- [ ] Confirm the "live transaction" demo wallet has sufficient balance and the recipient/watchlist address
      is correctly configured.
- [ ] Confirm CORS allows the current Vercel production domain.
- [ ] Confirm rate-limit headroom remaining on Etherscan/CoinGecko free-tier keys.
- [ ] Dry-run the full demo script from PLAN.md §5 at least twice.
- [ ] Have a screen-recorded backup of the real-time alert demo in case of live venue network failure.

## 8. Performance/Load Notes

- k6 script simulates N concurrent investigators polling the alert feed and performing address lookups, run
  manually against staging to validate the Redis caching layer keeps third-party call volume under
  free-tier limits during the expected judging-window traffic.
