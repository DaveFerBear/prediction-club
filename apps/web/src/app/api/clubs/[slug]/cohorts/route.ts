import { NextRequest } from 'next/server';
import { z } from 'zod';
import { VaultController, VaultError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, forbiddenError, serverError } from '@/lib/api';
import { isValidBytes32 } from '@prediction-club/shared';

const createCohortSchema = z.object({
  cohortId: z.string().refine(isValidBytes32, 'Invalid cohort ID (must be bytes32)'),
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
 * POST /api/clubs/[slug]/cohorts
 * Create a new cohort
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const parsed = createCohortSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // TODO: Get authenticated user from session
    const adminUserId = 'placeholder-user-id';

    const cohort = await VaultController.createCohort({
      clubSlug: params.slug,
      adminUserId,
      ...parsed.data,
    });

    return apiResponse(cohort, 201);
  } catch (error) {
    if (error instanceof VaultError) {
      if (error.code === 'CLUB_NOT_FOUND') {
        return notFoundError('Club');
      }
      if (error.code === 'FORBIDDEN') {
        return forbiddenError(error.message);
      }
      return apiError(error.code, error.message, 400);
    }
    console.error('Error creating cohort:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs/[slug]/cohorts
 * List cohorts for a club
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

    const result = await VaultController.listCohorts({
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
    console.error('Error listing cohorts:', error);
    return serverError();
  }
}
