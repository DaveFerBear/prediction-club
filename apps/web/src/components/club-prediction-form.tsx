'use client';

import { useCallback, useMemo, useReducer } from 'react';
import { parseUnits } from 'viem';
import { Button, Input } from '@prediction-club/ui';
import { useCreatePrediction } from '@/hooks/use-create-prediction';
import { usePolymarketMarketData } from '@/hooks/use-polymarket-market-data';
import { MarketSearch } from '@/components/market-search';
import type { ClubDetail } from '@/hooks';
import type { MarketItem } from '@/hooks/use-market-search';

type PredictionFormState = {
  tag: 'idle' | 'submitting' | 'success' | 'error';
  selectedMarket: MarketItem | null;
  selectedOutcome: string | null;
  betAmount: string;
  message: string | null;
};

type PredictionFormAction =
  | { type: 'selectMarket'; market: MarketItem | null }
  | { type: 'selectOutcome'; outcome: string | null }
  | { type: 'setBetAmount'; amount: string }
  | { type: 'clearMessage' }
  | { type: 'submitStart' }
  | { type: 'submitSuccess'; message: string }
  | { type: 'submitError'; message: string };

const initialState: PredictionFormState = {
  tag: 'idle',
  selectedMarket: null,
  selectedOutcome: null,
  betAmount: '',
  message: null,
};

function predictionFormReducer(
  state: PredictionFormState,
  action: PredictionFormAction
): PredictionFormState {
  switch (action.type) {
    case 'selectMarket':
      return {
        ...state,
        selectedMarket: action.market,
        selectedOutcome: null,
      };
    case 'selectOutcome':
      return {
        ...state,
        selectedOutcome: action.outcome,
      };
    case 'setBetAmount':
      return {
        ...state,
        betAmount: action.amount,
      };
    case 'clearMessage':
      return {
        ...state,
        tag: 'idle',
        message: null,
      };
    case 'submitStart':
      return {
        ...state,
        tag: 'submitting',
        message: null,
      };
    case 'submitSuccess':
      return {
        tag: 'success',
        selectedMarket: null,
        selectedOutcome: null,
        betAmount: '',
        message: action.message,
      };
    case 'submitError':
      return {
        ...state,
        tag: 'error',
        message: action.message,
      };
    default:
      return state;
  }
}

function getMarketTitle(market: MarketItem | null) {
  if (!market) return 'Market';
  return market.question || market.title || market.slug || 'Market';
}

function getMarketRef(market: MarketItem | null) {
  if (!market) return '';
  return String(market.id ?? market.slug ?? market.eventId ?? '');
}

