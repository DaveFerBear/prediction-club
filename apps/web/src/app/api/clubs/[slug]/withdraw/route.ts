import { NextRequest } from 'next/server';
import { z } from 'zod';
import { VaultController, VaultError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, forbiddenError, serverError } from '@/lib/api';

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
    const body = await request.json();
    const parsed = withdrawSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // TODO: Get authenticated user from session
    const userId = 'placeholder-user-id';

    const result = await VaultController.requestWithdraw({
      clubSlug: params.slug,
      userId,
      amount: parsed.data.amount,
    });

    return apiResponse(result);
  } catch (error) {
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
