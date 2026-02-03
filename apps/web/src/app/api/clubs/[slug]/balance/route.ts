import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClubController, LedgerController } from '@/controllers';
import { apiResponse, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const paramsSchema = z.object({
  slug: z.string().min(1),
});

/**
 * GET /api/clubs/:slug/balance
 * Returns balance and ledger history for the authenticated user scoped to a club.
 */
export async function GET(request: NextRequest, context: { params: unknown }) {
  try {
    const user = await requireAuth(request);
    const parsed = paramsSchema.safeParse(context.params);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const club = await ClubController.getBySlug(parsed.data.slug);

    const [balance, history] = await Promise.all([
      LedgerController.getUserClubBalance({ userId: user.id, clubId: club.id }),
      LedgerController.getUserLedgerHistory({ userId: user.id, clubId: club.id }),
    ]);

    return apiResponse({ balance, history });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error fetching club balance:', error);
    return serverError();
  }
}
