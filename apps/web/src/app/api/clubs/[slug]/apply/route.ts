import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApplicationController, ApplicationError } from '@/controllers';
import {
  apiResponse,
  apiError,
  validationError,
  notFoundError,
  unauthorizedError,
  serverError,
} from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const applySchema = z.object({
  message: z.string().max(500).optional(),
});

/**
 * POST /api/clubs/[slug]/apply
 * Apply to join a club
 */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = applySchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const application = await ApplicationController.apply({
      clubSlug: params.slug,
      userId: user.id,
      message: parsed.data.message,
    });

    return apiResponse(application, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
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
