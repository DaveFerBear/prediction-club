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

    const addresses = wallets
      .map((wallet) => wallet.polymarketSafeAddress)
      .filter((address): address is string => Boolean(address));
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
        walletAddress: wallet.polymarketSafeAddress,
        turnkeyWalletAddress: wallet.turnkeyWalletAddress,
        provisioningStatus: wallet.provisioningStatus,
        provisioningError: wallet.provisioningError,
        isDisabled: wallet.isDisabled,
        balance: wallet.polymarketSafeAddress
          ? (balanceByAddress.get(wallet.polymarketSafeAddress) ?? 0n).toString()
          : '0',
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
