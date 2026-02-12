import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import type {
  RoundMember,
  MemberPayout,
  MemberOrder,
  MarketResolution as SettledMarketResolution,
} from '../types/chainworker-db';

const POLYMARKET_CLOB_URL = process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com';
const POLYMARKET_CHAIN_ID = Number(process.env.POLYMARKET_CHAIN_ID ?? 137);
const ALLOW_ZERO_PAYOUTS = process.env.CHAINWORKER_ALLOW_ZERO_PAYOUTS === 'true';
const CHAINWORKER_SIGNER_KEY = process.env.CHAINWORKER_SIGNER_PRIVATE_KEY || '';
const POLY_BUILDER_API_KEY = process.env.POLY_BUILDER_API_KEY || '';
const POLY_BUILDER_SECRET = process.env.POLY_BUILDER_SECRET || '';
const POLY_BUILDER_PASSPHRASE = process.env.POLY_BUILDER_PASSPHRASE || '';

type UserCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

function redact(value: string, keep = 4) {
  if (!value) return '<empty>';
  if (value.length <= keep * 2) return `${'*'.repeat(value.length)}`;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function describeCreds(creds: UserCreds) {
  return {
    key: redact(creds.key),
    secret: redact(creds.secret),
    passphrase: redact(creds.passphrase),
    keyLength: creds.key.length,
    secretLength: creds.secret.length,
    passphraseLength: creds.passphrase.length,
  };
}

export type MarketResolution = { isResolved: boolean } & SettledMarketResolution;

const CONDITION_ID_PATTERN = /0x[a-fA-F0-9]{64}/;

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
  const resolvedFlag = Boolean(
    market.resolved ?? market.isResolved ?? market.settled ?? market.finalized
  );
  return resolvedFlag || status === 'resolved' || status === 'settled' || status === 'final';
}

export class PolymarketController {
  static missingMemberFields(member: RoundMember): string[] {
    const missing: string[] = [];
    if (!member.clubWallet) {
      missing.push('clubWallet');
      return missing;
    }
    if (member.clubWallet.isDisabled) {
      missing.push('clubWalletDisabled');
      return missing;
    }
    if (!member.user.polymarketApiKeyId) missing.push('polymarketApiKeyId');
    if (!member.user.polymarketApiSecret) missing.push('polymarketApiSecret');
    if (!member.user.polymarketApiPassphrase) missing.push('polymarketApiPassphrase');
    if (!member.user.walletAddress) missing.push('walletAddress');
    return missing;
  }

  static buildClient(creds: UserCreds, headerAddress: string, funderAddress?: string | null) {
    if (!CHAINWORKER_SIGNER_KEY) throw new Error('CHAINWORKER_SIGNER_PRIVATE_KEY is not set.');
    if (!POLY_BUILDER_API_KEY) throw new Error('POLY_BUILDER_API_KEY is not set.');
    if (!POLY_BUILDER_SECRET) throw new Error('POLY_BUILDER_SECRET is not set.');
    if (!POLY_BUILDER_PASSPHRASE) throw new Error('POLY_BUILDER_PASSPHRASE is not set.');

    const signer = new Wallet(CHAINWORKER_SIGNER_KEY);
    const headerSigner = {
      getAddress: async () => headerAddress,
    } as unknown as Wallet;
    const builderConfig = new BuilderConfig({
      localBuilderCreds: {
        key: POLY_BUILDER_API_KEY,
        secret: POLY_BUILDER_SECRET,
        passphrase: POLY_BUILDER_PASSPHRASE,
      },
    });

    return new ClobClient(
      POLYMARKET_CLOB_URL,
      POLYMARKET_CHAIN_ID,
      headerSigner,
      creds,
      undefined,
      funderAddress ?? undefined,
      undefined,
      undefined,
      builderConfig,
      () => signer
    );
  }

  static async fetchMarketResolution(conditionId: string): Promise<MarketResolution> {
    if (!CONDITION_ID_PATTERN.test(conditionId)) {
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
  }): Promise<MemberOrder> {
    const { tokenId, commitAmount, member } = params;
    const clubWallet = member.clubWallet;
    if (!clubWallet || clubWallet.isDisabled) {
      throw new Error(`Missing active club wallet for user ${member.userId}`);
    }
    const missing = this.missingMemberFields(member);
    if (missing.length > 0) {
      throw new Error(
        `Missing required Polymarket fields for user ${member.userId}: ${missing.join(', ')}`
      );
    }

    const amount = Number(commitAmount) / 1_000_000;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid commit amount for user ${member.userId}`);
    }

    const creds = {
      key: member.user.polymarketApiKeyId!,
      secret: member.user.polymarketApiSecret!,
      passphrase: member.user.polymarketApiPassphrase!,
    };
    console.log('[chainworker] Polymarket creds snapshot', {
      userId: member.userId,
      walletAddress: member.user.walletAddress,
      funderAddress: clubWallet.walletAddress,
      ...describeCreds(creds),
    });
    const clobClient = this.buildClient(creds, member.user.walletAddress, clubWallet.walletAddress);
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
