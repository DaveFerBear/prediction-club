import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClubController, LedgerController } from '@/controllers';
import { apiResponse, validationError, serverError } from '@/lib/api';

const paramsSchema = z.object({
  slug: z.string().min(1),
});

/**
 * GET /api/clubs/:slug/balance
 * Public: Returns aggregate club balance and ledger history (all members).
 */
export async function GET(request: NextRequest, context: { params: unknown }) {
  try {
    const parsed = paramsSchema.safeParse(context.params);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const club = await ClubController.getBySlug(parsed.data.slug);

    const history = await LedgerController.getClubLedgerHistory({ clubId: club.id });
    const balance = history.reduce((sum, entry) => sum + BigInt(entry.amount), 0n).toString();

    return apiResponse({ balance, history });
  } catch (error) {
    console.error('Error fetching club balance:', error);
    return serverError();
  }
}
