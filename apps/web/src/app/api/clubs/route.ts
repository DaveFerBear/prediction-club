import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ClubController, ClubError } from '@/controllers';
import { apiResponse, apiError, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
});

/**
 * POST /api/clubs
 * Create a new club
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const parsed = createClubSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const club = await ClubController.create(parsed.data, user.id);
    return apiResponse(club, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return apiError(error.code, error.message, 409);
    }
    console.error('Error creating club:', error);
    return serverError();
  }
}

/**
 * GET /api/clubs
 * List public clubs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const publicOnly = searchParams.get('public') !== 'false';

    const result = await ClubController.list({ page, pageSize, publicOnly });
    return apiResponse(result);
  } catch (error) {
    console.error('Error listing clubs:', error);
    return serverError();
  }
}
