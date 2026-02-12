import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { apiResponse, serverError, unauthorizedError } from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const wallets = await prisma.clubWallet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const addresses = wallets.map((wallet) => wallet.walletAddress);
    const entries =
      addresses.length === 0
        ? []
        : await prisma.ledgerEntry.findMany({
            where: {
              userId: user.id,
              safeAddress: { in: addresses },
            },
            select: {
              safeAddress: true,
              amount: true,
            },
          });

    const balanceByAddress = new Map<string, bigint>();
    for (const entry of entries) {
      const next = (balanceByAddress.get(entry.safeAddress) ?? 0n) + BigInt(entry.amount);
      balanceByAddress.set(entry.safeAddress, next);
    }

    return apiResponse({
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        club: wallet.club,
        walletAddress: wallet.walletAddress,
        isDisabled: wallet.isDisabled,
        balance: (balanceByAddress.get(wallet.walletAddress) ?? 0n).toString(),
        createdAt: wallet.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error loading profile wallets:', error);
    return serverError();
  }
}

