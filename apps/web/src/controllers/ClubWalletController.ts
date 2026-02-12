import { prisma, type ClubWallet, type Prisma } from '@prediction-club/db';
import { createClubWalletForSubOrganization } from '@/lib/turnkey-server';

export class ClubWalletController {
  static async ensureClubWallet(
    input: { userId: string; clubId: string },
    tx: Prisma.TransactionClient = prisma
  ): Promise<ClubWallet> {
    const existing = await tx.clubWallet.findUnique({
      where: {
        userId_clubId: {
          userId: input.userId,
          clubId: input.clubId,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        turnkeySubOrgId: true,
        turnkeyEndUserId: true,
      },
    });
    if (!user) {
      throw new ClubWalletError('USER_NOT_FOUND', 'User not found');
    }
    if (!user.turnkeySubOrgId) {
      throw new ClubWalletError(
        'TURNKEY_SUBORG_REQUIRED',
        'User must complete Turnkey sign in before wallet provisioning'
      );
    }

    const createdWallet = await createClubWalletForSubOrganization({
      subOrganizationId: user.turnkeySubOrgId,
      clubId: input.clubId,
    });

    try {
      return await tx.clubWallet.create({
        data: {
          userId: input.userId,
          clubId: input.clubId,
          walletAddress: createdWallet.walletAddress.toLowerCase(),
          turnkeyWalletAccountId: createdWallet.walletAccountId,
          turnkeyDelegatedUserId:
            user.turnkeyEndUserId ?? `delegated-not-configured-${input.userId.slice(0, 8)}`,
          turnkeyPolicyId: 'strict-default-v1',
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const raceWinner = await tx.clubWallet.findUnique({
          where: {
            userId_clubId: {
              userId: input.userId,
              clubId: input.clubId,
            },
          },
        });
        if (raceWinner) return raceWinner;
      }
      throw error;
    }
  }

  static async requireActiveClubWallets(input: { clubId: string; userIds: string[] }) {
    const wallets = await prisma.clubWallet.findMany({
      where: {
        clubId: input.clubId,
        userId: { in: input.userIds },
      },
    });

    const walletByUser = new Map(wallets.map((wallet) => [wallet.userId, wallet]));
    const missing = input.userIds.filter((userId) => !walletByUser.has(userId));
    if (missing.length > 0) {
      throw new ClubWalletError(
        'WALLET_NOT_FOUND',
        `Missing club wallet for ${missing.length} member(s)`
      );
    }

    const disabled = wallets.filter((wallet) => wallet.isDisabled);
    if (disabled.length > 0) {
      throw new ClubWalletError(
        'WALLET_DISABLED',
        `${disabled.length} club wallet(s) are disabled`
      );
    }

    return walletByUser;
  }
}

export class ClubWalletError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ClubWalletError';
  }
}
