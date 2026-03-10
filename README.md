# Prediction Club

A SaaS platform for "prediction clubs" that coordinate Polymarket trading on Polygon using
Turnkey-managed EOAs and per-club Polymarket Safes.

## Architecture Overview

```
┌──────────────────────────────┐
│ Client (Next.js App Router)  │
│ - pages + feature components │
│ - SWR hooks for reads/mutate │
│ - Google OIDC -> Turnkey     │
└──────────────┬───────────────┘
               │ HTTP (same app)
               ▼
┌──────────────────────────────┐
│ Next.js Route Handlers (/api)│
│ - app-session cookie auth    │
│ - validation + API responses │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Domain Controllers           │
│ - clubs/applications         │
│ - prediction lifecycle       │
│ - club wallet provisioning   │
│   (Turnkey wallet + Safe)    │
│ - ledger accounting          │
└───────┬──────────┬───────────┘
        │          │
        │          ├───────────────────────┐
        │          ▼                       ▼
        │   ┌─────────────────────┐  ┌─────────────────────┐
        │   │ Turnkey API         │  │ Polymarket APIs     │
        │   │ - sub-org users     │  │ - relayer (safe ops)│
        │   │ - wallet accounts   │  │ - CLOB (orders/keys)│
        │   │ - digest signatures │  │ - Gamma (discovery) │
        │   └─────────────────────┘  └─────────────────────┘
        │
        │ Prisma
        ▼
┌──────────────────────────────┐
│ PostgreSQL                   │
│ - users, clubs, memberships  │
│ - club_wallets (+ safe/creds)│
│ - prediction rounds/members  │
│ - ledger entries             │
└──────────────┬───────────────┘
               │ polling + updates
               ▼
┌──────────────────────────────┐
│ Chainworker (separate app)   │
│ - executes PENDING rounds    │
│ - settles COMMITTED rounds   │
│ - uses Turnkey signer + Safe │
└──────────────────────────────┘
```

### Key Components

- **Web App (`apps/web`)**: UI + route handlers; app-session auth, club wallet APIs, and authenticated API surface for clubs/applications/predictions.
- **Domain Layer (`apps/web/src/controllers`)**: Business logic for memberships, prediction round creation, wallet provisioning, and ledger accounting.
- **Database (`packages/db`)**: Shared Prisma client/schema used by both web and chainworker.
- **Chainworker (`apps/chainworker`)**: Background poller that executes pending orders via CLOB and settles resolved rounds using per-club wallet context.
- **Shared Packages (`packages/shared`, `packages/ui`)**: Shared types/utilities and reusable UI primitives.

### Wallet & Signing Flow (Current)

1. **User sign-in (Google -> Turnkey)**  
   On profile sign-in, Google OIDC is exchanged for a Turnkey identity. We persist:
   - `User.turnkeySubOrgId`
   - `User.turnkeyEndUserId`

2. **Per-user, per-club wallet provisioning (`POST /api/clubs/[slug]/wallet/init`)**  
   `ClubWalletController.ensureClubWallet` does this:
   - Creates a **Turnkey EOA wallet account** for that `(user, club)` if missing.
   - Derives/deploys the **Polymarket Safe** for that EOA (relayer client).
   - Executes one-time approval txs via relayer for required Polymarket spenders/operators.
   - Derives CLOB API creds and stores them on `ClubWallet`:
     - `polymarketApiKeyId`
     - `polymarketApiSecret`
     - `polymarketApiPassphrase`
   - Marks `ClubWallet.provisioningStatus` as `READY` (or `FAILED` with `provisioningError`).

3. **Funding model**  
   Club treasury address shown in UI is the **Safe address** (`ClubWallet.polymarketSafeAddress`).
   Deposits/withdrawals are modeled in ledger entries per `(user, club, safeAddress)`.

4. **Order execution (chainworker)**  
   For each `PENDING` prediction round member:
   - Uses Turnkey (`sign_raw_payload`) to sign CLOB EIP-712 payloads with the club Turnkey wallet key.
   - Uses stored club-wallet CLOB creds.
   - Uses Safe address as `funderAddress`.
   - Posts market BUY orders; writes order metadata to `PredictionRoundMember`.

5. **Settlement (chainworker)**  
   For `COMMITTED` rounds, polls market resolution, redeems winning positions, then writes payouts + PnL and appends ledger `PAYOUT` entries.

## Repo Structure

