import { NextRequest } from 'next/server';
import { ApplicationController, ApplicationError } from '@/controllers';
import { apiResponse, apiError, notFoundError, forbiddenError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

/**
 * POST /api/clubs/[slug]/applications/[appId]/approve
 * Approve a membership application
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; appId: string } }
) {
  try {
    const user = await requireAuth(request);

    const result = await ApplicationController.approve({
      clubSlug: params.slug,
      applicationId: params.appId,
      adminUserId: user.id,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ApplicationError) {
      switch (error.code) {
        case 'CLUB_NOT_FOUND':
        case 'APPLICATION_NOT_FOUND':
          return notFoundError(error.code === 'CLUB_NOT_FOUND' ? 'Club' : 'Application');
        case 'FORBIDDEN':
          return forbiddenError(error.message);
        default:
          return apiError(error.code, error.message, 400);
      }
    }
    console.error('Error approving application:', error);
    return serverError();
  }
}
