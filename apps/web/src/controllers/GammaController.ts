const GAMMA_BASE_URL = 'https://gamma-api.polymarket.com';

export interface ListMarketsInput {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  order?: string;
  slug?: string;
  id?: string | number;
  endDateMin?: string;
  endDateMax?: string;
}

export interface PublicSearchInput {
  q: string;
  page?: number;
  limitPerType?: number;
  keepClosedMarkets?: number;
  sort?: string;
  ascending?: boolean;
  type?: string;
  eventsStatus?: string;
  eventsTag?: string;
  presets?: string[];
}

type GammaParamValue = string | number | boolean | string[];

async function fetchGamma<T>(path: string, params?: Record<string, GammaParamValue>) {
  const url = new URL(path, GAMMA_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => url.searchParams.append(key, String(entry)));
      } else {
        url.searchParams.set(key, String(value));
      }
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
    const {
      limit = 50,
      offset = 0,
      active = true,
      closed = false,
      order,
      slug,
      id,
      endDateMin,
      endDateMax,
    } = input;
    const params: Record<string, string | number | boolean> = {
      limit,
      offset,
      closed,
      active,
    };
    if (order) {
      params.order = order;
    }
    if (slug) {
      params.slug = slug;
    }
    if (id !== undefined) {
      params.id = id;
    }
    if (endDateMin) {
      params.end_date_min = endDateMin;
    }
    if (endDateMax) {
      params.end_date_max = endDateMax;
    }

    return fetchGamma<unknown[]>('/markets', params);
  }

  /**
   * Public search across events/tags/profiles.
   */
  static async publicSearch(input: PublicSearchInput) {
    const {
      q,
      page = 1,
      limitPerType = 20,
      keepClosedMarkets = 0,
      sort = 'volume_24hr',
      ascending,
      type = 'events',
      eventsStatus = 'active',
      eventsTag,
      presets = ['EventsTitle', 'Events'],
    } = input;
    const params: Record<string, GammaParamValue> = {
      q,
      page,
      limit_per_type: limitPerType,
      keep_closed_markets: keepClosedMarkets,
      search_tags: false,
      search_profiles: false,
      type,
      events_status: eventsStatus,
      sort,
      presets,
    };
    if (eventsTag) {
      params.events_tag = eventsTag;
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
