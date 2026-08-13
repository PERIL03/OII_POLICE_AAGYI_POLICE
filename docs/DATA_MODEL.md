# DATA_MODEL.md — CryptoTrace Data Model

Database: **PostgreSQL** (Render managed), accessed via **Prisma ORM**. Redis is used only for
cache/queue/pub-sub, not as a system of record.

## 1. Entity-Relationship Overview

```
User ──< Case ──< CaseEvidence >── Wallet ──< Transaction >── Wallet
  │        │                          │
  │        └─< CaseNote               ├─< RiskScore (history)
  │                                   ├─< Label (blacklist/scam/exchange tag)
  └─< AuditLog                       └─< WatchlistEntry ──< Alert
```

## 2. Entities

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | String | |
| email | String (unique) | |
| passwordHash | String | bcrypt |
| role | Enum(`INVESTIGATOR`,`ANALYST`,`ADMIN`) | |
| badgeId | String, nullable | Officer identifier |
| createdAt / updatedAt | DateTime | |

### Wallet (blockchain address)
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| chain | Enum(`BTC`,`ETH`) | Extensible for future chains |
| address | String | Indexed, unique per chain |
| firstSeenAt | DateTime, nullable | From chain data |
| lastSeenAt | DateTime, nullable | Updated by ingestion worker |
| balance | Decimal | Cached, refreshed on lookup/ingestion |
| currentRiskScore | Int (0–100) | Denormalized latest score for fast queries |
| entityLabel | String, nullable | e.g. "Binance Hot Wallet", "Reported Scam" |
| isWatchlisted | Boolean | Denormalized flag for fast filtering |
| createdAt / updatedAt | DateTime | |

*(unique constraint on `chain + address`)*

### Transaction
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| chain | Enum(`BTC`,`ETH`) | |
| txHash | String | Indexed, unique per chain |
| fromWalletId | UUID (FK → Wallet), nullable | Nullable for multi-input BTC txs (see TxInput/Output) |
| toWalletId | UUID (FK → Wallet), nullable | |
| amount | Decimal | In native units (BTC/ETH) |
| amountUsdAtTime | Decimal, nullable | From CoinGecko price at block time |
| blockHeight | Int, nullable | Null while unconfirmed/mempool |
| status | Enum(`MEMPOOL`,`CONFIRMED`) | |
| confirmedAt | DateTime, nullable | |
| ingestedAt | DateTime | When our worker recorded it |
| rawPayload | JSONB | Full original API response, for audit/debug |

### TxInput / TxOutput (for BTC multi-input/output support)
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| transactionId | UUID (FK → Transaction) | |
| walletId | UUID (FK → Wallet) | |
| value | Decimal | |
| index | Int | vin/vout index |

### Label
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| walletId | UUID (FK → Wallet) | |
| source | Enum(`OFAC_SDN`,`CRYPTOSCAMDB`,`INTERNAL_ANALYST`,`EXCHANGE_TAG`) | |
| category | String | e.g. "sanctioned", "phishing", "ransomware", "mixer" |
| description | String, nullable | |
| sourceUrl | String, nullable | Citation |
| detectedAt | DateTime | |

### RiskScoreHistory
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| walletId | UUID (FK → Wallet) | |
| score | Int (0–100) | |
| reasons | JSONB | Array of `{rule, weight, evidence}` — explainability |
| computedAt | DateTime | |

### WatchlistEntry
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| walletId | UUID (FK → Wallet) | |
| addedByUserId | UUID (FK → User) | |
| caseId | UUID (FK → Case), nullable | |
| reason | String, nullable | |
| createdAt | DateTime | |

### Alert
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| watchlistEntryId | UUID (FK → WatchlistEntry), nullable | |
| walletId | UUID (FK → Wallet) | |
| transactionId | UUID (FK → Transaction), nullable | |
| severity | Enum(`LOW`,`MEDIUM`,`HIGH`,`CRITICAL`) | |
| type | Enum(`WATCHLIST_ACTIVITY`,`SANCTIONS_MATCH`,`ANOMALY_STRUCTURING`,`ANOMALY_FANOUT`,`ANOMALY_FANIN`,`DORMANT_REACTIVATION`,`MIXER_INTERACTION`) | |
| message | String | Human-readable summary |
| acknowledgedByUserId | UUID (FK → User), nullable | |
| acknowledgedAt | DateTime, nullable | |
| createdAt | DateTime | Indexed for live feed ordering |

