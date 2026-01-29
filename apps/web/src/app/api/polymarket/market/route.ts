import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClobClient } from '@polymarket/clob-client';
import { apiResponse, validationError, serverError } from '@/lib/api';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CLOB_URL } from '@/lib/polymarket';

const paramsSchema = z.object({
  tokenId: z.string().min(1),
});

/**
 * GET /api/polymarket/market
 * Fetch price + orderbook details for a Polymarket CLOB token.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = paramsSchema.safeParse({
      tokenId: searchParams.get('tokenId'),
    });

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const clobClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID);
    const tokenId = parsed.data.tokenId;

    const [buyPrice, sellPrice, midpoint, orderbook] = await Promise.all([
      clobClient.getPrice(tokenId, 'buy'),
      clobClient.getPrice(tokenId, 'sell'),
      clobClient.getMidpoint(tokenId),
      clobClient.getOrderBook(tokenId),
    ]);

    return apiResponse({
      tokenId,
      price: {
        buy: buyPrice ?? null,
        sell: sellPrice ?? null,
        midpoint: midpoint ?? null,
      },
      orderbook: {
        bids: orderbook?.bids ?? [],
        asks: orderbook?.asks ?? [],
        minOrderSize: orderbook?.min_order_size ?? null,
        tickSize: orderbook?.tick_size ?? null,
        lastTradePrice: orderbook?.last_trade_price ?? null,
        timestamp: orderbook?.timestamp ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching Polymarket market details:', error);
    return serverError();
  }
}
