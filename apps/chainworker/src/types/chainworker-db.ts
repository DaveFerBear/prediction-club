import { Prisma, type PredictionRound, type PredictionRoundMember } from '@prediction-club/db';

export const pendingRoundSelect = Prisma.validator<Prisma.PredictionRoundSelect>()({
  id: true,
  clubId: true,
  conditionId: true,
  marketId: true,
  marketSlug: true,
  targetOutcome: true,
  targetTokenId: true,
  status: true,
  outcome: true,
  resolvedAt: true,
  settledAt: true,
  createdAt: true,
});

export const roundMemberSelect = Prisma.validator<Prisma.PredictionRoundMemberSelect>()({
  id: true,
  userId: true,
  commitAmount: true,
  payoutAmount: true,
  pnlAmount: true,
  orderId: true,
  settledAt: true,
  user: {
    select: {
      walletAddress: true,
      polymarketApiKeyId: true,
      polymarketApiSecret: true,
      polymarketApiPassphrase: true,
    },
  },
});

export type PendingRound = Prisma.PredictionRoundGetPayload<{ select: typeof pendingRoundSelect }>;

export type RoundMember = Prisma.PredictionRoundMemberGetPayload<{
  select: typeof roundMemberSelect;
}> & {
  clubWallet: {
    id: string;
    walletAddress: string;
    isDisabled: boolean;
    turnkeyWalletAccountId: string;
    turnkeyDelegatedUserId: string;
    turnkeyPolicyId: string;
  } | null;
};

export type MemberPayout = Pick<PredictionRoundMember, 'userId' | 'payoutAmount'> & {
  pnlAmount?: PredictionRoundMember['pnlAmount'];
};

export type MemberOrder = Pick<PredictionRoundMember, 'orderId'> &
  Partial<
    Pick<
      PredictionRoundMember,
      | 'orderStatus'
      | 'orderSide'
      | 'orderPrice'
      | 'orderSize'
      | 'orderSizeMatched'
      | 'orderType'
      | 'orderOutcome'
      | 'orderCreatedAt'
      | 'orderTxHashes'
      | 'orderMakingAmount'
      | 'orderTakingAmount'
    >
  >;

export type MarketResolution = Pick<PredictionRound, 'outcome' | 'resolvedAt'>;
