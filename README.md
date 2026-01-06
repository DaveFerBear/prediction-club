# Prediction Club

A SaaS platform for "prediction clubs" that trade as a single on-chain actor on Polygon. Clubs pool capital in a smart contract vault, managed by a Gnosis Safe multisig.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Prediction Club                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Next.js    │  │   Indexer    │  │    Smart Contracts   │  │
│  │   Web App    │  │   Service    │  │    (Foundry)         │  │
│  │              │  │              │  │                      │  │
│  │  - Pages     │  │  - Poll      │  │  - ClubVaultV1.sol   │  │
│  │  - API       │  │  - Process   │  │  - Gnosis Safe       │  │
│  │  - Auth      │  │  - Backfill  │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────┬────────┴──────────────────────┘              │
│                  │                                               │
│         ┌────────▼────────┐                                     │
│         │    PostgreSQL   │                                     │
│         │    (Prisma)     │                                     │
│         └─────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

- **ClubVaultV1**: Smart contract holding USDC, tracking member balances (available vs committed)
- **Gnosis Safe**: Multisig owner of each vault (starts 1-of-1, upgradeable to 2-of-3)
- **Web App**: Next.js app with public pages, dashboard, and club admin
- **Indexer**: Polls vault events and syncs to Postgres
- **Cohorts**: Prediction rounds - automatic participation for eligible members

## Repo Structure

```
/
├── apps/
│   ├── web/              # Next.js web application
│   └── indexer/          # Event indexer service
├── packages/
│   ├── db/               # Prisma schema and client
│   ├── shared/           # Shared types, utils, env validation
│   ├── chain/            # ABI, viem client, Safe SDK utils
│   └── ui/               # Shared UI components (shadcn/ui)
├── contracts/
│   ├── src/              # Solidity contracts
│   ├── test/             # Foundry tests
│   └── script/           # Deployment scripts
├── docker-compose.yml    # Local Postgres
└── package.json          # Yarn workspaces root
```

## Tech Stack

- **Monorepo**: Yarn Classic (v1) workspaces
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL, Prisma ORM
- **Blockchain**: Polygon (Amoy testnet / Mainnet)
- **Smart Contracts**: Solidity 0.8.20, Foundry
- **Chain Interaction**: viem
- **Safe Integration**: Safe SDK (stubbed)

## Prerequisites

- Node.js >= 18
- Yarn Classic (v1.22.x) - **NOT Yarn Berry/v3+**
- Docker & Docker Compose
- Foundry (for contract development)

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
cp apps/web/.env.example apps/web/.env.local
cp apps/indexer/.env.example apps/indexer/.env

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

# Terminal 2: Indexer (optional)
yarn indexer:dev
```

The web app will be available at http://localhost:3000

### 6. Smart Contract Development

```bash
cd contracts

# Install Foundry dependencies
forge install

# Run tests
forge test

# Run tests with verbosity
forge test -vvv

# Deploy to Amoy testnet
forge script script/Deploy.s.sol --rpc-url amoy --broadcast
```

## Environment Variables

### Web App (`apps/web/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | App URL for NextAuth | Yes |
| `NEXTAUTH_SECRET` | Secret for NextAuth (min 32 chars) | Yes |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | Default chain (80002 for Amoy) | No |
| `NEXT_PUBLIC_POLYGON_RPC_URL` | Polygon mainnet RPC | No |
| `NEXT_PUBLIC_AMOY_RPC_URL` | Amoy testnet RPC | No |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID | No |

### Indexer (`apps/indexer/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `INDEXER_CHAIN_ID` | Chain to index (default: 80002) | No |
| `INDEXER_START_BLOCK` | Block to start indexing from | No |
| `INDEXER_POLL_INTERVAL_MS` | Poll interval (default: 5000) | No |
| `INDEXER_BATCH_SIZE` | Blocks per batch (default: 1000) | No |
| `POLYGON_RPC_URL` | Polygon mainnet RPC | No |
| `AMOY_RPC_URL` | Amoy testnet RPC | No |

