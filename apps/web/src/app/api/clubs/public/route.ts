import { NextRequest } from 'next/server';
import { ClubController, LedgerController } from '@/controllers';
import { apiResponse, serverError } from '@/lib/api';

/**
 * GET /api/clubs/public
 * List public clubs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const result = await ClubController.listPublic({ page, pageSize });
    const clubIds = result.items.map((club) => club.id);
    const volumeByClub = await LedgerController.getClubsActiveCommitVolume({ clubIds });
    const items = result.items.map((club) => ({
      ...club,
      activeCommittedVolume: volumeByClub.get(club.id) ?? '0',
    }));
    return apiResponse({ ...result, items });
  } catch (error) {
    console.error('Error listing public clubs:', error);
    return serverError();
  }
}
