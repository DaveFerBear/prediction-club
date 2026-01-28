const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';

export interface ListMarketsInput {
  limit?: number;
  offset?: number;
  closed?: boolean;
  order?: string;
}

export interface PublicSearchInput {
  q: string;
  page?: number;
  limitPerType?: number;
  keepClosedMarkets?: number;
  sort?: string;
  ascending?: boolean;
}

async function fetchGamma<T>(path: string, params?: Record<string, string | number | boolean>) {
  const url = new URL(path, GAMMA_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gamma API error (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export class GammaController {
  /**
   * List markets from Gamma API.
   */
  static async listMarkets(input: ListMarketsInput = {}) {
    const { limit = 50, offset = 0, closed = false, order } = input;
    const params: Record<string, string | number | boolean> = {
      limit,
      offset,
      closed,
    };
    if (order) {
      params.order = order;
    }

    return fetchGamma<unknown[]>('/markets', params);
  }

  /**
   * Public search across events/tags/profiles.
   */
  static async publicSearch(input: PublicSearchInput) {
    const { q, page = 0, limitPerType = 20, keepClosedMarkets = 0, sort, ascending } = input;
    const params: Record<string, string | number | boolean> = {
      q,
      page,
      limit_per_type: limitPerType,
      keep_closed_markets: keepClosedMarkets,
      search_tags: false,
      search_profiles: false,
    };
    if (sort) {
      params.sort = sort;
    }
    if (typeof ascending === 'boolean') {
      params.ascending = ascending;
    }

    return fetchGamma<{
      events?: unknown[];
      tags?: unknown[];
      profiles?: unknown[];
      pagination?: unknown;
    }>('/public-search', params);
  }
}
