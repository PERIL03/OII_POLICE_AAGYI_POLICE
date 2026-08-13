# PRD.md — CryptoTrace: Illicit Crypto Flow & Fraud Intelligence Platform

**Event:** The Chandigarh Police National Hackathon 2026
**Problem Statement:** PS5 — *A Platform to Track Illicit Crypto Flow, Flag Fraudulent Accounts, and
Analyze Suspicious Financial Transactions*
**Organizers:** Chandigarh Police, UIET (Panjab University), Punjab Engineering College (PEC)

> This is the product spec — what to build and why. For how to build it, see **AGENTS.md** (build order,
> stack decisions, ground rules), **TECH_STACK.md** (architecture), **DATA_MODEL.md** (schema), and
> **TESTING.md** (verification). If anything here conflicts with those, treat this file as the intent and
> the others as the implementation contract — flag the conflict rather than silently picking one.

---

## 1. Problem Statement (as issued)

> Create a financial intelligence platform that tracks illicit cryptocurrency transactions, identifies
> suspicious wallets and fraudulent accounts, and analyzes financial transaction patterns. The solution
> should support investigations into cyber-enabled financial crimes, money laundering, and digital asset
> fraud.

## 2. Vision

CryptoTrace is a real-time blockchain intelligence and case-management platform for police cybercrime
investigators. It ingests **live, real (non-mocked) blockchain data** for Bitcoin and Ethereum,
cross-references addresses against **real public sanctions/scam datasets** (OFAC SDN Crypto list,
CryptoScamDB, community abuse reports), scores wallets for risk, visualizes fund flows as an interactive
graph, and raises real-time alerts when a monitored wallet moves funds or a new transaction matches a
known-bad address — so an investigator can go from a complaint (e.g., a UPI/crypto fraud FIR) to a
traceable fund-flow map in minutes instead of days.

## 3. Goals

1. **G1 — Real-time monitoring**: Detect and surface new on-chain transactions touching watch-listed
   addresses within seconds of confirmation/mempool broadcast.
2. **G2 — Risk scoring**: Assign an explainable 0–100 risk score to any BTC/ETH address using rule-based
   heuristics + blacklist matches, not a black box.
3. **G3 — Fund-flow tracing**: Visualize multi-hop transaction graphs (who paid whom, how much, when) to
   support "follow the money" investigations, including mixer/tumbler and exchange hop detection.
4. **G4 — Fraud/anomaly detection**: Flag structuring (smurfing), rapid fan-out/fan-in, peel chains,
   round-tripping, and dormant-wallet reactivation.
5. **G5 — Case management**: Let an investigator open a "Case", attach addresses/transactions as evidence,
   add notes, and export a shareable, timestamped investigation report (PDF/CSV) admissible as a working
   aid.
6. **G6 — Actionable alerting**: Push real-time alerts (in-app + WebSocket + optional email) when a watched
   entity transacts or a risk threshold is crossed.

## 4. Non-Goals (Out of Scope for hackathon build)

- Full multi-chain support beyond BTC + ETH (+ ERC-20) in the MVP — architecture must allow adding chains
  later (Solana, TRON/USDT-TRC20) as stretch goals.
- Legally binding evidentiary chain-of-custody / court-admissible forensics (this is an investigative aid,
  not a certified forensic tool).
- De-anonymizing wallet owners beyond publicly available attribution data (KYC data from exchanges is not
  accessible to us).
- Building our own sanctions list — we consume and refresh existing public authoritative lists.

Do not implement anything in this list even if a later section seems to invite it — non-goals win over an
ambiguous read of a user story below.

## 5. Target Users / Personas

| Persona | Description | Key needs |
|---|---|---|
| **Cyber Cell Investigator** (primary) | Chandigarh Police officer handling financial-fraud/crypto FIRs | Fast wallet lookup, fund-flow graph, exportable report |
| **Financial Intelligence Analyst** | Reviews patterns across many cases | Bulk address screening, anomaly dashboard, watchlists |
| **Duty Officer / Supervisor** | Oversees case load | Case status dashboard, alert feed, audit trail |

## 6. User Stories

- As an investigator, I can paste a BTC or ETH address and immediately see its balance, transaction
  history, and a computed risk score, backed by live chain data.
- As an investigator, I can add a suspect address to a **watchlist** and get a **real-time alert** the
  moment it sends or receives funds.
- As an analyst, I can view a **graph** of an address's counterparties up to N hops, with edges weighted by
  amount and colored by risk.
- As an analyst, I can see whether an address appears on the **OFAC SDN crypto list** or a **known
  scam-report database**, with the source and date of the match.
