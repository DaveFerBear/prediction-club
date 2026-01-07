import { prisma } from '@prediction-club/db';

export interface ApplyInput {
  clubSlug: string;
  userId: string;
  message?: string;
}

export interface ApproveInput {
  clubSlug: string;
  applicationId: string;
  adminUserId: string;
}

export class ApplicationController {
  /**
   * Apply to join a club
   */
  static async apply(input: ApplyInput) {
    const { clubSlug, userId, message } = input;

    // Check if club exists
    const club = await prisma.club.findUnique({
      where: { slug: clubSlug },
    });

    if (!club) {
      throw new ApplicationError('CLUB_NOT_FOUND', 'Club not found');
    }

    // Check if already a member
    const existingMember = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ApplicationError('ALREADY_MEMBER', 'You are already a member of this club');
    }

    // Check if application already exists
    const existingApplication = await prisma.application.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId,
        },
      },
    });

    if (existingApplication) {
      if (existingApplication.status === 'PENDING') {
        throw new ApplicationError('APPLICATION_PENDING', 'You already have a pending application');
      }
      if (existingApplication.status === 'REJECTED') {
        // Update existing rejected application
        const application = await prisma.application.update({
          where: { id: existingApplication.id },
          data: {
            status: 'PENDING',
            message,
          },
        });
        return application;
      }
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        clubId: club.id,
        userId,
        message,
        status: 'PENDING',
      },
    });

    return application;
  }

  /**
   * Approve an application
   */
  static async approve(input: ApproveInput) {
    const { clubSlug, applicationId, adminUserId } = input;

    // Get club first
    const club = await prisma.club.findUnique({
      where: { slug: clubSlug },
    });

    if (!club) {
      throw new ApplicationError('CLUB_NOT_FOUND', 'Club not found');
    }

    // Check if current user is admin of the club
    const currentMember = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId: adminUserId,
        },
      },
    });

    if (!currentMember || currentMember.role !== 'ADMIN') {
      throw new ApplicationError('FORBIDDEN', 'Only club admins can approve applications');
    }

    // Get the application
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      throw new ApplicationError('APPLICATION_NOT_FOUND', 'Application not found');
    }

    if (application.clubId !== club.id) {
      throw new ApplicationError('APPLICATION_NOT_FOUND', 'Application not found');
    }

    if (application.status !== 'PENDING') {
      throw new ApplicationError('INVALID_STATUS', 'Application is not pending');
    }

    // Approve application and create membership
    const [updatedApplication, membership] = await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
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

    return { application: updatedApplication, membership };
  }
}

export class ApplicationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
