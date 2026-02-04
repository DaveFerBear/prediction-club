import { Prisma, type PredictionRound, type PredictionRoundMember } from '@prediction-club/db';

export const pendingRoundSelect = Prisma.validator<Prisma.PredictionRoundSelect>()({
  id: true,
  clubId: true,
  marketRef: true,
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
      polymarketSafeAddress: true,
      polymarketApiKeyId: true,
      polymarketApiSecret: true,
      polymarketApiPassphrase: true,
    },
  },
});

export type PendingRound = Prisma.PredictionRoundGetPayload<{ select: typeof pendingRoundSelect }>;

export type RoundMember = Prisma.PredictionRoundMemberGetPayload<{
  select: typeof roundMemberSelect;
}>;

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