- As an investigator, I can open a **Case**, attach one or more addresses/transactions, write notes, and
  generate a **PDF/CSV report** with timestamps for internal use.
- As a supervisor, I can see a live feed of system-generated alerts across all active cases, filterable by
  severity.
- As any user, I must log in (role-based) and every read/action is recorded in an audit log.

## 7. Core Features (MVP for the 24-hour hackathon)

1. Address lookup & profile (BTC via Blockstream/Mempool.space API, ETH via Etherscan API) — real, live
   data.
2. Rule-based risk engine (blacklist match, mixer heuristic, high-velocity fan-out/in, structuring,
   new-wallet-large-inflow).
3. Interactive transaction-flow graph (multi-hop, real edges from real transactions; react-force-graph per
   TECH_STACK.md §2).
4. Watchlist + real-time alerting via WebSocket (backed by a polling/streaming ingestion worker — no mock
   alert generator).
5. Case management (create case, attach evidence, notes, status).
6. Sanctions/scam screening against refreshed public datasets (OFAC, CryptoScamDB/Chainabuse-style
   community feed).
7. Investigator dashboard: active alerts, watched wallets, case list, system health (data-source
   freshness).
8. Exportable case report (PDF).
9. Auth (JWT, role-based: Investigator / Analyst / Admin) + audit log.

### Stretch goals (if time permits)
- ERC-20 token flow tracing (USDT/USDC).
- Clustering heuristic (common-input-ownership for BTC).
- Exchange deposit-address tagging via public exchange address lists.
- Email/SMS alert delivery.
- Multi-chain (TRON/USDT).

Build the numbered MVP list completely (per AGENTS.md's phase order) before starting any stretch goal.

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Real-time | New relevant transaction → alert visible in UI within ≤10s (mempool) / ≤60s (confirmed block) |
| No mock data | All chain data, prices, and blacklists come from live public APIs/datasets; only synthetic data allowed is seeded **demo case notes**, never transaction data (see AGENTS.md ground rule 1) |
| Availability | Backend deployed on Render (auto-restart, health checks); frontend on Vercel (edge CDN) |
| Security | JWT auth, hashed passwords (bcrypt), HTTPS everywhere, rate limiting, input validation, secrets in env vars only |
| Scalability | Stateless API layer behind Render; ingestion worker decoupled via queue (Redis) so it can scale independently |
| Auditability | Every case action and every alert is logged with actor, timestamp, and source data reference |
| Explainability | Every risk score shows the contributing rules/evidence — no unexplained "AI magic number" |

## 9. Data Sources (all real, all free-tier accessible)

| Source | Purpose | Notes |
|---|---|---|
| Blockstream.info REST API / Esplora | BTC address & tx data | No key required |
| mempool.space REST + WebSocket | BTC live mempool + confirmed tx stream | No key required, WS for real-time |
| Etherscan API | ETH address, tx, internal tx, ERC-20 transfers | Free API key |
| Alchemy/Infura WebSocket (optional) | ETH real-time `pendingTransactions`/`newHeads` | Free tier key |
| US OFAC SDN — Specially Designated Nationals (Digital Currency Addresses) | Sanctions screening | Public CSV/XML, refreshed periodically |
| CryptoScamDB (GitHub dataset/API) | Known scam/phishing addresses | Public, community-sourced |
| CoinGecko API | Live BTC/ETH → INR/USD price for value display | Free tier |

## 10. Success Metrics (for judging: innovation, impact, execution, presentation)

- **Innovation**: explainable rule-based risk engine + live multi-hop graph, purpose-built for police
  workflow (not a generic block explorer clone).
- **Impact**: demoably traces real illicit-pattern flows (e.g., a known OFAC-sanctioned address) end-to-end
  to a case report in the live demo.
- **Execution**: fully deployed, working real-time system (Render + Vercel), no "coming soon" mock screens.
- **Presentation**: live demo — watchlist an address, send/observe a real testnet or mainnet transaction,
  show the alert arrive in real time.

## 11. Assumptions & Constraints

- Free-tier public blockchain APIs are sufficient for a hackathon-scale demo (rate limits apply — see
  TECH_STACK.md for mitigation via caching/queueing).
- We do not have access to Indian exchange KYC data or NCRP data — attribution is limited to public tags
  (exchange hot wallets, sanctioned entities, reported scams).
- BTC + ETH mainnet is prioritized; for live demo safety, small testnet/self-funded mainnet transactions
  may be used to trigger real-time alerts without financial risk.