### Case
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| title | String | |
| firNumber | String, nullable | Link to real police FIR reference |
| status | Enum(`OPEN`,`UNDER_REVIEW`,`CLOSED`) | |
| createdByUserId | UUID (FK → User) | |
| createdAt / updatedAt | DateTime | |

### CaseEvidence
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| caseId | UUID (FK → Case) | |
| walletId | UUID (FK → Wallet), nullable | |
| transactionId | UUID (FK → Transaction), nullable | |
| addedByUserId | UUID (FK → User) | |
| createdAt | DateTime | |

### CaseNote
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| caseId | UUID (FK → Case) | |
| authorId | UUID (FK → User) | |
| body | Text | |
| createdAt | DateTime | |

### AuditLog
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| userId | UUID (FK → User), nullable | Null for system-generated events |
| action | String | e.g. `CASE_CREATED`, `WATCHLIST_ADDED`, `ADDRESS_LOOKUP`, `REPORT_EXPORTED` |
| entityType | String | e.g. `Case`, `Wallet` |
| entityId | UUID, nullable | |
| metadata | JSONB | |
| createdAt | DateTime | Indexed |

## 3. Indexing Strategy

- `Wallet(chain, address)` — unique composite index (primary lookup path).
- `Transaction(chain, txHash)` — unique composite index.
- `Transaction(fromWalletId)`, `Transaction(toWalletId)` — for graph traversal queries.
- `Alert(createdAt DESC)` — for the live alert feed.
- `Label(walletId)` — fast screening lookups.
- `AuditLog(createdAt DESC)`, `AuditLog(userId)`.

## 4. Data Freshness / Real-Time Notes

- `Wallet.balance` and `Wallet.currentRiskScore` are denormalized caches, recomputed by the worker whenever
  a new transaction involving that wallet is ingested — never stubbed.
- `RiskScoreHistory` is append-only, giving investigators a timeline of how risk evolved (important for
  explaining alerts in court/case files).
- `rawPayload` on `Transaction` preserves the original third-party API response so any computed field can be
  audited back to its live source.

## 5. Prisma schema skeleton

This lives at `/prisma/schema.prisma` and is the source of truth both `/backend` and `/worker` import their
generated client from. Field lists above are authoritative for anything not shown here (e.g. add remaining
scalar fields as plain `String`/`Int`/`DateTime` per the tables in §2) — this skeleton exists so relations,
enums, and indexes aren't left for the agent to guess.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  INVESTIGATOR
  ANALYST
  ADMIN
}

enum Chain {
  BTC
  ETH
}

enum TxStatus {
  MEMPOOL
  CONFIRMED
}

