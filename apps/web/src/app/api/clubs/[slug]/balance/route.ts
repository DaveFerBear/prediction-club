import { NextRequest } from 'next/server';
import { VaultController, VaultError } from '@/controllers';
import { apiResponse, notFoundError, serverError } from '@/lib/api';

/**
 * GET /api/clubs/[slug]/balance
 * Get on-chain balance for a member in a club
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const memberAddress = searchParams.get('member') || undefined;

    const result = await VaultController.getBalance({
      clubSlug: params.slug,
      memberAddress,
    });

    return apiResponse(result);
  } catch (error) {
    if (error instanceof VaultError && error.code === 'CLUB_NOT_FOUND') {
      return notFoundError('Club');
    }
    console.error('Error fetching balance:', error);
    return serverError();
  }
}
