import { NextRequest } from 'next/server';
import { GammaController } from '@/controllers';
import { apiResponse, serverError } from '@/lib/api';

/**
 * GET /api/markets
 * List markets or search Gamma API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const closed = searchParams.get('closed') === 'true';
    const activeParam = searchParams.get('active');
    const active = activeParam === 'true' ? true : activeParam === 'false' ? false : undefined;

    if (q) {
      const result = await GammaController.publicSearch({
        q,
        page: 0,
        limitPerType: limit,
        keepClosedMarkets: closed ? 1 : 0,
      });

      return apiResponse({
        mode: 'search',
        items: result.events ?? [],
        pagination: result.pagination ?? null,
      });
    }

    const markets = await GammaController.listMarkets({ limit, offset, closed, active });
    const filtered = q
      ? markets.filter((item) => {
          const title = (item as { question?: string; title?: string; slug?: string }).question
            ?? (item as { question?: string; title?: string; slug?: string }).title
            ?? (item as { question?: string; title?: string; slug?: string }).slug
            ?? '';
          return title.toLowerCase().includes(q.toLowerCase());
        })
      : markets;
    return apiResponse({
      mode: 'markets',
      items: filtered,
      pagination: {
        limit,
        offset,
        nextOffset: offset + limit,
      },
    });
  } catch (error) {
    console.error('Error fetching Gamma markets:', error);
    return serverError();
  }
}
