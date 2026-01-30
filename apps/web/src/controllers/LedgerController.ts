import { ClubController } from './ClubController';

export class LedgerController {
  static async requireAdmin(clubId: string, userId: string) {
    const isAdmin = await ClubController.isAdmin(clubId, userId);

    if (!isAdmin) {
      throw new LedgerError('FORBIDDEN', 'Only club admins can perform this action');
    }
  }
}

export class LedgerError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}
