# PLAN.md — Execution Plan: CryptoTrace (PS5)

Aligned to the official Hackathon 2026 event calendar.

> **Note for an AI build agent:** everything below is written on human hackathon-clock time (a 4–5 person
> team, a 24-hour on-site event). If you're building this end-to-end in an agentic IDE, don't try to
> literally follow the "Hr 0–1 / Hr 1–4…" schedule in §4 — follow **AGENTS.md Part 0 §0.3 (phase-based build
> order)** instead, which sequences the same feature set by dependency rather than by clock hour. Use this
> file for: feature priority (§4 tells you what matters most), the demo script (§5, useful as an acceptance
> checklist), and risk mitigations (§6, useful as things to actually build safeguards for, e.g. Redis
> pre-warming and a fallback demo address). Timeline dates in §1 are event logistics, not build deadlines
> for the agent.

## 1. Timeline Alignment

| Stage | Official Date | Our Deliverable |
|---|---|---|
| Proposal submission opens | 31 Jul 2026 | — |
| Proposal submission deadline | 20 Aug 2026 | Pitch deck (from template) + video walkthrough of concept, low-fi wireframes of dashboard/graph view, architecture diagram |
| Screening & shortlisting | 20–25 Aug 2026 | — (judged) |
| Result announcement | 25 Aug 2026 | — |
| Pre-hack preparation | 25 Aug – 7 Sep 2026 | Repo scaffolding, API keys provisioned, backend skeleton deployed to Render, frontend skeleton deployed to Vercel, data-ingestion worker proven against real BTC/ETH data, auth working |
| Final 24-hour hackathon (offline) | 8 Sep 2026 | Full MVP build per hour-by-hour plan below |
| Grand Finale | 9 Sep 2026 | Live demo + Q&A before judges |

## 2. Team Roles (4–5 members)

| Role | Responsibility |
|---|---|
| **Backend/Ingestion Lead** | Blockchain API integration (Blockstream, mempool.space, Etherscan), ingestion worker, WebSocket server, risk engine |
| **Frontend Lead** | Next.js dashboard, graph visualization, alert feed, case UI |
| **Data/DB Lead** | Postgres schema, Prisma models, sanctions/scam dataset ingestion + refresh jobs, caching (Redis) |
| **Full-stack / DevOps** | Render + Vercel deployment, CI/CD, env/secrets, auth (JWT), monitoring/health checks |
| **PM / Design / Demo (5th member)** | Pitch deck, UX flow, demo script, judging-criteria alignment, case-report design |

*(For a 4-person team, merge DevOps into Backend Lead and PM/Design into Frontend Lead. An AI agent building
solo effectively plays all five roles in the phase order set out in AGENTS.md §0.3.)*

## 3. Pre-Hack Preparation Checklist (25 Aug – 7 Sep)

- [ ] Create GitHub repo (monorepo: `/frontend`, `/backend`, `/worker`, `/prisma`, `/shared`, `/docs` — see
      AGENTS.md §0.2)
- [ ] Provision: Etherscan API key, Render account (Web Service + Background Worker + Postgres + Redis),
      Vercel account
- [ ] Stand up backend skeleton (health check endpoint) on Render, confirm public URL reachable
- [ ] Stand up frontend skeleton (Next.js) on Vercel, confirm it can call the Render backend (CORS
      configured)
- [ ] Prove real-data ingestion: pull a real BTC address's tx history from Blockstream API and a real ETH
      address's tx history from Etherscan, store in Postgres
- [ ] Prove real-time path end-to-end: subscribe to mempool.space WebSocket, log a live incoming
      transaction, push it over our own WebSocket to a test frontend page
- [ ] Load OFAC SDN digital-currency-address CSV and CryptoScamDB dataset into DB, write a refresh job
- [ ] Implement JWT auth (login/register, role field) and protect one API route as a smoke test
- [ ] Apply the Prisma schema (DATA_MODEL.md §5) and run first migration on Render Postgres
- [ ] Build pitch deck + demo video for 20 Aug submission

## 4. 24-Hour Hackathon — Hour-by-Hour Plan (8 Sep)

*(Human-team scheduling reference — an agentic build should use AGENTS.md §0.3's phase order instead; the
feature groupings below still indicate priority.)*

| Time | Focus |
|---|---|
| Hr 0–1 | Kickoff, re-confirm scope, split final task list, re-verify all deployments are live |
| Hr 1–4 | Backend: finalize risk-engine rules (blacklist match, fan-out/in, structuring, dormant reactivation); Frontend: dashboard shell + auth pages |
| Hr 4–8 | Backend: watchlist + alert model + WebSocket broadcast; Frontend: address lookup page wired to live API |
| Hr 8–12 | Frontend: transaction-flow graph (react-force-graph) wired to live multi-hop data; Backend: case management endpoints |
| Hr 12–14 | Break / sync / integration testing |
| Hr 14–18 | Frontend: alert feed (live via WebSocket) + case UI (create/attach/notes); Backend: PDF report export |
| Hr 18–21 | Cross-team integration pass; sanctions/scam screening surfaced in UI; polish risk-score explainability panel |
| Hr 21–23 | Bug bash, deploy final builds to Render/Vercel, seed a real demo watchlist address, rehearse live demo (trigger a real small transaction to prove real-time alerting) |
| Hr 23–24 | Buffer, final deploy freeze, prep judges' walkthrough script |

## 5. Demo Script (for Grand Finale, 9 Sep)

Useful as an acceptance checklist for the finished build — each numbered step should work live before this
is considered done:

1. **Problem framing** (30s): show a real OFAC-sanctioned address, look it up live — flagged instantly with
   source citation.
2. **Fund-flow trace** (60s): expand its graph 2–3 hops, point out a fan-out pattern to multiple fresh
   wallets (classic layering).
3. **Real-time alert** (60s): add a demo address to the watchlist live on stage; send a small real
   transaction to it from a phone wallet; show the alert arrive in the UI within seconds via WebSocket —
   proves "not mock data."
4. **Case workflow** (45s): open a case, attach the flagged address + transaction, add an investigator note,
   export the PDF report.
5. **Architecture close** (30s): one-slide architecture diagram — Render backend + worker + Postgres +
   Redis, Vercel frontend, live public data sources.

## 6. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Public blockchain API rate limits during live demo | Cache aggressively (Redis), pre-warm the demo address's data before going on stage, have a fallback pre-verified address ready |
| Venue Wi-Fi instability during live real-time demo | Use mobile hotspot as backup for the "send a real transaction" step; have a screen-recorded backup clip |
| Real transaction costs/gas fees | Use BTC testnet or a very small mainnet amount pre-funded well in advance; never rely on live funding at the venue |
| Scope creep in 24h window | MVP feature list frozen after pre-hack phase; stretch goals (ERC-20, clustering) only attempted after MVP is demo-ready |
| Team member unavailability | Roles documented here so anyone can pick up another's task; daily 15-min sync during prep phase |
