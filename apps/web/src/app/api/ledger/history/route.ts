import { NextRequest } from 'next/server';
import { z } from 'zod';
import { LedgerController } from '@/controllers';
import { apiResponse, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const historySchema = z.object({
  clubId: z.string().optional(),
});

/**
 * GET /api/ledger/history
 * Optional query: clubId
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const parsed = historySchema.safeParse({
      clubId: searchParams.get('clubId') ?? undefined,
    });

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const entries = await LedgerController.getUserLedgerHistory({
      userId: user.id,
      clubId: parsed.data.clubId,
    });

    return apiResponse(entries);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error fetching ledger history:', error);
    return serverError();
  }
}