```
/
├── apps/
│   └── web/              # Next.js web application
│   └── chainworker/       # Background worker for Polymarket execution/settlement
├── packages/
│   ├── db/               # Prisma schema and client
│   ├── shared/           # Shared types, utils, env validation
│   └── ui/               # Shared UI components (shadcn/ui)
├── docker-compose.yml    # Optional local infra, not used for the current DB workflow
└── package.json          # Yarn workspaces root
```

## Tech Stack

- **Monorepo**: Yarn Classic (v1) workspaces
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL, Prisma ORM
- **Markets**: Polymarket APIs (Gamma + CLOB)

## Prerequisites

- Node.js >= 22.12.0
- Yarn Classic (v1.22.x) - **NOT Yarn Berry/v3+**
- Access to the shared Neon `DATABASE_URL`

## Database Workflow

We currently do **not** use a local Postgres database for normal development. `DATABASE_URL` points at the shared Neon database.

Rules:

- `yarn db:migrate` is the shared-database path and runs `prisma migrate deploy`
- `yarn db:migrate:dev` is local-only and should not be used unless we intentionally stand up a local Postgres database
- `yarn db:push:unsafe` is disabled by default and should not be part of normal workflow
- never run `prisma migrate dev` against the shared Neon database
- never run `prisma db push` against the shared Neon database

Current safe sequence for schema changes:

```bash
# 1. Update the Prisma schema
$EDITOR packages/db/prisma/schema.prisma

# 2. Generate a migration from the live Neon schema diff
yarn db:migration:create <migration_name>

# 3. Review and commit the generated migration under packages/db/prisma/migrations/

# 4. Apply committed migrations to Neon
yarn db:migrate

# 5. Regenerate the Prisma client
yarn db:generate
```

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd prediction-club

# Install dependencies (uses Yarn v1 workspaces)
yarn install
```

### 2. Environment Setup

Create `apps/web/.env` and `apps/chainworker/.env`, then fill required vars below.

Important:

- `DATABASE_URL` should point at the shared Neon database
- do not point `DATABASE_URL` at a disposable local Postgres unless you are explicitly doing local-only migration work
- the repo scripts now block `migrate dev` and `db push` against non-local hosts

### 3. Database Setup

```bash
# Generate Prisma client
yarn db:generate

# Apply committed migrations to the shared Neon database
yarn db:migrate

# (Optional) Seed with test data
yarn db:seed
```

Do not use these unless you intentionally bring back a local database workflow:

```bash
# Local-only guard; will refuse to run against Neon/shared hosts
yarn db:migrate:dev

