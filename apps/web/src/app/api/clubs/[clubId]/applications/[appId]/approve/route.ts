import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, notFoundError, forbiddenError, serverError } from '@/lib/api';

/**
 * POST /api/clubs/[clubId]/applications/[appId]/approve
 * Approve a membership application
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string; appId: string } }
) {
  try {
    // TODO: Get authenticated user from session
    const currentUserId = 'placeholder-user-id';

    // Check if current user is admin of the club
    const currentMember = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: params.clubId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMember || currentMember.role !== 'ADMIN') {
      return forbiddenError('Only club admins can approve applications');
    }

    // Get the application
    const application = await prisma.application.findUnique({
      where: { id: params.appId },
      include: { user: true },
    });

    if (!application) {
      return notFoundError('Application');
    }

    if (application.clubId !== params.clubId) {
      return notFoundError('Application');
    }

    if (application.status !== 'PENDING') {
      return apiError('INVALID_STATUS', 'Application is not pending', 400);
    }

    // Approve application and create membership
    const [updatedApplication, membership] = await prisma.$transaction([
      prisma.application.update({
        where: { id: params.appId },
        data: { status: 'APPROVED' },
      }),
      prisma.clubMember.create({
        data: {
          clubId: params.clubId,
          userId: application.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      }),
    ]);

    return apiResponse({
      application: updatedApplication,
      membership,
    });
  } catch (error) {
    console.error('Error approving application:', error);
    return serverError();
  }
}
