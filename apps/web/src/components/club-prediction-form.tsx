'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Skeleton,
  Slider,
} from '@prediction-club/ui';
import { useCreatePrediction } from '@/hooks/use-create-prediction';
import { usePolymarketMarketData } from '@/hooks/use-polymarket-market-data';
import { useMarketDetails, useMarketSearch, useClubWallet, type ClubDetail } from '@/hooks';
import type { MarketItem } from '@/hooks/use-market-search';
import { MarketCard } from '@/components/markets/market-card';
import { MarketDetailsPanel } from '@/components/markets/market-details-panel';
import {
  formatMarketUrl,
  formatOutcomePrice,
  getMarketKey,
  getMarketOutcomes,
  getMarketTitle,
  getMarketUrl,
} from '@/components/markets/market-utils';

type PredictionFormState = {
  tag: 'idle' | 'submitting' | 'error';
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

function formatUsdc(value: number) {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getEventTitle(event: MarketItem | null) {
  if (!event) return 'Event';
  return event.question || event.title || event.subtitle || event.slug || 'Event';
}

function getConditionId(market: MarketItem | null) {
  return market?.conditionId?.trim() || '';
}

function getMarketId(market: MarketItem | null) {
  if (!market) return '';
  const value = market.id ?? market.eventId;
  return value !== undefined ? String(value) : '';
}

function getMarketSlug(market: MarketItem | null) {
  return market?.slug?.trim() || '';
}

function getOutcomeTokenId(market: MarketItem | null, outcome: string | null) {
  if (!market || !outcome) return null;
  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
  const tokenIds = Array.isArray(market.clobTokenIds) ? market.clobTokenIds : [];
  const index = outcomes.findIndex((entry) => entry === outcome);
  if (index < 0) return null;
  return tokenIds[index] ?? null;
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
        <div className="text-muted-foreground">Buy: {formatPrice(data.price.buy)}</div>
        <div className="text-muted-foreground">Sell: {formatPrice(data.price.sell)}</div>
        <div className="text-muted-foreground">Mid: {formatPrice(data.price.midpoint)}</div>
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
  prefillMarket,
}: {
  club: ClubDetail;
  clubSlug: string;
  address: string | null;
  prefillMarket?: {
    marketSlug?: string;
    marketId?: string;
    conditionId?: string;
    outcome?: string;
    title?: string;
  };
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(predictionFormReducer, initialState);
  const [accordionValue, setAccordionValue] = useState<'event' | 'market' | 'winner' | 'bet' | ''>(
    'event'
  );
  const [loadingMarketKey, setLoadingMarketKey] = useState<string | null>(null);
  const [prefillResolvedMarket, setPrefillResolvedMarket] = useState<MarketItem | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const appliedPrefillKeyRef = useRef<string | null>(null);
  const { createPrediction } = useCreatePrediction(clubSlug);
  const { fetchMarketDetails } = useMarketDetails();
  const { query, setQuery, searching, error, results, runSearch } = useMarketSearch();
  const { wallet: clubWallet, isLoading: isWalletLoading } = useClubWallet(clubSlug);
  const walletBalanceRaw = clubWallet?.balance ?? '0';
  const balanceDisplay = formatUsdc(Number(walletBalanceRaw) / 1_000_000);

  const members = club.members ?? [];
  const isAdmin = useMemo(() => {
    if (!address) return false;
    const member = members.find(
      (item) => item.user.walletAddress.toLowerCase() === address.toLowerCase()
    );
    return member?.role === 'ADMIN';
  }, [address, members]);

  const outcomes = useMemo(
    () =>
      Array.isArray(state.selectedMarket?.outcomes) ? (state.selectedMarket?.outcomes ?? []) : [],
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
    () => (Array.isArray(state.selectedEvent?.markets) ? (state.selectedEvent?.markets ?? []) : []),
    [state.selectedEvent]
  );
  const eventResults = useMemo(
    () => results.filter((item) => Array.isArray(item.markets) && item.markets.length > 0),
    [results]
  );
  const prefillLookupKey = useMemo(
    () => prefillMarket?.marketSlug?.trim() || prefillMarket?.marketId?.trim() || '',
    [prefillMarket?.marketId, prefillMarket?.marketSlug]
  );

  useEffect(() => {
    if (!prefillLookupKey) {
      setPrefillResolvedMarket(null);
      setPrefillError(null);
      setPrefillLoading(false);
      return;
    }

    let cancelled = false;
    setPrefillLoading(true);
    setPrefillError(null);

    const marketSeed: MarketItem = {
      slug: prefillMarket?.marketSlug,
      id: prefillMarket?.marketId,
      conditionId: prefillMarket?.conditionId,
      title: prefillMarket?.title,
    };

    fetchMarketDetails(marketSeed)
      .then((market) => {
        if (cancelled) return;
        setPrefillResolvedMarket(market ?? marketSeed);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPrefillResolvedMarket(marketSeed);
        setPrefillError(error instanceof Error ? error.message : 'Failed to load prefilled market');
      })
      .finally(() => {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    fetchMarketDetails,
    prefillLookupKey,
    prefillMarket?.conditionId,
    prefillMarket?.marketId,
    prefillMarket?.marketSlug,
    prefillMarket?.title,
  ]);

  useEffect(() => {
    if (!prefillResolvedMarket || !prefillLookupKey) return;
    if (appliedPrefillKeyRef.current === prefillLookupKey) return;
    if (state.selectedMarket) return;

    dispatch({ type: 'selectMarket', market: prefillResolvedMarket });

    const nextOutcomes = getMarketOutcomes(prefillResolvedMarket).map((item) => item.outcome);
    const requestedOutcome = prefillMarket?.outcome?.trim();
    if (requestedOutcome && nextOutcomes.includes(requestedOutcome)) {
      dispatch({ type: 'selectOutcome', outcome: requestedOutcome });
      setAccordionValue('bet');
    } else {
      setAccordionValue('winner');
    }
    appliedPrefillKeyRef.current = prefillLookupKey;
  }, [prefillLookupKey, prefillMarket?.outcome, prefillResolvedMarket, state.selectedMarket]);

  const canOpenSection = useCallback(
    (value: string | undefined) => {
      if (!value) return false;
      if (value === 'market' && !state.selectedEvent) return false;
      if (value === 'winner' && !state.selectedMarket) return false;
      if (value === 'bet' && !state.selectedOutcome) return false;
      return true;
    },
    [state.selectedEvent, state.selectedMarket, state.selectedOutcome]
  );

  const handleAccordionChange = useCallback(
    (value: string) => {
      if (!value) {
        setAccordionValue('');
        return;
      }
      if (!canOpenSection(value)) return;
      setAccordionValue(value as 'event' | 'market' | 'winner' | 'bet');
    },
    [canOpenSection]
  );

  const handleSelectEvent = useCallback((event: MarketItem) => {
    dispatch({ type: 'selectEvent', event });
    setAccordionValue('market');
  }, []);

  const handleSelectMarket = useCallback(
    async (market: MarketItem) => {
      const key = getMarketKey(market);
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
  const canPickBet = !!state.selectedOutcome;
  const maxBalance = Number(walletBalanceRaw) / 1_000_000;
  const minBet = 1.0;
  const sliderMax = maxBalance > minBet ? maxBalance : minBet;
  const numericBet = Number(state.betAmount);
  const sliderValue = Number.isFinite(numericBet) ? clamp(numericBet, minBet, sliderMax) : minBet;
  const commitPercent =
    maxBalance > 0 && Number.isFinite(sliderValue) ? (sliderValue / maxBalance) * 100 : 0;

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

    if (BigInt(commitAmount) < 1_000_000n) {
      dispatch({ type: 'submitError', message: 'Minimum order amount is 1.00 USDC.' });
      return;
    }

    if (members.length === 0) {
      dispatch({ type: 'submitError', message: 'No active members found.' });
      return;
    }

    dispatch({ type: 'submitStart' });

    try {
      const marketTitle = `${getMarketTitle(state.selectedMarket)} — ${state.selectedOutcome}`;
      const conditionId = getConditionId(state.selectedMarket);
      const marketId = getMarketId(state.selectedMarket);
      const marketSlug = getMarketSlug(state.selectedMarket);
      const tokenId = getOutcomeTokenId(state.selectedMarket, state.selectedOutcome);

      if (!conditionId) {
        dispatch({ type: 'submitError', message: 'Missing condition ID for market.' });
        return;
      }

      if (!marketId) {
        dispatch({ type: 'submitError', message: 'Missing market ID.' });
        return;
      }

      if (!marketSlug) {
        dispatch({ type: 'submitError', message: 'Missing market slug.' });
        return;
      }

      if (!tokenId) {
        dispatch({ type: 'submitError', message: 'Missing market token id for outcome.' });
        return;
      }
      const response = await createPrediction({
        conditionId,
        marketId,
        marketSlug,
        marketTitle,
        commitAmount,
        targetTokenId: tokenId,
        targetOutcome: state.selectedOutcome ?? '',
      });

      if (response?.success) {
        router.push(`/clubs/${clubSlug}`);
        return;
      }

      dispatch({ type: 'submitError', message: 'Failed to create prediction.' });
    } catch (err) {
      dispatch({
        type: 'submitError',
        message: err instanceof Error ? err.message : 'Failed to create prediction.',
      });
    }
  }, [
    clubSlug,
    createPrediction,
    isAdmin,
    members,
    router,
    state.betAmount,
    state.selectedMarket,
    state.selectedOutcome,
  ]);

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
        {prefillLookupKey ? (
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            {prefillLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-4 w-72" />
              </div>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Prefilled market</p>
                <p className="font-medium">
                  {state.selectedMarket
                    ? getMarketTitle(state.selectedMarket)
                    : prefillResolvedMarket
                      ? getMarketTitle(prefillResolvedMarket)
                      : prefillMarket?.title || prefillLookupKey}
                </p>
              </>
            )}
          </div>
        ) : null}
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
                <div className="flex flex-col gap-2 sm:flex-row">
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

                {error && <p className="text-sm text-destructive">{error}</p>}
                {prefillError && <p className="text-sm text-muted-foreground">{prefillError}</p>}

                {searching && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                )}

                {!searching && eventResults.length > 0 && (
                  <div className="max-h-96 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                    <div className="space-y-2">
                      {eventResults.map((eventItem) => {
                        const key = getMarketKey(eventItem);
                        const isSelected =
                          state.selectedEvent && getMarketKey(state.selectedEvent) === key;
                        const url = getMarketUrl(eventItem);
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
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">
                                      {getEventTitle(eventItem)}
                                    </div>
                                    {url ? (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 block truncate text-xs text-muted-foreground underline decoration-transparent hover:decoration-current"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        {formatMarketUrl(url)}
                                      </a>
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
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    {availableMarkets.map((market) => {
                      const key = getMarketKey(market);
                      const isSelected = Boolean(
                        state.selectedMarket && getMarketKey(state.selectedMarket) === key
                      );
                      return (
                        <div
                          key={key}
                          className="relative"
                        >
                          <MarketCard
                            market={market}
                            selected={isSelected}
                            onSelect={() => handleSelectMarket(market)}
                          />
                          {loadingMarketKey === key ? (
                            <div className="pointer-events-none absolute inset-0 rounded-lg bg-background/70" />
                          ) : null}
                          {loadingMarketKey === key ? (
                            <span className="pointer-events-none absolute right-3 top-3 text-xs text-muted-foreground">
                              Loading...
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <MarketDetailsPanel
                    market={state.selectedMarket}
                    emptyLabel="Choose a market to preview details before selecting an outcome."
                  />
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
                    {outcomes.map((outcome, index) => {
                      const displayPrice = Array.isArray(state.selectedMarket?.outcomePrices)
                        ? state.selectedMarket?.outcomePrices?.[index]
                        : undefined;
                      return (
                        <Button
                          key={outcome}
                          type="button"
                          variant={state.selectedOutcome === outcome ? 'default' : 'outline'}
                          onClick={() => {
                            dispatch({ type: 'selectOutcome', outcome });
                            setAccordionValue('bet');
                          }}
                          className="gap-2"
                        >
                          <span>{outcome}</span>
                          {displayPrice && (
                            <span className="text-xs text-muted-foreground">
                              {formatOutcomePrice(String(displayPrice))}
                            </span>
                          )}
                        </Button>
                      );
                    })}
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
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="bet">
            <AccordionTrigger
              className={`justify-start gap-3 ${!canPickBet ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!canPickBet}
            >
              <div className="flex flex-1 items-center">
                <span>Bet amount</span>
                <span className="ml-auto text-right text-xs text-muted-foreground">
                  {state.betAmount.trim() ? `${state.betAmount} USDC` : 'Enter amount'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className={!canPickBet ? 'opacity-50' : ''}>
              {!state.selectedOutcome && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  Pick a winner to continue.
                </div>
              )}
              {state.selectedOutcome && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bet amount (USDC)</label>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1 space-y-2">
                          <Slider
                            min={minBet}
                            max={sliderMax}
                            step={0.01}
                            value={[sliderValue]}
                            disabled={maxBalance <= 0 || isWalletLoading}
                            onValueChange={(value) => {
                              const nextValue = value[0] ?? minBet;
                              dispatch({
                                type: 'setBetAmount',
                                amount: formatUsdc(nextValue),
                              });
                            }}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>${minBet.toFixed(2)}</span>
                            <span>
                              {isWalletLoading
                                ? 'Checking wallet...'
                                : `Available: ${balanceDisplay} USDC`}
                            </span>
                            <span>${formatUsdc(sliderMax)}</span>
                          </div>
                          {!isWalletLoading && maxBalance > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Committing {commitPercent.toFixed(1)}% of club wallet
                            </div>
                          )}
                        </div>
                        <div className="w-full sm:w-36">
                          <Input
                            value={state.betAmount}
                            onChange={(e) =>
                              dispatch({ type: 'setBetAmount', amount: e.target.value })
                            }
                            placeholder="e.g. 250"
                          />
                        </div>
                      </div>
                    </div>
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
