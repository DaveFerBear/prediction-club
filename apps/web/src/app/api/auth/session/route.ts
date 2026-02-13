import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { getAppSessionFromRequest } from '@/lib/app-session';
import { apiResponse } from '@/lib/api';

export async function GET(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return apiResponse({ authenticated: false, user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      walletAddress: true,
      turnkeySubOrgId: true,
      turnkeyEndUserId: true,
    },
  });

  if (!user) {
    return apiResponse({ authenticated: false, user: null });
  }

  if (user.turnkeySubOrgId && user.turnkeySubOrgId !== session.turnkeySubOrgId) {
    return apiResponse({ authenticated: false, user: null });
  }

  return apiResponse({
    authenticated: true,
    user,
  });
}
