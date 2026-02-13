import {
  prisma,
  type ClubWallet,
  type Prisma,
} from '@prediction-club/db';
import {
  deriveClubWalletPolymarketCreds,
  ensureClubWalletApprovals,
  ensureClubWalletSafeAddress,
} from '@/lib/club-wallet-provisioning';
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

    let wallet = existing;
    if (!wallet) {
      const createdWallet = await createClubWalletForSubOrganization({
        subOrganizationId: user.turnkeySubOrgId,
        clubId: input.clubId,
      });

      try {
        wallet = await tx.clubWallet.create({
          data: {
            userId: input.userId,
            clubId: input.clubId,
            turnkeyWalletAddress: createdWallet.walletAddress.toLowerCase(),
            turnkeyWalletAccountId: createdWallet.walletAccountId,
            turnkeyDelegatedUserId:
              user.turnkeyEndUserId ?? `delegated-not-configured-${input.userId.slice(0, 8)}`,
            turnkeyPolicyId: 'strict-default-v1',
            provisioningStatus: 'PENDING',
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
          if (raceWinner) {
            wallet = raceWinner;
          }
        } else {
          throw error;
        }
      }
    }

    if (!wallet) {
      throw new ClubWalletError('PROVISIONING_ERROR', 'Failed to initialize club wallet record');
    }

    if (
      wallet.provisioningStatus === 'READY' &&
      wallet.polymarketSafeAddress &&
      wallet.polymarketApiKeyId &&
      wallet.polymarketApiSecret &&
      wallet.polymarketApiPassphrase
    ) {
      return wallet;
    }

    await prisma.clubWallet.update({
      where: { id: wallet.id },
      data: {
        provisioningStatus: 'PROVISIONING',
        provisioningError: null,
        lastProvisioningAttemptAt: new Date(),
      },
    });

    try {
      const turnkeyInput = {
        organizationId: user.turnkeySubOrgId,
        walletAccountId: wallet.turnkeyWalletAccountId,
        walletAddress: wallet.turnkeyWalletAddress as `0x${string}`,
      };

      const polymarketSafeAddress =
        (wallet.polymarketSafeAddress as `0x${string}` | null) ??
        (await ensureClubWalletSafeAddress(turnkeyInput));

      if (!wallet.polymarketSafeAddress) {
        wallet = await prisma.clubWallet.update({
          where: { id: wallet.id },
          data: {
            polymarketSafeAddress,
          },
        });
      }

      const { approvalStatus } = await ensureClubWalletApprovals({
        ...turnkeyInput,
        safeAddress: polymarketSafeAddress,
      });

      if (!approvalStatus.ready) {
        throw new Error('Polymarket approvals remain incomplete after relay execution');
      }

      const hasStoredCreds = Boolean(
        wallet.polymarketApiKeyId && wallet.polymarketApiSecret && wallet.polymarketApiPassphrase
      );
      const creds = hasStoredCreds
        ? {
            polymarketApiKeyId: wallet.polymarketApiKeyId as string,
            polymarketApiSecret: wallet.polymarketApiSecret as string,
            polymarketApiPassphrase: wallet.polymarketApiPassphrase as string,
          }
        : await deriveClubWalletPolymarketCreds({
            ...turnkeyInput,
            safeAddress: polymarketSafeAddress,
          });

      return await prisma.clubWallet.update({
        where: { id: wallet.id },
        data: {
          polymarketSafeAddress,
          polymarketApiKeyId: creds.polymarketApiKeyId,
          polymarketApiSecret: creds.polymarketApiSecret,
          polymarketApiPassphrase: creds.polymarketApiPassphrase,
          provisioningStatus: 'READY',
          provisioningError: null,
          provisionedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.clubWallet.update({
        where: { id: wallet.id },
        data: {
          provisioningStatus: 'FAILED',
          provisioningError: error instanceof Error ? error.message : String(error),
        },
      });

      throw new ClubWalletError(
        'PROVISIONING_ERROR',
        error instanceof Error ? error.message : 'Failed to provision club wallet'
      );
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

    const nonReady = wallets.filter((wallet) => wallet.provisioningStatus !== 'READY');
    if (nonReady.length > 0) {
      const countsByStatus = nonReady.reduce<Record<string, number>>((acc, wallet) => {
        const status = wallet.provisioningStatus;
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});
      const detail = Object.entries(countsByStatus)
        .map(([status, count]) => `${status}: ${count}`)
        .join(', ');
      throw new ClubWalletError(
        'WALLET_NOT_READY',
        `${nonReady.length} club wallet(s) are not provisioned (${detail})`
      );
    }

    const missingSafe = wallets.filter((wallet) => !wallet.polymarketSafeAddress);
    if (missingSafe.length > 0) {
      throw new ClubWalletError(
        'WALLET_NOT_READY',
        `${missingSafe.length} club wallet(s) are missing Polymarket Safe addresses`
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
