import { NextRequest } from 'next/server';
import { z } from 'zod';
import { VaultController, VaultError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, forbiddenError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const withdrawSchema = z.object({
  amount: z.string().refine((val) => {
    try {
      return BigInt(val) > BigInt(0);
    } catch {
      return false;
    }
  }, 'Amount must be a positive number'),
});

/**
 * POST /api/clubs/[slug]/withdraw
 * Request a withdrawal from the club vault
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = withdrawSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const result = await VaultController.requestWithdraw({
      clubSlug: params.slug,
      userId: user.id,
      amount: parsed.data.amount,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof VaultError) {
      if (error.code === 'CLUB_NOT_FOUND') {
        return notFoundError('Club');
      }
      if (error.code === 'NOT_A_MEMBER') {
        return forbiddenError(error.message);
      }
      return apiError(error.code, error.message, 400);
    }
    console.error('Error requesting withdrawal:', error);
    return serverError();
  }
}