enum LabelSource {
  OFAC_SDN
  CRYPTOSCAMDB
  INTERNAL_ANALYST
  EXCHANGE_TAG
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertType {
  WATCHLIST_ACTIVITY
  SANCTIONS_MATCH
  ANOMALY_STRUCTURING
  ANOMALY_FANOUT
  ANOMALY_FANIN
  DORMANT_REACTIVATION
  MIXER_INTERACTION
}

enum CaseStatus {
  OPEN
  UNDER_REVIEW
  CLOSED
}

model User {
  id              String           @id @default(uuid())
  name            String
  email           String           @unique
  passwordHash    String
  role            Role
  badgeId         String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  cases           Case[]
  watchlistEntries WatchlistEntry[]
  caseEvidence    CaseEvidence[]
  caseNotes       CaseNote[]
  auditLogs       AuditLog[]
  acknowledgedAlerts Alert[]       @relation("AlertAcknowledgedBy")

  @@index([email])
}

model Wallet {
  id                String           @id @default(uuid())
  chain             Chain
  address           String
  firstSeenAt       DateTime?
  lastSeenAt        DateTime?
  balance           Decimal          @default(0)
  currentRiskScore  Int              @default(0)
  entityLabel       String?
  isWatchlisted     Boolean          @default(false)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  outgoingTx        Transaction[]    @relation("FromWallet")
  incomingTx        Transaction[]    @relation("ToWallet")
  txInputs          TxInput[]
  txOutputs         TxOutput[]
  labels            Label[]
  riskHistory       RiskScoreHistory[]
  watchlistEntries  WatchlistEntry[]
  alerts            Alert[]
  caseEvidence      CaseEvidence[]

  @@unique([chain, address])
}

model Transaction {
  id               String     @id @default(uuid())
  chain            Chain
  txHash           String
  fromWalletId     String?
  toWalletId       String?
  amount           Decimal
  amountUsdAtTime  Decimal?
  blockHeight      Int?
  status           TxStatus
  confirmedAt      DateTime?
  ingestedAt       DateTime   @default(now())
  rawPayload       Json

  fromWallet       Wallet?    @relation("FromWallet", fields: [fromWalletId], references: [id])
  toWallet         Wallet?    @relation("ToWallet", fields: [toWalletId], references: [id])
  inputs           TxInput[]
  outputs          TxOutput[]
  alerts           Alert[]
  caseEvidence     CaseEvidence[]

  @@unique([chain, txHash])
  @@index([fromWalletId])
  @@index([toWalletId])
}

model TxInput {
  id            String      @id @default(uuid())
  transactionId String
  walletId      String
  value         Decimal
  index         Int
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  wallet        Wallet      @relation(fields: [walletId], references: [id])
}

model TxOutput {
  id            String      @id @default(uuid())
  transactionId String
  walletId      String
  value         Decimal
  index         Int
  transaction   Transaction @relation(fields: [transactionId], references: [id])
  wallet        Wallet      @relation(fields: [walletId], references: [id])
}

model Label {
  id          String      @id @default(uuid())
  walletId    String
  source      LabelSource
  category    String
  description String?
  sourceUrl   String?
  detectedAt  DateTime    @default(now())
  wallet      Wallet      @relation(fields: [walletId], references: [id])

  @@index([walletId])
}

model RiskScoreHistory {
  id         String   @id @default(uuid())
  walletId   String
  score      Int
  reasons    Json
  computedAt DateTime @default(now())
  wallet     Wallet   @relation(fields: [walletId], references: [id])

  @@index([walletId])
}

model WatchlistEntry {
  id            String   @id @default(uuid())
  walletId      String
  addedByUserId String
  caseId        String?
  reason        String?
  createdAt     DateTime @default(now())

  wallet        Wallet   @relation(fields: [walletId], references: [id])
  addedBy       User     @relation(fields: [addedByUserId], references: [id])
  case          Case?    @relation(fields: [caseId], references: [id])
  alerts        Alert[]
}

model Alert {
  id                   String          @id @default(uuid())
  watchlistEntryId     String?
  walletId             String
  transactionId        String?
  severity             AlertSeverity
  type                 AlertType
  message              String
  acknowledgedByUserId String?
  acknowledgedAt       DateTime?
  createdAt            DateTime        @default(now())

  watchlistEntry       WatchlistEntry? @relation(fields: [watchlistEntryId], references: [id])
  wallet               Wallet          @relation(fields: [walletId], references: [id])
  transaction          Transaction?    @relation(fields: [transactionId], references: [id])
  acknowledgedBy       User?           @relation("AlertAcknowledgedBy", fields: [acknowledgedByUserId], references: [id])

  @@index([createdAt(sort: Desc)])
}

model Case {
  id              String           @id @default(uuid())
  title           String
  firNumber       String?
  status          CaseStatus       @default(OPEN)
  createdByUserId String
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  createdBy       User             @relation(fields: [createdByUserId], references: [id])
  evidence        CaseEvidence[]
  notes           CaseNote[]
  watchlistEntries WatchlistEntry[]
}

model CaseEvidence {
  id            String       @id @default(uuid())
  caseId        String
  walletId      String?
  transactionId String?
  addedByUserId String
  createdAt     DateTime     @default(now())

  case          Case         @relation(fields: [caseId], references: [id])
  wallet        Wallet?      @relation(fields: [walletId], references: [id])
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  addedBy       User         @relation(fields: [addedByUserId], references: [id])
}

model CaseNote {
  id        String   @id @default(uuid())
  caseId    String
  authorId  String
  body      String
  createdAt DateTime @default(now())

  case      Case     @relation(fields: [caseId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  action     String
  entityType String
  entityId   String?
  metadata   Json
  createdAt  DateTime @default(now())

  user       User?    @relation(fields: [userId], references: [id])

  @@index([createdAt(sort: Desc)])
  @@index([userId])
}
```
