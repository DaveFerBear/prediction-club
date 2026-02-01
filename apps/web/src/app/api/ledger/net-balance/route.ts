import { NextRequest } from 'next/server';
import { LedgerController } from '@/controllers';
import { apiResponse, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

/**
 * GET /api/ledger/net-balance
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const balance = await LedgerController.getUserNetBalance({ userId: user.id });
    return apiResponse({ balance });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error fetching net balance:', error);
    return serverError();
  }
}
