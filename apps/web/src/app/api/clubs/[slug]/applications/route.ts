import { NextRequest } from 'next/server';
import { ApplicationController, ApplicationError } from '@/controllers';
import { apiResponse, notFoundError, serverError } from '@/lib/api';

/**
 * GET /api/clubs/[slug]/applications
 * List applications for a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
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
    if (error instanceof ApplicationError && error.code === 'CLUB_NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error listing applications:', error);
    return serverError();
  }
}
