import { NextRequest } from 'next/server';
import { ClubController, ClubError } from '@/controllers';
import {
  apiResponse,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
} from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';
import { prisma } from '@prediction-club/db';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);

    const member = club.members.find((clubMember) => clubMember.userId === user.id);
    if (!member || member.status !== 'ACTIVE') {
      return forbiddenError('You must be an active member to view this club wallet');
    }

    const wallet = await prisma.clubWallet.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: club.id,
        },
      },
      select: {
        id: true,
        turnkeyWalletAddress: true,
        polymarketSafeAddress: true,
        provisioningStatus: true,
        provisioningError: true,
        turnkeyWalletAccountId: true,
        isDisabled: true,
        createdAt: true,
      },
    });

    if (!wallet) {
      return apiResponse({ wallet: null });
    }

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        userId: user.id,
        clubId: club.id,
        safeAddress: wallet.polymarketSafeAddress ?? '__not-ready__',
      },
      select: {
        amount: true,
      },
    });
    const balance = ledgerEntries.reduce((sum, entry) => sum + BigInt(entry.amount), 0n).toString();

    return apiResponse({
      wallet: {
        id: wallet.id,
        turnkeyWalletAddress: wallet.turnkeyWalletAddress,
        walletAddress: wallet.polymarketSafeAddress,
        isDisabled: wallet.isDisabled,
        turnkeyWalletAccountId: wallet.turnkeyWalletAccountId,
        provisioningStatus: wallet.provisioningStatus,
        provisioningError: wallet.provisioningError,
        createdAt: wallet.createdAt,
        automationReady: wallet.provisioningStatus === 'READY',
        balance,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return notFoundError('Club');
    }
    console.error('Error loading club wallet:', error);
    return serverError();
  }
}
