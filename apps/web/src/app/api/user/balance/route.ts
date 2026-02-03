import { NextRequest } from 'next/server';
import { LedgerController } from '@/controllers';
import { apiResponse, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

/**
 * GET /api/user/balance
 * Returns overall balance and full ledger history for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const [balance, history] = await Promise.all([
      LedgerController.getUserNetBalance({ userId: user.id }),
      LedgerController.getUserLedgerHistory({ userId: user.id }),
    ]);

    return apiResponse({ balance, history });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error fetching user balance:', error);
    return serverError();
  }
}