### Contract Deployment

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer wallet private key |
| `SAFE_ADDRESS` | Gnosis Safe address (vault owner) |
| `COLLATERAL_TOKEN` | USDC address on target chain |
| `POLYGON_RPC_URL` | Polygon RPC URL |
| `AMOY_RPC_URL` | Amoy RPC URL |
| `POLYGONSCAN_API_KEY` | For contract verification |

## Available Scripts

### Root

```bash
yarn dev              # Run web app in dev mode
yarn build            # Build web app
yarn indexer          # Run indexer
yarn indexer:dev      # Run indexer in dev mode
yarn db:generate      # Generate Prisma client
yarn db:migrate       # Run database migrations
yarn db:push          # Push schema to database
yarn db:seed          # Seed database
yarn db:studio        # Open Prisma Studio
yarn contracts:build  # Build contracts
yarn contracts:test   # Run contract tests
yarn typecheck        # Run TypeScript checks
yarn lint             # Run linting
```

### Indexer

```bash
# Backfill events for a club
yarn indexer:backfill --club alpha-traders --from 50000000
```

## What's Implemented vs Stubbed

### Implemented

- ✅ Complete ClubVaultV1 smart contract
- ✅ Foundry tests for all contract functions
- ✅ Prisma schema with all models
- ✅ API routes (clubs, applications, cohorts, balance, withdraw)
- ✅ Indexer with event processing and backfill
- ✅ UI pages (landing, dashboard, club public, club admin)
- ✅ Chain utilities (viem client, ABI exports)
- ✅ Safe transaction building utilities

### Stubbed / TODO

- 🔲 Authentication (NextAuth configured but not wired)
- 🔲 Wallet connection (wagmi configured but not integrated)
- 🔲 Safe SDK actual execution (transaction building works, execution stubbed)
- 🔲 Polymarket integration (market reference is just a string)
- 🔲 Real-time updates (would need WebSocket or polling)
- 🔲 Club discovery/ranking
- 🔲 Email notifications
- 🔲 Manager verification system

## Database Schema

Key models:

- **User**: Wallet address, email, verification status
- **Club**: Name, Safe address, vault address, chain ID
- **ClubMember**: Role (ADMIN/MEMBER), status
- **Application**: Membership applications
- **Cohort**: Prediction rounds with market reference
- **CohortMember**: Individual participation, PnL tracking
- **VaultEvent**: Indexed on-chain events
- **Verification**: Off-chain manager verification

## Smart Contract

The `ClubVaultV1` contract:

- Holds USDC collateral
- Tracks per-member balances (available vs committed)
- Supports cohort-based commitment and settlement
- Only the Safe owner can commit, settle, withdraw, or rescue tokens
- Members can deposit and set withdrawal addresses

Key functions:
- `deposit(amount)` - Deposit USDC
- `depositFor(member, amount)` - Deposit for another member
- `commitToCohort(cohortId, entries)` - Lock funds (Safe only)
- `settleCohort(cohortId, entries)` - Release + payout (Safe only)
- `withdraw(member, amount)` - Withdraw to member's address (Safe only)

## Deployment

### Deploy Contract to Amoy

```bash
cd contracts

# Set environment
export PRIVATE_KEY="your-private-key"
export SAFE_ADDRESS="0x..."
export COLLATERAL_TOKEN="0x..." # USDC on Amoy

# Deploy
forge script script/Deploy.s.sol:DeployTestnet \
  --rpc-url $AMOY_RPC_URL \
  --broadcast \
  --verify
```

### Deploy Web App

The web app can be deployed to Vercel, Railway, or any Node.js hosting:

```bash
yarn build
yarn start
```

Ensure environment variables are set in your deployment platform.

## Testing

```bash
# Contract tests
yarn contracts:test

# TypeScript type checking
yarn typecheck

# Linting
yarn lint
```

## License

MIT
