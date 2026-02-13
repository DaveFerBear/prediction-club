import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { apiResponse, validationError, serverError } from '@/lib/api';
import { getOrCreateUserFromTurnkeyIdentity } from '@/lib/auth';
import { setAppSessionCookie } from '@/lib/app-session';
import { parseTurnkeyLoginInput } from '@/lib/turnkey-auth';
import { resolveTurnkeyIdentityFromOidcToken } from '@/lib/turnkey-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = parseTurnkeyLoginInput(body);
    const identity =
      input.mode === 'oidc'
        ? await resolveTurnkeyIdentityFromOidcToken(input.oidcToken)
        : input.identity;
    const user = await getOrCreateUserFromTurnkeyIdentity(identity);

    const response = apiResponse({
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        turnkeySubOrgId: user.turnkeySubOrgId,
        turnkeyEndUserId: user.turnkeyEndUserId,
      },
    });

    setAppSessionCookie(response, {
      userId: user.id,
      turnkeySubOrgId: identity.turnkeySubOrgId,
      turnkeyEndUserId: identity.turnkeyEndUserId,
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.errors[0]?.message ?? 'Invalid turnkey login payload');
    }
    console.error('Error handling Turnkey login:', error);
    return serverError('Failed to initialize session');
  }
}
