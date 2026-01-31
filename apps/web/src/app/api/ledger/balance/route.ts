import { NextRequest } from 'next/server';
import { z } from 'zod';
import { LedgerController } from '@/controllers';
import { apiResponse, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const balanceSchema = z.object({
  clubId: z.string().min(1),
});

/**
 * GET /api/ledger/balance
 * Query: clubId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const parsed = balanceSchema.safeParse({
      clubId: searchParams.get('clubId') ?? '',
    });

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const balance = await LedgerController.getUserClubBalance({
      userId: user.id,
      clubId: parsed.data.clubId,
    });

    return apiResponse({ balance });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error fetching ledger balance:', error);
    return serverError();
  }
}
