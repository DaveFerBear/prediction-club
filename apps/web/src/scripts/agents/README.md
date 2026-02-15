# Club Agents Scripts

This folder now uses a single config-driven runner:

- `run-agent.ts`
- `agents.json` (hard-coded agent definitions)

## Prerequisites

- Database configured (`DATABASE_URL`)
- Service owner user `predictionclubagent@gmail.com` exists in DB
- Service owner has completed Turnkey sign-in (has `turnkeySubOrgId`)
- Each target club already exists
- Service owner is an active admin member in each target club
- Club safes are funded with USDC.e before live runs

For LLM selection, install AI SDK packages in web workspace:

```bash
yarn workspace @prediction-club/web add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

Set at least one provider key:

- OpenAI: `OPENAI_API_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- Gemini: `GOOGLE_GENERATIVE_AI_API_KEY`

## Configure Agents

Edit:

- `apps/web/src/scripts/agents/agents.json`

Each agent defines:

- `id`, `name`, `enabled`
- `clubSlug`
- `provider`, `model`, `persona`
- strategy defaults: `queryPool`, `maxMarketsPerQuery`, `temperature`, `defaultCount`, `defaultAmountUsdc`

## Run Agent

Preview mode (no DB writes):

```bash
yarn agent:run --agent=default-agent --mode=preview
```

Commit mode (creates prediction rounds):

```bash
yarn agent:run --agent=default-agent --mode=commit
```

or directly:

```bash
npx tsx apps/web/src/scripts/agents/run-agent.ts --agent=default-agent --mode=preview
```

## CLI Flags

- `--agent` (required): agent id from `agents.json`
- `--mode` (required): `preview` or `commit`
- `--count=<n>` (optional override): default from agent strategy
- `--amount-usdc=<decimal>` (optional override): default from agent strategy, minimum `1.00`
- `--provider=openai|anthropic|google` (optional override)
- `--model=<model-name>` (optional override)
- `--persona="<prompt text>"` (optional override)

Legacy flags are not supported:

- `--club`
- `--dry-run`

## Behavior

- Rotates through a query pool for diversity
- Fetches up to configured market cap per query
- Skips condition IDs used in last 7 days for the club
- Skips active condition IDs (`PENDING` / `COMMITTED`)
- Uses LLM to select one market and one valid outcome
- Validates model output strictly against candidate set
- `preview`: prints choices + rationale
- `commit`: creates `PredictionRound` entries

## Notes

- If all iterations are skipped/failed, script exits non-zero.
- If at least one iteration succeeds, script exits zero.
- Chainworker must be running to execute and settle committed rounds.
