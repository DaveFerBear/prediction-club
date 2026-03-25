import { ClobClient } from '@polymarket/clob-client';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CLOB_URL } from './polymarket';

type CacheEntry = {
  midpoint: string;
  fetchedAt: number;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/**
 * Batch-fetch midpoint prices for a set of Polymarket token IDs.
 *
 * - Deduplicates input token IDs.
 * - Returns cached values within the TTL window.
 * - Uses Promise.allSettled so partial failures don't block the rest.
 * - Returns an empty map on total failure (graceful degradation).
 */
export async function fetchMidpointPrices(
  tokenIds: string[]
): Promise<Map<string, string>> {
  const now = Date.now();
  const unique = [...new Set(tokenIds)];
  const result = new Map<string, string>();
  const uncached: string[] = [];

  for (const id of unique) {
    const entry = cache.get(id);
    if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
      result.set(id, entry.midpoint);
    } else {
      uncached.push(id);
    }
  }

  if (uncached.length === 0) return result;

  const clobClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID);
  const settled = await Promise.allSettled(
    uncached.map(async (tokenId) => {
      const midpoint = await clobClient.getMidpoint(tokenId);
      return { tokenId, midpoint };
    })
  );

  let failures = 0;
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      failures += 1;
      console.warn('[polymarket-prices] CLOB getMidpoint failed:', outcome.reason);
      continue;
    }
    const { tokenId, midpoint: raw } = outcome.value;
    if (raw == null || raw === '') continue;
    // ClobClient.getMidpoint() may return a string or an object like { mid: "0.55" }
    const midpoint =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'mid' in raw
          ? (raw as { mid: string }).mid
          : null;
    if (midpoint == null || midpoint === '') continue;
    cache.set(tokenId, { midpoint, fetchedAt: now });
    result.set(tokenId, midpoint);
  }
  if (failures > 0) {
    console.warn(`[polymarket-prices] ${failures}/${uncached.length} midpoint fetches failed`);
  }

  return result;
}
