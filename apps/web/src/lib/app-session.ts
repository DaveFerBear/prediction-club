import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

const APP_SESSION_COOKIE_NAME = 'pc_session';
const APP_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AppSession = {
  userId: string;
  turnkeySubOrgId: string;
  turnkeyEndUserId: string;
  iat: number;
  exp: number;
};

type AppSessionInput = {
  userId: string;
  turnkeySubOrgId: string;
  turnkeyEndUserId: string;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('APP_SESSION_SECRET must be set to at least 32 chars');
  }
  return secret;
}

function sign(unsignedToken: string, secret: string): string {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url');
}

export function createAppSessionToken(input: AppSessionInput): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AppSession = {
    ...input,
    iat: nowSeconds,
    exp: nowSeconds + APP_SESSION_TTL_SECONDS,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadEncoded, getSessionSecret());
  return `${payloadEncoded}.${signature}`;
}

export function verifyAppSessionToken(token: string): AppSession | null {
  const [payloadEncoded, providedSignature] = token.split('.');
  if (!payloadEncoded || !providedSignature) return null;

  const expectedSignature = sign(payloadEncoded, getSessionSecret());
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as AppSession;
    if (
      !payload.userId ||
      !payload.turnkeySubOrgId ||
      !payload.turnkeyEndUserId ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAppSessionFromRequest(request: NextRequest): AppSession | null {
  const cookie = request.cookies.get(APP_SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  return verifyAppSessionToken(cookie);
}

export function setAppSessionCookie(response: NextResponse, input: AppSessionInput): void {
  const token = createAppSessionToken(input);
  response.cookies.set(APP_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: APP_SESSION_TTL_SECONDS,
  });
}

export function clearAppSessionCookie(response: NextResponse): void {
  response.cookies.set(APP_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export const appSessionCookieName = APP_SESSION_COOKIE_NAME;
