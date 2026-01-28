import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';

const credsSchema = z.object({
  key: z.string().min(1),
  secret: z.string().min(1),
  passphrase: z.string().min(1),
});

const saveCredsSchema = z.union([
  z.object({
    creds: credsSchema,
    safeAddress: z.string().optional(),
  }),
  z
    .object({
      safeAddress: z.string().optional(),
    })
    .merge(credsSchema),
]);

/**
 * POST /api/polymarket/creds
 * Save Polymarket API credentials for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const parsed = saveCredsSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const { safeAddress } = parsed.data;
    const creds = 'creds' in parsed.data ? parsed.data.creds : parsed.data;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        polymarketApiKeyId: creds.key,
        polymarketApiSecret: creds.secret,
        polymarketApiPassphrase: creds.passphrase,
        polymarketSafeAddress: safeAddress ?? undefined,
      },
    });

    return apiResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error saving Polymarket creds:', error);
    return apiError('POLYMARKET_CREDS_ERROR', 'Failed to save Polymarket credentials', 500);
  }
}

/**
 * GET /api/polymarket/creds
 * Check if Polymarket API credentials exist for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        polymarketApiKeyId: true,
        polymarketApiSecret: true,
        polymarketApiPassphrase: true,
        polymarketSafeAddress: true,
      },
    });

    const hasCreds = !!(
      record?.polymarketApiKeyId &&
      record?.polymarketApiSecret &&
      record?.polymarketApiPassphrase
    );

    return apiResponse({
      hasCreds,
      safeAddress: record?.polymarketSafeAddress ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error checking Polymarket creds:', error);
    return apiError('POLYMARKET_CREDS_ERROR', 'Failed to check Polymarket credentials', 500);
  }
}
