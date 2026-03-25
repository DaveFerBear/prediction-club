import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiResponse, validationError, serverError } from '@/lib/api';
import { POLYMARKET_CLOB_URL } from '@/lib/polymarket';

const paramsSchema = z.object({
  tokenId: z.string().min(1),
  interval: z.string().default('max'),
  fidelity: z.coerce.number().int().positive().default(60),
});

export type PriceHistoryPoint = { t: number; p: number };

/**
 * GET /api/polymarket/prices-history
 * Proxy to Polymarket CLOB /prices-history endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = paramsSchema.safeParse({
      tokenId: searchParams.get('tokenId'),
      interval: searchParams.get('interval') ?? undefined,
      fidelity: searchParams.get('fidelity') ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const { tokenId, interval, fidelity } = parsed.data;
    const url = new URL('/prices-history', POLYMARKET_CLOB_URL);
    url.searchParams.set('market', tokenId);
    url.searchParams.set('interval', interval);
    url.searchParams.set('fidelity', fidelity.toString());

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error('Polymarket prices-history error:', res.status, await res.text());
      return serverError('Failed to fetch price history');
    }

    const data = (await res.json()) as { history: PriceHistoryPoint[] };
    return apiResponse(data);
  } catch (error) {
    console.error('Error fetching Polymarket price history:', error);
    return serverError();
  }
}
