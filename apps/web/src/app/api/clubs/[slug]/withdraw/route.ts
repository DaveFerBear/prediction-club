import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@prediction-club/db';
import { apiResponse, validationError, notFoundError, forbiddenError, serverError } from '@/lib/api';
import { buildWithdrawTx, SafeClient } from '@prediction-club/chain';

const withdrawSchema = z.object({
  amount: z.string().refine((val) => {
    try {
      return BigInt(val) > 0n;
    } catch {
      return false;
    }
  }, 'Amount must be a positive number'),
});

/**
 * POST /api/clubs/[slug]/withdraw
 * Request a withdrawal from the club vault
 *
 * Note: This creates a Safe transaction proposal. Actual execution
 * requires Safe signers to approve and execute.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await request.json();
    const parsed = withdrawSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error.errors[0].message);
    }

    // Get club and verify it exists
    const club = await prisma.club.findUnique({
      where: { slug: params.slug },
    });

    if (!club) {
      return notFoundError('Club');
    }

    // TODO: Get authenticated user from session
    const currentUserId = 'placeholder-user-id';

    // Check if user is a member
    const membership = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: club.id,
          userId: currentUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      return forbiddenError('You are not an active member of this club');
    }

    const amount = BigInt(parsed.data.amount);
    const memberAddress = membership.user.walletAddress as `0x${string}`;

    // Build the withdrawal transaction
    const txData = buildWithdrawTx(
      club.vaultAddress as `0x${string}`,
      memberAddress,
      amount
    );

    // Create Safe client and propose transaction
    const safeClient = new SafeClient(
      club.safeAddress as `0x${string}`,
      club.chainId
    );

    const proposal = await safeClient.proposeTransaction(txData);

    return apiResponse({
      status: 'proposed',
      safeTxHash: proposal.safeTxHash,
      member: memberAddress,
      amount: amount.toString(),
      message:
        'Withdrawal proposed to Safe. Requires Safe signer(s) to approve and execute.',
      txData: proposal.txData,
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    return serverError();
  }
}
