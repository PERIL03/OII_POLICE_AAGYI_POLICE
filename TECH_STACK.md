# TECH_STACK.md — CryptoTrace Architecture & Stack

> Every choice in this document is final for the build. Where an earlier draft offered alternatives
> ("Express or Fastify", a Python/FastAPI swap, "react-force-graph or vis-network"), the bolded option below
> is the one to build — do not substitute the alternative. See AGENTS.md Part 0 §0.1.

## 1. High-Level Architecture

```
                         ┌─────────────────────────┐
                         │        Vercel            │
                         │  Next.js Frontend (SSR)  │
                         │  - Dashboard / Graph     │
                         │  - Alert feed (WS client)│
                         └────────────┬─────────────┘
                                      │ HTTPS (REST) + WSS
                                      ▼
                         ┌─────────────────────────┐
                         │         Render           │
                         │  API Web Service (Node)  │
                         │  - Auth (JWT)            │
                         │  - REST endpoints        │
                         │  - Socket.IO server      │
                         └───┬──────────────┬────────┘
                             │              │
                 ┌───────────▼───┐   ┌──────▼─────────────┐
                 │ Render Postgres│   │  Render Redis       │
                 │ (Prisma ORM)   │   │  (cache + BullMQ)   │
                 └───────────▲───┘   └──────▲──────────────┘
                             │              │
                         ┌───┴──────────────┴────────┐
                         │   Render Background Worker  │
                         │   (Node, always-on)         │
                         │  - BTC ingestion (mempool.space WS + Blockstream REST) │
                         │  - ETH ingestion (Etherscan / Alchemy WS)              │
                         │  - Risk-scoring engine (rule evaluation on new tx)     │
                         │  - Sanctions/scam dataset refresh (cron)               │
                         │  - Alert generation → pushes to Redis pub/sub →        │
                         │    API Web Service → Socket.IO → Frontend              │
                         └─────────────┬────────────────────────────────────────┘
                                       │ HTTPS
                       ┌───────────────┼────────────────────────────┐
                       ▼               ▼                            ▼
             mempool.space API   Blockstream/Esplora API      Etherscan API
             (BTC live mempool)  (BTC address/tx data)        (ETH tx/ERC-20)
                       ▼
             OFAC SDN crypto address list (CSV) · CryptoScamDB (public dataset) · CoinGecko (price)
```

## 2. Frontend (Vercel)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | SSR for fast first paint, API routes for BFF if needed, first-class Vercel support |
| Styling | **Tailwind CSS** | Fast to build a clean investigator dashboard under time pressure |
| Graph visualization | **react-force-graph** | Interactive multi-hop transaction graphs with real-time updates. This is the only graph library to use — do not also pull in vis-network. |
| Charts | **Recharts** | Volume-over-time, risk distribution charts |
| Real-time client | **socket.io-client** | Live alert feed, watchlist updates |
| State/data fetching | **TanStack Query (React Query)** | Caching, polling fallback, optimistic UI |
| Auth | **JWT stored in httpOnly cookie** via API, NextAuth-style guard on protected routes | Simplicity + security |
| Forms/validation | **React Hook Form + Zod** | Shared validation schema with backend, imported from `/shared` |

## 3. Backend (Render)

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20 + TypeScript** | Shared types with frontend; the only runtime for this build (no Python/FastAPI variant — see note below) |
| API framework | **Express** | Simple REST endpoints. This is the only API framework to use — do not swap in Fastify. |
| Real-time | **Socket.IO server** | Push alerts/watchlist events to connected clients |
| ORM | **Prisma** | Type-safe schema, easy migrations against Render Postgres |
| Database | **Render managed PostgreSQL** | Relational integrity for cases/wallets/transactions/alerts |
| Cache/Queue | **Render managed Redis + BullMQ** | Rate-limit-friendly caching of chain lookups; job queue for ingestion/scoring tasks; pub/sub bridge between worker and API |
| Background worker | **Render Background Worker service** (separate from web service) | Long-running ingestion loop (WebSocket subscriptions to mempool.space / Alchemy) must not share a process with the request-serving API, and must survive independently |
| Auth | **jsonwebtoken + bcrypt** | Role-based (Investigator / Analyst / Admin) |
| PDF export | **pdf-lib** | Case report generation. Prefer this over Puppeteer/headless Chrome — much lighter to run on a Render worker/web dyno and avoids bundling a full browser. |
| Validation | **Zod** (shared with frontend via `/shared`) | Consistent input validation |
| Logging | **pino** | Structured logs, visible in Render logs |

