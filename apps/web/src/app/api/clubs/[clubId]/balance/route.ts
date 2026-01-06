import { NextRequest } from 'next/server';
import { prisma } from '@prediction-club/db';
import { apiResponse, notFoundError, serverError } from '@/lib/api';
import { createChainPublicClient, getMemberBalance, type SupportedChainId } from '@prediction-club/chain';

/**
 * GET /api/clubs/[clubId]/balance
 * Get on-chain balance for a member in a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { clubId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const memberAddress = searchParams.get('member');

    // Get club
    const club = await prisma.club.findUnique({
      where: { id: params.clubId },
    });

    if (!club) {
      return notFoundError('Club');
    }

    // If no member specified, return vault contract info
    if (!memberAddress) {
      return apiResponse({
        clubId: club.id,
        vaultAddress: club.vaultAddress,
        safeAddress: club.safeAddress,
        chainId: club.chainId,
      });
    }

    // Get on-chain balance
    try {
      const client = createChainPublicClient(club.chainId as SupportedChainId);
      const balance = await getMemberBalance(
        client,
        club.vaultAddress as `0x${string}`,
        memberAddress as `0x${string}`
      );

      return apiResponse({
        clubId: club.id,
        member: memberAddress,
        available: balance.available.toString(),
        committed: balance.committed.toString(),
        total: balance.total.toString(),
        withdrawAddress: balance.withdrawAddress,
      });
    } catch (chainError) {
      // If chain call fails, return empty balance
      console.error('Chain call failed:', chainError);
      return apiResponse({
        clubId: club.id,
        member: memberAddress,
        available: '0',
        committed: '0',
        total: '0',
        withdrawAddress: memberAddress,
        error: 'Failed to fetch on-chain balance',
      });
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    return serverError();
  }
}
