# PRD: Prediction Return % and Per-Prediction Price History Chart

## Context

The "Past 7 days" exposure chart shows wallet vs in-market capital allocation but doesn't reflect how positions are actually performing — tokens bought on Polymarket appreciate/depreciate as the market moves. Users have no way to see unrealized returns on active predictions or historical price movement for any prediction.

**Goal**: Show a +/- return % on each prediction card, and let users expand a per-prediction price history chart on demand.

---

## Feature 1: Return % Badge on Each Prediction

Show a colored badge (green/red) next to the status badge on each prediction card.

### Calculation

- **COMMITTED rounds** (unrealized): `(currentMidpoint - orderPrice) / orderPrice * 100`
  - `orderPrice` = cost basis per share stored on `PredictionRoundMember` at order placement
  - `currentMidpoint` = live midpoint from Polymarket CLOB (fetched client-side via existing `usePolymarketMarketData` hook)
- **SETTLED rounds** (realized): `totalPnl / totalCommit * 100`
  - Computed server-side from aggregate member `pnlAmount` / `commitAmount`
- **PENDING rounds**: No badge (no order placed yet, `orderPrice` is null)

### Changes

#### 1. Backend: `apps/web/src/controllers/PredictionRoundController.ts`

Update `listPredictionRounds` to include member financial data:

```ts
// Change the include clause to:
include: {
  _count: { select: { members: true } },
  members: {
    select: { orderPrice: true, commitAmount: true, pnlAmount: true },
  },
},
```

Post-process results to compute aggregate fields and strip raw members array:

```ts
const items = predictionRounds.map((round) => {
  const { members, ...rest } = round;
  const orderPrice = members.find((m) => m.orderPrice != null)?.orderPrice ?? null;
  let totalCommit = 0n, totalPnl = 0n;
  for (const m of members) {
    totalCommit += BigInt(m.commitAmount);
    totalPnl += BigInt(m.pnlAmount);
  }
  return { ...rest, orderPrice, totalCommit: totalCommit.toString(), totalPnl: totalPnl.toString() };
});
```

#### 2. Frontend type: `apps/web/src/hooks/use-club-queries.ts`

Add to `PredictionRound` interface:
- `orderPrice: string | null`
- `totalCommit: string`
- `totalPnl: string`

#### 3. UI: `apps/web/src/components/club/PredictionRoundListItem.tsx`

- Add `computeReturnPercent(round, midpoint)` helper
- Call `usePolymarketMarketData(round.targetTokenId)` only for COMMITTED rounds with `orderPrice`
- Render return % badge next to status badge: `+12.3%` / `-5.1%` with green/red background

---

## Feature 2: Per-Prediction Price History Chart

Add an expandable "Price history" button on each prediction card that lazily loads a mini chart.

### Data source

Polymarket CLOB endpoint: `GET /prices-history?market={tokenId}&interval=max&fidelity=60`
- Returns `{ history: [{ t: unix_timestamp, p: price }] }`
- No auth required, free public endpoint
- Hourly fidelity by default

### Changes

#### 4. New API route: `apps/web/src/app/api/polymarket/prices-history/route.ts`

Proxy to CLOB `/prices-history`. Follows same pattern as existing `apps/web/src/app/api/polymarket/market/route.ts`.
- Accepts `tokenId`, `interval` (default `max`), `fidelity` (default `60`)
- Validates with Zod, returns via `apiResponse()`
- Reuses: `POLYMARKET_CLOB_URL` from `apps/web/src/lib/polymarket.ts`, `apiResponse`/`validationError`/`serverError` from `apps/web/src/lib/api.ts`

#### 5. New hook: `apps/web/src/hooks/use-polymarket-price-history.ts`

SWR hook following same pattern as `use-polymarket-market-data.ts`.
- `usePolymarketPriceHistory(tokenId?, enabled?)` — only fetches when both args are truthy
- `revalidateOnFocus: false`, `dedupingInterval: 60_000` (history data is stable)
- Export from `apps/web/src/hooks/index.ts`

#### 6. New component: `apps/web/src/components/club/PredictionPriceChart.tsx`

Mini Recharts `LineChart` (h-48) with:
- Blue price line (`#2563eb`)
- Amber dashed `ReferenceLine` at `orderPrice` (cost basis) with label "Entry XXc"
- Y-axis in cents (e.g. "65c"), X-axis dates
- Loading: `Skeleton` from `@prediction-club/ui`
- Error: muted placeholder text
- Reuses: Recharts (`LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ReferenceLine`, `CartesianGrid`), `date-fns` `format`, `Skeleton` from UI package

#### 7. Integration in `PredictionRoundListItem.tsx`

- Add `chartExpanded` state
- Show "Price history" toggle button (with `ChevronDown` icon) when `orderPrice` is non-null
- Render `<PredictionPriceChart>` when expanded — lazy fetch triggered by mount

---

## Files Summary

| File | Action |
|------|--------|
| `apps/web/src/controllers/PredictionRoundController.ts` | Modify — add member aggregate data |
| `apps/web/src/hooks/use-club-queries.ts` | Modify — extend `PredictionRound` type |
| `apps/web/src/components/club/PredictionRoundListItem.tsx` | Modify — add % badge + chart toggle |
| `apps/web/src/app/api/polymarket/prices-history/route.ts` | **New** — CLOB proxy |
| `apps/web/src/hooks/use-polymarket-price-history.ts` | **New** — SWR hook |
| `apps/web/src/hooks/index.ts` | Modify — export new hook |
| `apps/web/src/components/club/PredictionPriceChart.tsx` | **New** — mini chart |

## Verification

1. **Build**: `yarn build` from monorepo root — should compile without errors
2. **Manual test**: Navigate to a club page with COMMITTED and SETTLED predictions
   - COMMITTED predictions should show a live +/- % badge that updates
   - SETTLED predictions should show realized +/- % badge
   - PENDING predictions should show no badge
   - Clicking "Price history" should lazy-load a chart with price line and entry price reference
3. **API test**: `curl localhost:3000/api/polymarket/prices-history?tokenId={some_token_id}` should return price history JSON
