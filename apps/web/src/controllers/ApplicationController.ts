import { prisma } from '@prediction-club/db';
import { ClubController } from './ClubController';
import { ClubWalletController, ClubWalletError } from './ClubWalletController';

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

export interface ListApplicationsInput {
  clubSlug: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  page?: number;
  pageSize?: number;
}

export class ApplicationController {
  /**
   * List applications for a club
   */
  static async list(input: ListApplicationsInput) {
    const { clubSlug, status, page = 1, pageSize = 20 } = input;

    const club = await prisma.club.findUnique({
      where: { slug: clubSlug },
    });

    if (!club) {
      throw new ApplicationError('CLUB_NOT_FOUND', 'Club not found');
    }

    const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = { clubId: club.id };

    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              walletAddress: true,
              email: true,
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return {
      items: applications,
      total,
      page,
      pageSize,
      hasMore: skip + applications.length < total,
    };
  }

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
    const isAdmin = await ClubController.isAdmin(club.id, adminUserId);

    if (!isAdmin) {
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const updatedApplication = await tx.application.update({
          where: { id: applicationId },
          data: { status: 'APPROVED' },
        });

        const membership = await tx.clubMember.create({
          data: {
            clubId: club.id,
            userId: application.userId,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });

        await ClubWalletController.ensureClubWallet(
          {
            clubId: club.id,
            userId: application.userId,
          },
          tx
        );

        return { updatedApplication, membership };
      });

      return { application: result.updatedApplication, membership: result.membership };
    } catch (error) {
      if (error instanceof ClubWalletError) {
        throw new ApplicationError(error.code, error.message);
      }
      throw error;
    }
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