# Local-only escape hatch; requires ALLOW_PRISMA_DB_PUSH=1
yarn db:push:unsafe
```

### 4. Run Development Servers

```bash
# Terminal 1: Web app
yarn dev
```

The web app will be available at http://localhost:3000

## Environment Variables

### Web App (`apps/web/.env`)

| Variable                               | Description                                  | Required    |
| -------------------------------------- | -------------------------------------------- | ----------- |
| `DATABASE_URL`                         | PostgreSQL connection string                 | Yes         |
| `APP_SESSION_SECRET`                   | Secret for app session cookie (min 32 chars) | Yes         |
| `TURNKEY_ORGANIZATION_ID`              | Parent Turnkey organization ID               | Yes         |
| `TURNKEY_API_PUBLIC_KEY`               | Turnkey API public key (P-256)               | Yes         |
| `TURNKEY_API_PRIVATE_KEY`              | Turnkey API private key                      | Yes         |
| `TURNKEY_API_BASE_URL`                 | Turnkey API base URL                         | No          |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`         | Google OAuth client ID for sign-in           | Yes         |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID`         | Default chain (80002 for Amoy)               | No          |
| `POLYMARKET_RELAYER_URL`               | Polymarket relayer base URL                  | Yes         |
| `POLY_BUILDER_API_KEY`                 | Polymarket builder API key                   | Yes         |
| `POLY_BUILDER_SECRET`                  | Polymarket builder API secret                | Yes         |
| `POLY_BUILDER_PASSPHRASE`              | Polymarket builder API passphrase            | Yes         |
| `POLYGON_RPC_URL`                      | Server-side Polygon RPC URL                  | Recommended |
| `AMOY_RPC_URL`                         | Server-side Amoy RPC URL                     | Optional    |
| `NEXT_PUBLIC_POLYGON_RPC_URL`          | Polygon mainnet RPC                          | No          |
| `NEXT_PUBLIC_AMOY_RPC_URL`             | Amoy testnet RPC                             | No          |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID                     | No          |

### Chainworker (`apps/chainworker/.env`)

Important: `docker --env-file` does not strip quotes. Avoid quoting values in this file.

| Variable                       | Description                       | Required |
| ------------------------------ | --------------------------------- | -------- |
| `DATABASE_URL`                 | Postgres connection string        | Yes      |
| `TURNKEY_API_PUBLIC_KEY`       | Turnkey API public key (P-256)    | Yes      |
| `TURNKEY_API_PRIVATE_KEY`      | Turnkey API private key           | Yes      |
| `TURNKEY_API_BASE_URL`         | Turnkey API base URL              | No       |
| `POLY_BUILDER_API_KEY`         | Polymarket builder API key        | Yes      |
| `POLY_BUILDER_SECRET`          | Polymarket builder API secret     | Yes      |
| `POLY_BUILDER_PASSPHRASE`      | Polymarket builder API passphrase | Yes      |
| `POLYMARKET_CLOB_URL`          | CLOB base URL                     | No       |
| `POLYMARKET_CHAIN_ID`          | Chain ID (Polygon mainnet is 137) | No       |
| `CHAINWORKER_POLL_INTERVAL_MS` | Polling interval in ms            | No       |
| `CHAINWORKER_BATCH_SIZE`       | Batch size for polling            | No       |

## Available Scripts

### Root

```bash
yarn dev              # Run web app in dev mode
yarn build            # Build web app
yarn db:generate      # Generate Prisma client
yarn db:migration:create <name> # Generate a migration from the live Neon schema diff
yarn db:migrate       # Apply committed migrations to the shared Neon database
yarn db:migrate:dev   # Local-only migration generation; guarded against shared hosts
yarn db:push:unsafe   # Local-only escape hatch for db push (requires ALLOW_PRISMA_DB_PUSH=1)
yarn db:seed          # Seed database
yarn db:studio        # Open Prisma Studio
yarn typecheck        # Run TypeScript checks
yarn lint             # Run linting
```

### Chainworker

Local dev:

```bash
yarn chainworker:dev
```

Repair historical payouts by redeeming resolved winning positions on-chain:

```bash
yarn workspace @prediction-club/chainworker payouts:repair
```

Generate/normalize chainworker env values:

```bash
yarn workspace @prediction-club/chainworker env:generate
```

VM setup (installs Docker + Ops Agent, configures Docker log collection):

```bash
apps/chainworker/vm-setup.sh
```

VM setup via gcloud SSH (uses `GCP_PROJECT_ID`, `GCP_ZONE`, `GCP_VM_NAME`):

```bash
apps/chainworker/vm-setup-remote.sh
```

Deploy to GCP VM (builds, pushes, then restarts container on the VM):

```bash
yarn chainworker:deploy
```

Skip build/push if you want to reuse the last image tag:

```bash
SKIP_BUILD_PUSH=true GCP_IMAGE_TAG=<tag> yarn chainworker:deploy
```

Tail logs on the VM:

```bash
gcloud compute ssh <vm> --zone <zone> --project <project> \
  --command "sudo docker logs -t prediction-chainworker --tail 200"
```

Quick SSH:

```bash
gcloud compute ssh chainworker --project prediction-club
```

## What's Implemented vs Stubbed

### Implemented

- ✅ Prisma schema with all models
- ✅ API routes (clubs, applications, predictions)
- ✅ UI pages (landing, dashboard, club public, club admin)
- ✅ Ledger entries for club balances and prediction rounds
- ✅ App-session auth endpoints for Turnkey identity linking
- ✅ Google-based sign-in UI linked to Turnkey login endpoint
- ✅ Turnkey club wallet provisioning (EOA + Safe + approvals + stored CLOB creds)
- ✅ Chainworker CLOB execution with Turnkey signatures and Safe funder context

### Stubbed / TODO

- 🔲 Real-time updates (would need WebSocket or polling)
- 🔲 Club discovery/ranking
- 🔲 Email notifications
- 🔲 Manager verification system

## Database Schema

Key models:

- **User**: App auth identity + Turnkey sub-org/end-user linkage
- **Club**: Name, manager, visibility, metadata
- **ClubMember**: Role (ADMIN/MEMBER), status
- **ClubWallet**: One record per `(user, club)` with Turnkey wallet account, Polymarket Safe address, stored CLOB creds, and provisioning status
- **Application**: Membership applications
- **PredictionRound**: Prediction rounds with market reference
- **PredictionRoundMember**: Individual participation, PnL tracking
- **Verification**: Off-chain manager verification

### Deploy Web App

The web app can be deployed to Vercel, Railway, or any Node.js hosting:

```bash
yarn build
yarn start
```

Ensure environment variables are set in your deployment platform.

## Testing

```bash
# TypeScript type checking
yarn typecheck

# Linting
yarn lint
```

## License

MIT
