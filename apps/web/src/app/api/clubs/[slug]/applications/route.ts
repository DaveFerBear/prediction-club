import { NextRequest } from 'next/server';
import { ApplicationController, ApplicationError, ClubController, ClubError } from '@/controllers';
import { apiResponse, forbiddenError, notFoundError, serverError, unauthorizedError } from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';

/**
 * GET /api/clubs/[slug]/applications
 * List applications for a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);
    const isAdmin = club.members.some(
      (member) => member.userId === user.id && member.role === 'ADMIN' && member.status === 'ACTIVE'
    );
    if (!isAdmin) {
      return forbiddenError('Only club admins can view applications');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;

    const result = await ApplicationController.list({
      clubSlug: params.slug,
      page,
      pageSize,
      status: status || undefined,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError && error.code === 'NOT_FOUND') {
      return notFoundError('Club');
    }
    if (error instanceof ApplicationError && error.code === 'CLUB_NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error listing applications:', error);
    return serverError();
  }
}
