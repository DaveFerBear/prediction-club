import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApplicationController, ApplicationError } from '@/controllers';
import { apiResponse, apiError, validationError, notFoundError, serverError } from '@/lib/api';

const applySchema = z.object({
  message: z.string().max(500).optional(),
});

/**
 * POST /api/clubs/[slug]/apply
 * Apply to join a club
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // TODO: Get authenticated user from session
    const userId = 'placeholder-user-id';

    const application = await ApplicationController.apply({
      clubSlug: params.slug,
      userId,
      message: parsed.data.message,
    });

    return apiResponse(application, 201);
  } catch (error) {
    if (error instanceof ApplicationError) {
      if (error.code === 'CLUB_NOT_FOUND') {
        return notFoundError('Club');
      }
      return apiError(error.code, error.message, 409);
    }
    console.error('Error creating application:', error);
    return serverError();
  }
}
