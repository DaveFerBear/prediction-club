import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import type { RoundMember, MemberPayout } from './ChainWorkerDBController';

const POLYMARKET_CLOB_URL = process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com';
const POLYMARKET_CHAIN_ID = Number(process.env.POLYMARKET_CHAIN_ID ?? 137);
const ALLOW_ZERO_PAYOUTS = process.env.CHAINWORKER_ALLOW_ZERO_PAYOUTS === 'true';
const CHAINWORKER_SIGNER_KEY = process.env.CHAINWORKER_SIGNER_PRIVATE_KEY || '';

type UserCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

export type MarketResolution = {
  isResolved: boolean;
  outcome: string | null;
  resolvedAt: Date | null;
};

const CONDITION_ID_PATTERN = /0x[a-fA-F0-9]{64}/;

function parseConditionId(marketRef: string | null) {
  if (!marketRef) return null;
  const match = marketRef.match(CONDITION_ID_PATTERN);
  return match ? match[0] : null;
}

function parseResolvedAt(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isMarketResolved(market: Record<string, unknown>) {
  const status = typeof market.status === 'string' ? market.status.toLowerCase() : '';
  const resolvedFlag = Boolean(market.resolved ?? market.isResolved ?? market.settled ?? market.finalized);
  return resolvedFlag || status === 'resolved' || status === 'settled' || status === 'final';
}

export type PlacedOrder = {
  orderId: string;
  orderStatus?: string | null;
  orderSide?: string | null;
  orderPrice?: string | null;
  orderSize?: string | null;
  orderSizeMatched?: string | null;
  orderType?: string | null;
  orderOutcome?: string | null;
  orderCreatedAt?: Date | null;
  orderTxHashes?: string[] | null;
  orderMakingAmount?: string | null;
  orderTakingAmount?: string | null;
};

export class PolymarketController {
  static buildClient(creds: UserCreds, funderAddress?: string | null) {
    if (!CHAINWORKER_SIGNER_KEY) {
      throw new Error('CHAINWORKER_SIGNER_PRIVATE_KEY is not set.');
    }
    const signer = new Wallet(CHAINWORKER_SIGNER_KEY);
    const builderKey = process.env.POLY_BUILDER_API_KEY || '';
    const builderSecret = process.env.POLY_BUILDER_SECRET || '';
    const builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE || '';
    const builderConfig =
      builderKey && builderSecret && builderPassphrase
        ? new BuilderConfig({
            localBuilderCreds: {
              key: builderKey,
              secret: builderSecret,
              passphrase: builderPassphrase,
            },
          })
        : undefined;

    return new ClobClient(
      POLYMARKET_CLOB_URL,
      POLYMARKET_CHAIN_ID,
      signer,
      creds,
      undefined,
      funderAddress ?? undefined,
      undefined,
      undefined,
      builderConfig
    );
  }

  static async fetchMarketResolution(marketRef: string | null): Promise<MarketResolution> {
    const conditionId = parseConditionId(marketRef);
    if (!conditionId) {
      return { isResolved: false, outcome: null, resolvedAt: null };
    }

    const clobClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID);
    const market = (await clobClient.getMarket(conditionId)) as Record<string, unknown>;
    const resolved = isMarketResolved(market);

    if (!resolved) {
      return { isResolved: false, outcome: null, resolvedAt: null };
    }

    const outcome =
      (market.outcome as string | undefined) ??
      (market.result as string | undefined) ??
      (market.winningOutcome as string | undefined) ??
      null;
    const resolvedAt =
      parseResolvedAt(market.resolvedAt) ??
      parseResolvedAt(market.resolved_at) ??
      parseResolvedAt(market.resolutionDate) ??
      null;

    return {
      isResolved: true,
      outcome,
      resolvedAt,
    };
  }

  static computeMemberPayouts(members: RoundMember[]): MemberPayout[] | null {
    if (members.length === 0) return null;
    const hasAnyNonZero = members.some(
      (member) => member.payoutAmount !== '0' || member.pnlAmount !== '0'
    );
    if (!hasAnyNonZero && !ALLOW_ZERO_PAYOUTS) {
      return null;
    }

    return members.map((member) => ({
      userId: member.userId,
      payoutAmount: member.payoutAmount,
      pnlAmount:
        member.pnlAmount !== '0'
          ? member.pnlAmount
          : (BigInt(member.payoutAmount) - BigInt(member.commitAmount)).toString(),
    }));
  }

  static async placeMarketOrder(params: {
    tokenId: string;
    commitAmount: string;
    member: RoundMember;
  }): Promise<PlacedOrder> {
    const { tokenId, commitAmount, member } = params;
    const creds =
      member.user.polymarketApiKeyId &&
      member.user.polymarketApiSecret &&
      member.user.polymarketApiPassphrase
        ? {
            key: member.user.polymarketApiKeyId,
            secret: member.user.polymarketApiSecret,
            passphrase: member.user.polymarketApiPassphrase,
          }
        : null;

    if (!creds) {
      throw new Error(`Missing Polymarket API creds for user ${member.userId}`);
    }

    const amount = Number(commitAmount) / 1_000_000;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid commit amount for user ${member.userId}`);
    }

    const clobClient = this.buildClient(creds, member.user.polymarketSafeAddress);
    const response = await clobClient.createAndPostMarketOrder(
      {
        tokenID: tokenId,
        side: Side.BUY,
        amount,
      },
      undefined,
      OrderType.FOK
    );

    const orderId = response?.orderID;
    if (!orderId) {
      throw new Error(`Missing order ID for user ${member.userId}`);
    }

    let orderDetails:
      | {
          status?: string;
          side?: string;
          price?: string;
          original_size?: string;
          size_matched?: string;
          order_type?: string;
          outcome?: string;
          created_at?: number;
        }
      | undefined;

    try {
      orderDetails = await clobClient.getOrder(orderId);
    } catch (error) {
      console.warn(`[chainworker] Failed to fetch order details for ${orderId}:`, error);
    }

    return {
      orderId,
      orderStatus: orderDetails?.status ?? response?.status ?? null,
      orderSide: orderDetails?.side ?? null,
      orderPrice: orderDetails?.price ?? null,
      orderSize: orderDetails?.original_size ?? null,
      orderSizeMatched: orderDetails?.size_matched ?? null,
      orderType: orderDetails?.order_type ?? null,
      orderOutcome: orderDetails?.outcome ?? null,
      orderCreatedAt: orderDetails?.created_at ? new Date(orderDetails.created_at * 1000) : null,
      orderTxHashes: response?.transactionsHashes ?? null,
      orderMakingAmount: response?.makingAmount ?? null,
      orderTakingAmount: response?.takingAmount ?? null,
    };
  }
}
