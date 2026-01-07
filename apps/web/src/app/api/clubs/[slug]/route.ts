import { NextRequest } from 'next/server';
import { ClubController, ClubError } from '@/controllers';
import { apiResponse, notFoundError, serverError } from '@/lib/api';

/**
 * GET /api/clubs/[slug]
 * Get a club by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const club = await ClubController.getBySlug(params.slug);
    return apiResponse(club);
  } catch (error) {
    if (error instanceof ClubError && error.code === 'NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error fetching club:', error);
    return serverError();
  }
}
