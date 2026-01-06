import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, validationError, notFoundError, serverError } from '@/lib/api';

const applySchema = z.object({
  message: z.string().max(500).optional(),
});

/**
 * POST /api/clubs/[slug]/apply
 * Apply to join a club
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // TODO: Get authenticated user from session
    const userId = 'placeholder-user-id';

    // Check if club exists
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
    });

    if (!club) {
      return notFoundError('Club');
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
      return apiError('ALREADY_MEMBER', 'You are already a member of this club', 409);
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
        return apiError('APPLICATION_PENDING', 'You already have a pending application', 409);
      }
      if (existingApplication.status === 'REJECTED') {
        // Update existing rejected application
        const application = await prisma.application.update({
          where: { id: existingApplication.id },
          data: {
            status: 'PENDING',
            message: parsed.data.message,
          },
        });
        return apiResponse(application);
      }
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        clubId: club.id,
        userId,
        message: parsed.data.message,
        status: 'PENDING',
      },
    });

    return apiResponse(application, 201);
  } catch (error) {
    console.error('Error creating application:', error);
    return serverError();
  }
}
