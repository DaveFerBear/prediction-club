import { NextRequest } from 'next/server';
import { z } from 'zod';
import { VaultController, VaultError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, forbiddenError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
import { isValidBytes32 } from '@prediction-club/shared';

const createPredictionRoundSchema = z.object({
  cohortId: z.string().refine(isValidBytes32, 'Invalid prediction ID (must be bytes32)'),
  marketRef: z.string().max(500).optional(),
  marketTitle: z.string().max(200).optional(),
  members: z.array(
    z.object({
      userId: z.string(),
      commitAmount: z.string(),
    })
  ),
});

/**
 * POST /api/clubs/[slug]/predictions
 * Create a new prediction round
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = createPredictionRoundSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const predictionRound = await VaultController.createPredictionRound({
      clubSlug: params.slug,
      adminUserId: user.id,
      ...parsed.data,
    });

    return apiResponse(predictionRound, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof VaultError) {
      if (error.code === 'CLUB_NOT_FOUND') {
        return notFoundError('Club');
      }
      if (error.code === 'FORBIDDEN') {
        return forbiddenError(error.message);
      }
      return apiError(error.code, error.message, 400);
    }
    console.error('Error creating prediction round:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs/[slug]/predictions
 * List predictions for a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') || undefined;

    const result = await VaultController.listPredictionRounds({
      clubSlug: params.slug,
      page,
      pageSize,
      status,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof VaultError && error.code === 'CLUB_NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error listing prediction rounds:', error);
    return serverError();
  }
}
