import { NextRequest } from 'next/server';
import { z } from 'zod';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient } from '@polymarket/clob-client';
import { VoidSigner } from '@ethersproject/abstract-signer';
import { prisma } from '@prediction-club/db';
import { apiResponse, apiError, validationError, unauthorizedError, serverError } from '@/lib/api';
import { requireAuth, AuthError } from '@/lib/auth';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CLOB_URL } from '@/lib/polymarket';

const cancelOrderSchema = z.object({
  orderID: z.string().min(1),
});

/**
 * POST /api/polymarket/cancel
 * Cancel a Polymarket order by ID
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const parsed = cancelOrderSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        walletAddress: true,
        polymarketApiKeyId: true,
        polymarketApiSecret: true,
        polymarketApiPassphrase: true,
      },
    });

    if (
      !dbUser?.walletAddress ||
      !dbUser.polymarketApiKeyId ||
      !dbUser.polymarketApiSecret ||
      !dbUser.polymarketApiPassphrase
    ) {
      return apiError('POLYMARKET_CREDS_MISSING', 'Polymarket credentials not stored', 400);
    }

    const builderKey = process.env.POLY_BUILDER_API_KEY || '';
    const builderSecret = process.env.POLY_BUILDER_SECRET || '';
    const builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE || '';

    if (!builderKey || !builderSecret || !builderPassphrase) {
      return apiError('BUILDER_CREDS_MISSING', 'Builder credentials not configured', 500);
    }

    const builderConfig = new BuilderConfig({
      localBuilderCreds: {
        key: builderKey,
        secret: builderSecret,
        passphrase: builderPassphrase,
      },
    });

    const signer = new VoidSigner(dbUser.walletAddress);
    const clobClient = new ClobClient(
      POLYMARKET_CLOB_URL,
      POLYMARKET_CHAIN_ID,
      signer,
      {
        key: dbUser.polymarketApiKeyId,
        secret: dbUser.polymarketApiSecret,
        passphrase: dbUser.polymarketApiPassphrase,
      },
      undefined,
      undefined,
      undefined,
      undefined,
      builderConfig
    );

    const response = await clobClient.cancelOrder({ orderID: parsed.data.orderID });
    return apiResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    console.error('Error canceling Polymarket order:', error);
    return serverError();
  }
}