> **Note on language:** an earlier draft of this doc floated a Python/FastAPI swap as an alternative stack.
> That alternative is out of scope — build Node/TypeScript only. Keeping this note so the reasoning isn't
> lost, not as a live option.

## 4. Real (Live) Data Sources — no mock data

| Purpose | API | Auth | Real-time mechanism |
|---|---|---|---|
| BTC address/tx history | Blockstream Esplora REST API (`blockstream.info/api`) | None | Poll on-demand + cache |
| BTC live mempool/new tx | mempool.space WebSocket API | None | Persistent WS subscription in worker |
| ETH address/tx/ERC-20 history | Etherscan API | Free API key | Poll (rate-limited) |
| ETH live pending/new blocks | Alchemy or Infura WebSocket (`eth_subscribe`) | Free API key | Persistent WS subscription in worker |
| Sanctions screening | US Treasury OFAC SDN — Digital Currency Address list | None (public CSV/XML) | Scheduled refresh (e.g., every 6h via BullMQ cron) |
| Scam/abuse address reports | CryptoScamDB public dataset/API | None/public | Scheduled refresh |
| Live price conversion | CoinGecko API | None (free tier) | Poll every few minutes, cache in Redis |

**Rate-limit strategy**: all inbound chain lookups go through Redis cache (TTL 30–120s depending on
endpoint) before hitting a third-party API; watchlisted addresses are prioritized for real-time WS
subscription instead of polling.

## 5. Deployment

### Render (backend)
- **Web Service**: Node/Express API + Socket.IO — `render.yaml` defines build (`npm ci && npm run build
  --workspace=backend`) and start (`npm run start --workspace=backend`) commands.
- **Background Worker**: separate Render service running the ingestion/risk-engine loop — deployed from the
  same repo, different start command (`npm run start --workspace=worker`).
- **PostgreSQL**: Render managed Postgres add-on; `DATABASE_URL` injected as env var; Prisma migrations run
  via `npm run prisma:deploy` in a Render deploy hook / release command.
- **Redis**: Render managed Redis add-on; `REDIS_URL` env var shared by web service + worker.

### Vercel (frontend)
- Next.js app, auto-deploy from `main`/PR previews.
- CORS on the Render API must explicitly allow the Vercel domain(s), including preview deployment wildcard
  if used.

### Environment variables (canonical list — mirror into each package's `.env.example`)

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend, worker | Render Postgres connection string |
| `REDIS_URL` | backend, worker | Render Redis connection string |
| `JWT_SECRET` | backend | Auth token signing |
| `ETHERSCAN_API_KEY` | backend, worker | Free-tier key |
| `ALCHEMY_WS_URL` | worker | Optional; falls back to Infura if unset |
| `INFURA_WS_URL` | worker | Optional fallback for `ALCHEMY_WS_URL` |
| `FRONTEND_ORIGIN` | backend | CORS allow-list, comma-separated for multiple Vercel domains |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | Points at the Render web service |
| `NEXT_PUBLIC_WS_URL` | frontend | Points at the Render web service's Socket.IO endpoint |

### CI/CD
- GitHub Actions: on push → lint + typecheck + unit tests → (main branch) Render and Vercel auto-deploy via
  their native GitHub integrations.

## 6. Security Notes

- All secrets via environment variables only — never committed.
- HTTPS enforced end-to-end (Render + Vercel both provide this by default).
- Rate limiting (`express-rate-limit`) on public-facing auth and lookup endpoints.
- Input validation (Zod) on every API boundary; addresses validated against chain-specific checksum/format
  rules before any external API call.
- Audit log table records every case mutation and every risk-flag view.
