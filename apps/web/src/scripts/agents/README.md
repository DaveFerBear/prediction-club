# Club Agents Scripts

This folder contains two CLI scripts for simple autonomous club operations:

- `create-agent-clubs.ts`
- `run-agent.ts`

They are intentionally minimal and reuse existing app controllers/wallet provisioning.

## Prerequisites

- Database configured (`DATABASE_URL`)
- Owner user already exists in DB
- Owner has completed Turnkey sign-in (must have `turnkeySubOrgId`)
- Club safes funded with USDC.e before live runs

For `run-agent` (LLM selection), install AI SDK packages in web workspace:

```bash
yarn workspace @prediction-club/web add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

And set at least one provider key:

- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- Gemini: `GOOGLE_GENERATIVE_AI_API_KEY`

## Script 1: Create Clubs

Creates clubs and provisions each club wallet/safe for the owner.

### Command

```bash
yarn agent:create-clubs --owner=you@example.com --count=5 --prefix="Agent Club"
```

or:

```bash
npx tsx apps/web/src/scripts/agents/create-agent-clubs.ts --owner=you@example.com --count=5 --prefix="Agent Club"
```

### Flags

- `--owner` (required): user email or wallet address
- `--count` (required): number of clubs to create
- `--prefix` (required): club name prefix
- `--public=true|false` (optional, default `true`)
- `--start-index=<n>` (optional, default `1`)

### Output

- Per-club status lines (`READY` or `FAILED`)
- JSON summary with created/failed entries
- Safe addresses to fund manually

## Script 2: Run Agent

Chooses markets + outcomes and creates prediction rounds for a club.

Chainworker executes orders asynchronously.

### Command

```bash
yarn agent:run --club=agent-club-1 --owner=you@example.com
```

or:

```bash
npx tsx apps/web/src/scripts/agents/run-agent.ts --club=agent-club-1 --owner=you@example.com
```

### Flags

- `--club` (required): club slug
- `--owner` (required): admin user email or wallet address for that club
- `--count=<n>` (optional, default `1`)
- `--amount-usdc=<decimal>` (optional, default `1.00`, minimum `1.00`)
- `--dry-run` (optional, default `false`)
- `--provider=openai|anthropic|google` (optional override)
- `--model=<model-name>` (optional override)
- `--persona="<prompt text>"` (optional override)

### Behavior

- Rotates through a query pool for market diversity
- Fetches up to 100 markets per query
- Skips markets used in last 7 days for the same club
- Skips currently active (`PENDING` / `COMMITTED`) condition IDs
- Uses LLM to choose:
  - one market
  - one valid outcome
- Validates model output strictly against candidates
- Creates `PredictionRound` entries (unless `--dry-run`)

### Notes

- If all iterations are skipped/failed, script exits non-zero.
- If at least one iteration succeeds, script exits zero.
- Running chainworker is required to place/settle orders after rounds are created.

## Agent Config

Default per-club config lives in:

- `club-agent-config.ts`

You can define per-club overrides there (provider/model/persona/query pool).
