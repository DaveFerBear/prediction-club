import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { apiError, apiResponse, validationError, serverError } from '@/lib/api';
import { getOrCreateUserFromTurnkeyIdentity } from '@/lib/auth';
import { setAppSessionCookie } from '@/lib/app-session';
import { parseTurnkeyLoginInput } from '@/lib/turnkey-auth';
import { resolveTurnkeyIdentityFromOidcToken, TurnkeyOidcRelinkError } from '@/lib/turnkey-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = parseTurnkeyLoginInput(body);
    const resolvedOidcIdentity =
      input.mode === 'oidc'
        ? await resolveTurnkeyIdentityFromOidcToken(input.oidcToken)
        : null;
    const identity = resolvedOidcIdentity ?? (input.mode === 'direct' ? input.identity : null);
    if (!identity) {
      throw new Error('Unable to resolve Turnkey identity');
    }
    const user = await getOrCreateUserFromTurnkeyIdentity(identity);

    if (!user.turnkeySubOrgId || !user.turnkeyEndUserId) {
      throw new Error('Resolved user is missing Turnkey identity');
    }

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
      turnkeySubOrgId: user.turnkeySubOrgId,
      turnkeyEndUserId: user.turnkeyEndUserId,
    });

    if (resolvedOidcIdentity) {
      const eventName =
        resolvedOidcIdentity.resolutionSource === 'email_relink'
          ? 'oidc_miss_relinked_by_email'
          : resolvedOidcIdentity.resolutionSource === 'new_suborg'
            ? 'oidc_miss_created_new_suborg'
            : 'oidc_match_found';
      console.info('[auth:turnkey:login]', {
        event: eventName,
        userId: user.id,
        turnkeySubOrgId: user.turnkeySubOrgId,
        turnkeyEndUserId: user.turnkeyEndUserId,
        email: user.email ?? null,
      });
      if (eventName === 'oidc_miss_created_new_suborg') {
        console.info('[auth:turnkey:login]', {
          event: 'orphan_suborg_review_candidate',
          userId: user.id,
          turnkeySubOrgId: user.turnkeySubOrgId,
          email: user.email ?? null,
        });
      }
    } else {
      console.info('[auth:turnkey:login]', {
        event: 'direct_identity_login',
        userId: user.id,
        turnkeySubOrgId: user.turnkeySubOrgId,
        turnkeyEndUserId: user.turnkeyEndUserId,
        email: user.email ?? null,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error.errors[0]?.message ?? 'Invalid turnkey login payload');
    }
    if (error instanceof TurnkeyOidcRelinkError) {
      console.error('[auth:turnkey:login]', {
        event: 'oidc_miss_existing_email_inaccessible_suborg',
        code: error.code,
        message: error.message,
      });
      return apiError(
        'OIDC_RELINK_BLOCKED',
        'Your existing Turnkey identity needs manual recovery before sign in.',
        409
      );
    }
    console.error('Error handling Turnkey login:', error);
    return serverError('Failed to initialize session');
  }
}
