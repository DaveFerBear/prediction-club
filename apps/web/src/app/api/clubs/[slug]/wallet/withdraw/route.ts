import { NextRequest } from 'next/server';
import { ClubController, ClubError } from '@/controllers';
import {
  apiError,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
} from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);

    const member = club.members.find((clubMember) => clubMember.userId === user.id);
    if (!member || member.status !== 'ACTIVE') {
      return forbiddenError('You must be an active member to withdraw');
    }

    return apiError(
      'WITHDRAWAL_CONFIRMATION_REQUIRED',
      'Interactive Turnkey withdrawal confirmation is required and not yet wired in this endpoint.',
      501
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return notFoundError('Club');
    }
    console.error('Error requesting withdrawal:', error);
    return serverError();
  }
}

