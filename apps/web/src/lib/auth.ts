import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';

/**
 * Get the wallet address from the request header
 */
export function getWalletAddress(request: NextRequest): string | null {
  return request.headers.get('x-wallet-address');
}

/**
 * Get or create a user by wallet address
 */
export async function getOrCreateUser(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();

  let user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { walletAddress: normalized },
    });
  }

  return user;
}

/**
 * Get the current user from request, returns null if not authenticated
 */
export async function getCurrentUser(request: NextRequest) {
  const walletAddress = getWalletAddress(request);

  if (!walletAddress) {
    return null;
  }

  return getOrCreateUser(walletAddress);
}

/**
 * Require authentication - throws if no wallet address provided
 */
export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new AuthError('UNAUTHORIZED', 'Wallet address required');
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
