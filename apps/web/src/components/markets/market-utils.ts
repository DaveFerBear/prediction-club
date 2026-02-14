import type { MarketItem } from '@/hooks/use-market-search';

function parseMaybeStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function getMarketTitle(market: MarketItem | null) {
  if (!market) return 'Untitled market';
  return market.question || market.title || market.slug || 'Untitled market';
}

export function getMarketDescription(market: MarketItem | null) {
  if (!market) return '';
  return market.description || market.subtitle || '';
}

export function getMarketKey(market: MarketItem) {
  return String(market.id ?? market.slug ?? market.eventId ?? '');
}

export function getMarketImage(market: MarketItem) {
  return market.image || market.imageUrl || market.icon || '';
}

export function getMarketUrl(market: MarketItem) {
  if (market.url) return market.url;
  if (market.slug) return `https://polymarket.com/market/${market.slug}`;
  return '';
}

export function formatMarketUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

export function formatCompactNumber(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatOutcomePrice(priceValue: string) {
  const numeric = Number(priceValue);
  if (!Number.isFinite(numeric)) return priceValue;
  const percentage = numeric <= 1 ? numeric * 100 : numeric;
  return `${percentage.toFixed(0)}%`;
}

export function getMarketOutcomes(market: MarketItem): Array<{ outcome: string; price: string }> {
  const outcomes = parseMaybeStringArray(market.outcomes);
  const prices = parseMaybeStringArray(market.outcomePrices);
  if (outcomes.length === 0) return [];

  return outcomes.map((outcome, index) => ({
    outcome,
    price: prices[index] ?? '—',
  }));
}

export function getMarketStatus(market: MarketItem) {
  if (market.closed) return { label: 'Closed', variant: 'secondary' as const };
  if (market.active === false) return { label: 'Inactive', variant: 'outline' as const };
  return { label: 'Open', variant: 'default' as const };
}

export function getMarketIdentifier(market: MarketItem | null) {
  if (!market) return '';
  return market.slug?.trim() || (market.id ? String(market.id) : '');
}
