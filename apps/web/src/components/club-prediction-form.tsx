'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';
import { parseUnits } from 'viem';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  CardContent,
  Input,
} from '@prediction-club/ui';
import { useCreatePrediction } from '@/hooks/use-create-prediction';
import { usePolymarketMarketData } from '@/hooks/use-polymarket-market-data';
import { useMarketDetails, useMarketSearch, type ClubDetail } from '@/hooks';
import type { MarketItem } from '@/hooks/use-market-search';

type PredictionFormState = {
  tag: 'idle' | 'submitting' | 'success' | 'error';
  selectedEvent: MarketItem | null;
  selectedMarket: MarketItem | null;
  selectedOutcome: string | null;
  betAmount: string;
  message: string | null;
};

type PredictionFormAction =
  | { type: 'selectEvent'; event: MarketItem | null }
  | { type: 'selectMarket'; market: MarketItem | null }
  | { type: 'selectOutcome'; outcome: string | null }
  | { type: 'setBetAmount'; amount: string }
  | { type: 'clearMessage' }
  | { type: 'submitStart' }
  | { type: 'submitSuccess'; message: string }
  | { type: 'submitError'; message: string };

const initialState: PredictionFormState = {
  tag: 'idle',
  selectedEvent: null,
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
    case 'selectEvent':
      return {
        ...state,
        selectedEvent: action.event,
        selectedMarket: null,
        selectedOutcome: null,
      };
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
        selectedEvent: null,
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

function getEventTitle(event: MarketItem | null) {
  if (!event) return 'Event';
  return event.question || event.title || event.subtitle || event.slug || 'Event';
}

function getEventKey(event: MarketItem) {
  return String(event.id ?? event.slug ?? event.eventId ?? '');
}

function getEventUrl(event: MarketItem) {
  if (event.url) return event.url;
  if (event.slug) return `https://polymarket.com/market/${event.slug}`;
  return '';
}

function getEventImage(event: MarketItem) {
  return event.image || event.image_url || event.icon || '';
}

function formatUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
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
  const [accordionValue, setAccordionValue] = useState<'event' | 'market' | 'winner' | ''>('event');
  const [loadingMarketKey, setLoadingMarketKey] = useState<string | null>(null);
  const { createPrediction } = useCreatePrediction(clubSlug);
  const { fetchMarketDetails } = useMarketDetails();
  const { query, setQuery, searching, error, results, runSearch } = useMarketSearch();

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
  const availableMarkets = useMemo(
    () => (Array.isArray(state.selectedEvent?.markets) ? state.selectedEvent?.markets ?? [] : []),
    [state.selectedEvent]
  );
  const eventResults = useMemo(
    () => results.filter((item) => Array.isArray(item.markets) && item.markets.length > 0),
    [results]
  );

  const canOpenSection = useCallback(
    (value: string | undefined) => {
      if (!value) return false;
      if (value === 'market' && !state.selectedEvent) return false;
      if (value === 'winner' && !state.selectedMarket) return false;
      return true;
    },
    [state.selectedEvent, state.selectedMarket]
  );

  const handleAccordionChange = useCallback(
    (value: string) => {
      if (!value) {
        setAccordionValue('');
        return;
      }
      if (!canOpenSection(value)) return;
      setAccordionValue(value as 'event' | 'market' | 'winner');
    },
    [canOpenSection]
  );

  const handleSelectEvent = useCallback((event: MarketItem) => {
    dispatch({ type: 'selectEvent', event });
    setAccordionValue('market');
  }, []);

  const handleSelectMarket = useCallback(
    async (market: MarketItem) => {
      const key = String(market.id ?? market.slug ?? market.eventId ?? '');
      setLoadingMarketKey(key);
      try {
        const details = await fetchMarketDetails(market);
        dispatch({ type: 'selectMarket', market: details ?? market });
      } catch {
        dispatch({ type: 'selectMarket', market });
      } finally {
        setLoadingMarketKey(null);
        setAccordionValue('winner');
      }
    },
    [fetchMarketDetails]
  );

  const canSubmit =
    isAdmin &&
    state.tag !== 'submitting' &&
    !!state.selectedMarket &&
    !!state.selectedOutcome &&
    !!state.betAmount.trim();
  const canPickMarket = !!state.selectedEvent;
  const canPickWinner = !!state.selectedMarket;

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
        setAccordionValue('event');
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
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={handleAccordionChange}
        >
          <AccordionItem value="event">
            <AccordionTrigger className="justify-start gap-3">
              <div className="flex flex-1 items-center">
                <span>Select event</span>
                <span className="ml-auto text-right text-xs text-muted-foreground">
                  {state.selectedEvent ? getEventTitle(state.selectedEvent) : 'Pick an event'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row px-1">
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          runSearch();
                        }
                      }}
                      placeholder="Search Polymarket events"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={searching || !query.trim()}
                      onClick={() => runSearch()}
                    >
                      {searching ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                {eventResults.length > 0 && (
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                    <div className="space-y-2">
                      {eventResults.map((eventItem) => {
                        const key = getEventKey(eventItem);
                        const isSelected =
                          state.selectedEvent && getEventKey(state.selectedEvent) === key;
                        const url = getEventUrl(eventItem);
                        const image = getEventImage(eventItem);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`w-full rounded-md border bg-background p-4 text-left shadow-sm transition hover:bg-muted/40 ${
                              isSelected
                                ? 'border-primary ring-1 ring-primary/30'
                                : 'border-border/70'
                            }`}
                            onClick={() => handleSelectEvent(eventItem)}
                          >
                            <div className="flex items-start gap-4">
                              {image && (
                                <img
                                  src={image}
                                  alt=""
                                  className="h-12 w-12 rounded-md object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">
                                      {getEventTitle(eventItem)}
                                    </div>
                                    {url ? (
                                      <div className="mt-1 truncate text-xs text-muted-foreground">
                                        {formatUrl(url)}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-xs italic text-muted-foreground">
                                        No link
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium text-muted-foreground">
                                    {(eventItem.markets ?? []).length} markets
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {eventResults.length === 0 && query.trim() && !searching && !error && (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      No events found.
                    </CardContent>
                  </Card>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="market">
            <AccordionTrigger
              className={`justify-start gap-3 ${!canPickMarket ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!canPickMarket}
            >
              <div className="flex flex-1 items-center">
                <span>Pick market</span>
                <span className="ml-auto text-right text-xs text-muted-foreground">
                  {state.selectedMarket ? getMarketTitle(state.selectedMarket) : 'Choose a market'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className={!canPickMarket ? 'opacity-50' : ''}>
              {!state.selectedEvent && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Select an event to see available markets.
                </div>
              )}
              {state.selectedEvent && availableMarkets.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  No markets found for this event.
                </div>
              )}
              {state.selectedEvent && availableMarkets.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableMarkets.map((market) => {
                      const key = String(market.id ?? market.slug ?? market.eventId ?? '');
                      const isSelected =
                        state.selectedMarket &&
                        String(
                          state.selectedMarket.id ??
                            state.selectedMarket.slug ??
                            state.selectedMarket.eventId ??
                            ''
                        ) === key;
                      const outcomesCount = Array.isArray(market.outcomes)
                        ? market.outcomes.length
                        : 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={loadingMarketKey === key}
                          aria-busy={loadingMarketKey === key}
                          className={`w-full rounded-md border bg-background p-4 text-left text-sm shadow-sm transition hover:bg-muted/40 ${
                            isSelected
                              ? 'border-primary ring-1 ring-primary/30'
                              : 'border-border/70'
                          }`}
                          onClick={() => handleSelectMarket(market)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">
                                {getMarketTitle(market)}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {outcomesCount} outcomes
                              </div>
                            </div>
                            {loadingMarketKey === key && (
                              <span className="text-xs text-muted-foreground">Loading…</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="winner">
            <AccordionTrigger
              className={`justify-start gap-3 ${!canPickWinner ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!canPickWinner}
            >
              <div className="flex flex-1 items-center">
                <span>Pick winner</span>
                <span className="ml-auto text-right text-xs text-muted-foreground">
                  {state.selectedOutcome ?? 'Choose an outcome'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className={!canPickWinner ? 'opacity-50' : ''}>
              {!state.selectedMarket && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Pick a market to view outcomes.
                </div>
              )}
              {state.selectedMarket && outcomes.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  No outcomes available for this market.
                </div>
              )}
              {state.selectedMarket && outcomes.length > 0 && (
                <div className="space-y-4">
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
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
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
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </form>
    </div>
  );
}
