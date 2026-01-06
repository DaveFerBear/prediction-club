import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, notFoundError, forbiddenError, serverError } from '@/lib/api';

/**
 * POST /api/clubs/[slug]/applications/[appId]/approve
 * Approve a membership application
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; appId: string } }
) {
  try {
    // Get club first
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
    });

    if (!club) {
      return notFoundError('Club');
    }

    // TODO: Get authenticated user from session
    const currentUserId = 'placeholder-user-id';

    // Check if current user is admin of the club
    const currentMember = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
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

    if (application.clubId !== club.id) {
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
          clubId: club.id,
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
