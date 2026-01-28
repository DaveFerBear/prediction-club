import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SiweMessage } from 'siwe';

function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});

  return cookies[key] ?? null;
}

function getCsrfTokenFromHeaders(headers?: Headers | Record<string, string>) {
  if (!headers) return null;
  const cookieHeader =
    headers instanceof Headers ? headers.get('cookie') : (headers.cookie ?? null);

  const csrfCookie =
    getCookieValue(cookieHeader, '__Host-next-auth.csrf-token') ??
    getCookieValue(cookieHeader, 'next-auth.csrf-token');

  if (!csrfCookie) return null;
  return csrfCookie.split('|')[0];
}

const nextAuthUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Ethereum',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials, req) {
        try {
          const message = credentials?.message ? JSON.parse(credentials.message) : null;
          const signature = credentials?.signature ?? '';
          if (!message || !signature) return null;

          const siwe = new SiweMessage(message);
          const nonce = getCsrfTokenFromHeaders(req?.headers as Headers | Record<string, string>);
          if (!nonce) return null;

          const result = await siwe.verify({
            signature,
            domain: new URL(nextAuthUrl).host,
            nonce,
          });

          if (!result.success) return null;
          return { id: siwe.address };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.address = token.sub;
      }
      return session;
    },
  },
};