function OutcomeDetails({ outcome, tokenId }: { outcome: string; tokenId?: string }) {
  const { data, error, isLoading } = usePolymarketMarketData(tokenId);

  const formatPrice = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object' && value && 'price' in value) {
      const priceValue = (value as { price?: string | number }).price;
      return priceValue !== undefined ? String(priceValue) : '—';
    }
    return '—';
  };

  if (!tokenId) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Missing token id for {outcome}.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Loading {outcome} market data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border p-3 text-sm text-muted-foreground">
        Market data unavailable for {outcome}.
      </div>
    );
  }

  const bids = data.orderbook.bids.slice(0, 5);
  const asks = data.orderbook.asks.slice(0, 5);

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="font-medium">{outcome}</div>
        <div className="text-muted-foreground">
          Buy: {formatPrice(data.price.buy)}
        </div>
        <div className="text-muted-foreground">
          Sell: {formatPrice(data.price.sell)}
        </div>
        <div className="text-muted-foreground">
          Mid: {formatPrice(data.price.midpoint)}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Bids (top 5)</div>
          <div className="mt-2 space-y-1">
            {bids.length === 0 ? (
              <div className="text-xs text-muted-foreground">No bids.</div>
            ) : (
              bids.map((bid, idx) => (
                <div key={`bid-${idx}`} className="flex justify-between text-xs">
                  <span>{bid.price}</span>
                  <span className="text-muted-foreground">{bid.size}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Asks (top 5)</div>
          <div className="mt-2 space-y-1">
            {asks.length === 0 ? (
              <div className="text-xs text-muted-foreground">No asks.</div>
            ) : (
              asks.map((ask, idx) => (
                <div key={`ask-${idx}`} className="flex justify-between text-xs">
                  <span>{ask.price}</span>
                  <span className="text-muted-foreground">{ask.size}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClubPredictionForm({
  club,
  clubSlug,
  address,
}: {
  club: ClubDetail;
  clubSlug: string;
  address: string | null;
}) {
  const [state, dispatch] = useReducer(predictionFormReducer, initialState);
  const { createPrediction } = useCreatePrediction(clubSlug);

  const members = club.members ?? [];
  const isManager =
    !!address && club.manager?.walletAddress?.toLowerCase() === address.toLowerCase();

  const isAdmin = useMemo(() => {
    if (!address) return false;
    const member = members.find(
      (item) => item.user.walletAddress.toLowerCase() === address.toLowerCase()
    );
    return member?.role === 'ADMIN' || isManager;
  }, [address, members, isManager]);

  const outcomes = useMemo(
    () =>
      Array.isArray(state.selectedMarket?.outcomes)
        ? (state.selectedMarket?.outcomes ?? [])
        : [],
    [state.selectedMarket]
  );
  const clobTokenIds = useMemo(
    () =>
      Array.isArray(state.selectedMarket?.clobTokenIds)
        ? (state.selectedMarket?.clobTokenIds ?? [])
        : [],
    [state.selectedMarket]
  );
  const outcomeDetails = outcomes.map((outcome, index) => ({
    outcome,
    tokenId: clobTokenIds[index],
  }));

  const canSubmit =
    isAdmin &&
    state.tag !== 'submitting' &&
    !!state.selectedMarket &&
    !!state.selectedOutcome &&
    !!state.betAmount.trim();

  const submit = useCallback(async () => {
    dispatch({ type: 'clearMessage' });

    if (!isAdmin) {
      dispatch({ type: 'submitError', message: 'Only club admins can create predictions.' });
      return;
    }

    if (!state.selectedMarket) {
      dispatch({ type: 'submitError', message: 'Select a market.' });
      return;
    }

    if (!state.selectedOutcome) {
      dispatch({ type: 'submitError', message: 'Pick a winning outcome.' });
      return;
    }

    if (!state.betAmount.trim()) {
      dispatch({ type: 'submitError', message: 'Enter a bet amount.' });
      return;
    }

    let commitAmount: string;
    try {
      commitAmount = parseUnits(state.betAmount.trim(), 6).toString();
    } catch {
      dispatch({ type: 'submitError', message: 'Bet amount must be a valid number.' });
      return;
    }

    if (BigInt(commitAmount) <= 0n) {
      dispatch({ type: 'submitError', message: 'Bet amount must be greater than 0.' });
      return;
    }

    const entries = members.map((member) => ({
      userId: member.user.id,
      commitAmount,
    }));

    if (entries.length === 0) {
      dispatch({ type: 'submitError', message: 'No active members found.' });
      return;
    }

    dispatch({ type: 'submitStart' });

    try {
      const marketTitle = `${getMarketTitle(state.selectedMarket)} — ${state.selectedOutcome}`;
      const response = await createPrediction({
        marketRef: getMarketRef(state.selectedMarket),
        marketTitle,
        members: entries,
      });

      if (response?.success) {
        dispatch({ type: 'submitSuccess', message: 'Prediction created.' });
        return;
      }

      dispatch({ type: 'submitError', message: 'Failed to create prediction.' });
    } catch (err) {
      dispatch({
        type: 'submitError',
        message: err instanceof Error ? err.message : 'Failed to create prediction.',
      });
    }
  }, [createPrediction, isAdmin, members, state.betAmount, state.selectedMarket, state.selectedOutcome]);

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Only club admins can create predictions.
        </div>
      )}
      <MarketSearch
        selectedMarket={state.selectedMarket}
        onSelect={(market) => dispatch({ type: 'selectMarket', market })}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="mt-6 space-y-4"
      >
        {state.tag === 'error' && state.message && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        {state.tag === 'success' && state.message && (
          <p className="text-sm text-green-600">{state.message}</p>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected market</label>
          <div className="rounded-md border border-dashed p-3 text-sm">
            {state.selectedMarket
              ? state.selectedMarket.question ||
                state.selectedMarket.title ||
                state.selectedMarket.slug
              : 'No market selected.'}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Pick winner</label>
          {outcomes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Select a market with outcomes to continue.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {outcomes.map((outcome) => (
                  <Button
                    key={outcome}
                    type="button"
                    variant={state.selectedOutcome === outcome ? 'default' : 'outline'}
                    onClick={() => dispatch({ type: 'selectOutcome', outcome })}
                  >
                    {outcome}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3">
                {outcomeDetails.map((detail) => (
                  <OutcomeDetails
                    key={detail.outcome}
                    outcome={detail.outcome}
                    tokenId={detail.tokenId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Bet amount (USDC)</label>
          <Input
            value={state.betAmount}
            onChange={(e) => dispatch({ type: 'setBetAmount', amount: e.target.value })}
            placeholder="e.g. 250"
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          {state.tag === 'submitting' ? 'Creating...' : 'Create Prediction'}
        </Button>
      </form>
    </div>
  );
}
