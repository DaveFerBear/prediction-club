import { NextRequest } from 'next/server';
import { decodeFunctionData, erc20Abi } from 'viem';
import { z } from 'zod';
import { ClubController, ClubError, LedgerController } from '@/controllers';
import {
  apiError,
  apiResponse,
  forbiddenError,
  notFoundError,
  serverError,
  unauthorizedError,
  validationError,
} from '@/lib/api';
import { AuthError, requireAuth } from '@/lib/auth';
import { POLYMARKET_CHAIN_ID, createPolymarketPublicClient, getUsdcTokenAddress } from '@/lib/polymarket';
import { prisma } from '@prediction-club/db';

const txHashPattern = /^0x[a-fA-F0-9]{64}$/;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const amountPattern = /^\d+$/;

const depositSchema = z.object({
  amount: z
    .string()
    .regex(amountPattern)
    .refine((value) => BigInt(value) > 0n, 'Amount must be greater than zero'),
  txHash: z.string().regex(txHashPattern),
});

function normalizeAddress(address: string): `0x${string}` {
  if (!addressPattern.test(address)) {
    throw new Error('Invalid address');
  }
  return address.toLowerCase() as `0x${string}`;
}

async function verifyDepositTransfer(input: {
  txHash: string;
  amount: string;
  clubWalletAddress: string;
}) {
  const tokenAddress = getUsdcTokenAddress();
  if (!tokenAddress) {
    throw new Error('USDC token address is not configured for this chain');
  }

  const publicClient = createPolymarketPublicClient();
  const txHash = input.txHash as `0x${string}`;
  const [transaction, receipt] = await Promise.all([
    publicClient.getTransaction({ hash: txHash }),
    publicClient.getTransactionReceipt({ hash: txHash }),
  ]);

  if (receipt.status !== 'success') {
    throw new Error('Transaction was not successful');
  }

  if (!transaction.to) {
    throw new Error('Transaction recipient is missing');
  }

  if (normalizeAddress(transaction.to) !== normalizeAddress(tokenAddress)) {
    throw new Error('Transaction is not targeting the configured USDC token');
  }

  const decoded = decodeFunctionData({
    abi: erc20Abi,
    data: transaction.input,
  });

  if (decoded.functionName !== 'transfer') {
    throw new Error('Transaction is not an ERC-20 transfer');
  }

  const args = decoded.args as readonly [string, bigint];
  const toAddress = args[0];
  const transferredAmount = args[1];

  if (normalizeAddress(toAddress) !== normalizeAddress(input.clubWalletAddress)) {
    throw new Error('Transfer destination does not match the club wallet');
  }

  if (transferredAmount !== BigInt(input.amount)) {
    throw new Error('Transfer amount does not match requested deposit');
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await requireAuth(request);
    const club = await ClubController.getBySlug(params.slug);
    const member = club.members.find((clubMember) => clubMember.userId === user.id);
    if (!member || member.status !== 'ACTIVE') {
      return forbiddenError('You must be an active member to deposit');
    }

    const body = await request.json();
    const parsed = depositSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors[0]?.message ?? 'Invalid deposit payload');
    }

    const wallet = await prisma.clubWallet.findUnique({
      where: {
        userId_clubId: {
          userId: user.id,
          clubId: club.id,
        },
      },
      select: {
        id: true,
        polymarketSafeAddress: true,
        provisioningStatus: true,
        isDisabled: true,
      },
    });
    if (!wallet) {
      return apiError('WALLET_NOT_FOUND', 'Initialize your club wallet before depositing', 400);
    }
    if (wallet.isDisabled) {
      return apiError('WALLET_DISABLED', 'Club wallet is disabled', 400);
    }
    if (!wallet.polymarketSafeAddress || wallet.provisioningStatus !== 'READY') {
      return apiError(
        'WALLET_NOT_READY',
        'Club wallet provisioning is not complete. Re-initialize wallet and retry.',
        400
      );
    }

    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        txHash: parsed.data.txHash,
        type: 'DEPOSIT',
      },
      select: { id: true },
    });
    if (existing) {
      return apiResponse({
        txHash: parsed.data.txHash,
        recorded: true,
        duplicate: true,
      });
    }

    await verifyDepositTransfer({
      txHash: parsed.data.txHash,
      amount: parsed.data.amount,
      clubWalletAddress: wallet.polymarketSafeAddress,
    });

    await LedgerController.recordDeposit({
      safeAddress: wallet.polymarketSafeAddress,
      clubId: club.id,
      userId: user.id,
      amount: parsed.data.amount,
      txHash: parsed.data.txHash,
      metadata: {
        source: 'club-wallet-deposit',
        chainId: POLYMARKET_CHAIN_ID,
      },
    });

    return apiResponse({
      txHash: parsed.data.txHash,
      recorded: true,
      duplicate: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return unauthorizedError(error.message);
    }
    if (error instanceof ClubError) {
      return notFoundError('Club');
    }
    if (error instanceof z.ZodError) {
      return validationError(error.errors[0]?.message ?? 'Invalid deposit payload');
    }
    console.error('Error recording club deposit:', error);
    return serverError();
  }
}
