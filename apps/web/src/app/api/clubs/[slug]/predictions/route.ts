import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PredictionRoundController, PredictionRoundError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, forbiddenError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
const createPredictionRoundSchema = z.object({
  conditionId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  marketId: z.string().min(1).max(100),
  marketSlug: z.string().min(1).max(200),
  marketTitle: z.string().max(200).optional(),
  commentary: z.string().max(8000).optional(),
  commitAmount: z
    .string()
    .regex(/^\d+$/, 'commitAmount must be a base-unit integer string')
    .refine((value) => BigInt(value) >= 1_000_000n, 'Minimum order amount is 1.00 USDC'),
  targetTokenId: z.string().min(1),
  targetOutcome: z.string().min(1),
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

    const predictionRound = await PredictionRoundController.createPredictionRound({
      clubSlug: params.slug,
      adminUserId: user.id,
      ...parsed.data,
    });

    return apiResponse(predictionRound, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof PredictionRoundError) {
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

    const result = await PredictionRoundController.listPredictionRounds({
      clubSlug: params.slug,
      page,
      pageSize,
      status,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof PredictionRoundError && error.code === 'CLUB_NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error listing prediction rounds:', error);
    return serverError();
  }
}
