import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { getAppSessionFromRequest } from '@/lib/app-session';
import {
  deriveCompatibilityWalletAddress,
  type TurnkeyIdentity,
} from '@/lib/turnkey-auth';

const hexAddressPattern = /^0x[a-fA-F0-9]{40}$/;

function normalizeWalletAddress(address: string): string {
  const normalized = address.trim().toLowerCase();
  if (!hexAddressPattern.test(normalized)) {
    throw new AuthError('INVALID_WALLET_ADDRESS', 'Invalid wallet address');
  }
  return normalized;
}

function shouldReplaceCompatibilityWallet(currentWalletAddress: string, identity: TurnkeyIdentity) {
  const compatibilityAddress = deriveCompatibilityWalletAddress(identity).toLowerCase();
  return currentWalletAddress.toLowerCase() === compatibilityAddress;
}

export async function getOrCreateUserFromTurnkeyIdentity(identity: TurnkeyIdentity) {
  const fallbackWalletAddress = deriveCompatibilityWalletAddress(identity);
  const normalizedWalletAddress = identity.walletAddress
    ? normalizeWalletAddress(identity.walletAddress)
    : fallbackWalletAddress.toLowerCase();

  const existingByTurnkey = await prisma.user.findFirst({
    where: {
      OR: [
        { turnkeySubOrgId: identity.turnkeySubOrgId },
        { turnkeyEndUserId: identity.turnkeyEndUserId },
      ],
    },
  });

  if (existingByTurnkey) {
    const updates: {
      turnkeySubOrgId?: string;
      turnkeyEndUserId?: string;
      walletAddress?: string;
      email?: string | null;
    } = {};

    if (existingByTurnkey.turnkeySubOrgId !== identity.turnkeySubOrgId) {
      updates.turnkeySubOrgId = identity.turnkeySubOrgId;
    }
    if (existingByTurnkey.turnkeyEndUserId !== identity.turnkeyEndUserId) {
      updates.turnkeyEndUserId = identity.turnkeyEndUserId;
    }
    if (
      identity.walletAddress &&
      existingByTurnkey.walletAddress !== normalizedWalletAddress &&
      shouldReplaceCompatibilityWallet(existingByTurnkey.walletAddress, identity)
    ) {
      updates.walletAddress = normalizedWalletAddress;
    }
    if (identity.email && existingByTurnkey.email !== identity.email) {
      updates.email = identity.email;
    }

    if (Object.keys(updates).length === 0) {
      return existingByTurnkey;
    }

    return prisma.user.update({
      where: { id: existingByTurnkey.id },
      data: updates,
    });
  }

  const existingByWallet = await prisma.user.findUnique({
    where: { walletAddress: normalizedWalletAddress },
  });

  if (existingByWallet) {
    return prisma.user.update({
      where: { id: existingByWallet.id },
      data: {
        turnkeySubOrgId: identity.turnkeySubOrgId,
        turnkeyEndUserId: identity.turnkeyEndUserId,
        email: identity.email ?? existingByWallet.email,
      },
    });
  }

  return prisma.user.create({
    data: {
      walletAddress: normalizedWalletAddress,
      email: identity.email,
      turnkeySubOrgId: identity.turnkeySubOrgId,
      turnkeyEndUserId: identity.turnkeyEndUserId,
    },
  });
}

async function getCurrentUserFromAppSession(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) return null;

  if (user.turnkeySubOrgId && user.turnkeySubOrgId !== session.turnkeySubOrgId) {
    return null;
  }

  return user;
}

export async function getWalletAddress(request: NextRequest): Promise<string | null> {
  const user = await getCurrentUserFromAppSession(request);
  return user?.walletAddress ?? null;
}

/**
 * Get the current user from request, returns null if not authenticated
 */
export async function getCurrentUser(request: NextRequest) {
  return getCurrentUserFromAppSession(request);
}

/**
 * Require authentication - throws if no wallet address provided
 */
export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Authentication required');
  }

  return user;
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
