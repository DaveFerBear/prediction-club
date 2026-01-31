# Prediction Club

A SaaS platform for "prediction clubs" that coordinate Polymarket trading as a single actor on Polygon.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Prediction Club                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Next.js    │                                               │
│  │   Web App    │                                               │
│  │              │                                               │
│  │  - Pages     │                                               │
│  │  - API       │                                               │
│  │  - Auth      │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────┐                                          │
│  │   PostgreSQL     │                                          │
│  │   (Prisma ORM)   │                                          │
│  └──────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

- **Web App**: Next.js app with public pages, dashboard, and club admin
- **Predictions**: Prediction rounds with market references and ledger entries

## Repo Structure

```
/
├── apps/
│   └── web/              # Next.js web application
├── packages/
│   ├── db/               # Prisma schema and client
│   ├── shared/           # Shared types, utils, env validation
│   └── ui/               # Shared UI components (shadcn/ui)
├── docker-compose.yml    # Local Postgres
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
- Docker & Docker Compose

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd prediction-club

# Install dependencies (uses Yarn v1 workspaces)
yarn install
```

### 2. Environment Setup

```bash
# Copy environment files
cp apps/web/.env.example apps/web/.env

# Edit with your values (see Environment Variables section)
```

### 3. Start Database

```bash
# Start PostgreSQL
docker-compose up -d

# Verify it's running
docker-compose ps
```

### 4. Setup Database

```bash
# Generate Prisma client
yarn db:generate

# Run migrations
yarn db:migrate

# (Optional) Seed with test data
yarn db:seed
```

### 5. Run Development Servers

```bash
# Terminal 1: Web app
yarn dev
```

The web app will be available at http://localhost:3000

## Environment Variables

### Web App (`apps/web/.env`)

| Variable                               | Description                        | Required |
| -------------------------------------- | ---------------------------------- | -------- |
| `DATABASE_URL`                         | PostgreSQL connection string       | Yes      |
| `NEXTAUTH_URL`                         | App URL for NextAuth               | Yes      |
| `NEXTAUTH_SECRET`                      | Secret for NextAuth (min 32 chars) | Yes      |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID`         | Default chain (80002 for Amoy)     | No       |
| `NEXT_PUBLIC_POLYGON_RPC_URL`          | Polygon mainnet RPC                | No       |
| `NEXT_PUBLIC_AMOY_RPC_URL`             | Amoy testnet RPC                   | No       |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID           | No       |

## Available Scripts

### Root

```bash
yarn dev              # Run web app in dev mode
yarn build            # Build web app
yarn db:generate      # Generate Prisma client
yarn db:migrate       # Run database migrations
yarn db:push          # Push schema to database
yarn db:seed          # Seed database
yarn db:studio        # Open Prisma Studio
yarn typecheck        # Run TypeScript checks
yarn lint             # Run linting
```

## What's Implemented vs Stubbed

### Implemented

- ✅ Prisma schema with all models
- ✅ API routes (clubs, applications, predictions)
- ✅ UI pages (landing, dashboard, club public, club admin)
- ✅ Ledger entries for club balances and prediction rounds

### Stubbed / TODO

- 🔲 Authentication (NextAuth configured but not wired)
- 🔲 Wallet connection (wagmi configured but not integrated)
- 🔲 Polymarket order execution (relay/CLOB orders)
- 🔲 Real-time updates (would need WebSocket or polling)
- 🔲 Club discovery/ranking
- 🔲 Email notifications
- 🔲 Manager verification system

## Database Schema

Key models:

- **User**: Wallet address, email, verification status
- **Club**: Name, manager, visibility, metadata
- **ClubMember**: Role (ADMIN/MEMBER), status
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
