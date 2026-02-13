import { utils as ethersUtils } from 'ethers';
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import {
  POLYMARKET_CHAIN_ID,
  createPolymarketPublicClient,
  getCtfTokenAddress,
  getPolymarketApprovalAddresses,
  getUsdcTokenAddress,
} from '@/lib/polymarket';
import { signDigestWithTurnkey } from '@/lib/turnkey-server';
import { getAggressivePolygonGasPriceWei } from '@/lib/GasFeeEstimates';

const maxApprovalAmount = 2n ** 256n - 1n;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const statusCacheTtlMs = 15_000;
const maxRateLimitRetries = 3;

const erc1155ApprovalAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'isApprovedForAll',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setApprovalForAll',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

export type ClubWalletTradingStatus = {
  ready: boolean;
  usdcApprovals: Record<string, boolean>;
  ctfApprovals: Record<string, boolean>;
};

export type EnableClubWalletTradingResult = {
  txHashes: Hex[];
  status: ClubWalletTradingStatus;
};

type TradingLogLevel = 'info' | 'warn' | 'error';

type TradingLogContext = {
  flowId?: string;
  clubId?: string;
  userId?: string;
};

export class ClubWalletTradingError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ClubWalletTradingError';
  }
}

const statusCache = new Map<string, { status: ClubWalletTradingStatus; expiresAt: number }>();
const statusRequestByWallet = new Map<string, Promise<ClubWalletTradingStatus>>();

function logTrading(level: TradingLogLevel, event: string, payload: Record<string, unknown> = {}) {
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  logger('[wallet-enable-trading]', {
    event,
    ...payload,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('too many requests') || message.includes('rate limit');
}

function isReceiptTimeoutError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('timed out while waiting for transaction');
}

function isAlreadyKnownTxError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('already known');
}

function isReplacementUnderpricedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('replacement transaction underpriced');
}

function getRetryDelayMs(error: unknown, attempt: number): number {
  const message = getErrorMessage(error).toLowerCase();
  const retryInSecondsMatch = message.match(/retry in\s+(\d+)s/);
  if (retryInSecondsMatch) {
    const retrySeconds = Number(retryInSecondsMatch[1]);
    if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
      return retrySeconds * 1_000;
    }
  }
  return Math.min(2_000 * (attempt + 1), 10_000);
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options?: { label?: string; logContext?: TradingLogContext }
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const shouldRetry = isRateLimitError(error) && attempt < maxRateLimitRetries - 1;
      if (!shouldRetry) {
        throw error;
      }
      const retryDelayMs = getRetryDelayMs(error, attempt);
      logTrading('warn', 'rpc.rate_limited.retry', {
        flowId: options?.logContext?.flowId,
        clubId: options?.logContext?.clubId,
        userId: options?.logContext?.userId,
        label: options?.label ?? 'unknown',
        attempt: attempt + 1,
        retryDelayMs,
        error: getErrorMessage(error),
      });
      await sleep(retryDelayMs);
    }
  }
}

function createApprovalMap(targets: readonly Address[], value: boolean): Record<string, boolean> {
  return Object.fromEntries(targets.map((target) => [target, value])) as Record<string, boolean>;
}

function parseInsufficientGasError(
  error: unknown
): { balanceWei: bigint; txCostWei: bigint; overshotWei: bigint } | null {
  const message = getErrorMessage(error);
  const match = message.match(/balance\s+(\d+),\s*tx cost\s+(\d+),\s*overshot\s+(\d+)/i);
  if (!match) return null;
  return {
    balanceWei: BigInt(match[1]),
    txCostWei: BigInt(match[2]),
    overshotWei: BigInt(match[3]),
  };
}

function formatInsufficientGasMessage(input: {
  walletAddress: Address;
  balanceWei: bigint;
  txCostWei: bigint;
  overshotWei: bigint;
}): string {
  const balance = ethersUtils.formatEther(input.balanceWei);
  const cost = ethersUtils.formatEther(input.txCostWei);
  const shortfall = ethersUtils.formatEther(input.overshotWei);
  return `Club wallet ${input.walletAddress} has insufficient POL for approval gas. Balance: ${balance} POL, estimated tx cost: ${cost} POL, shortfall: ${shortfall} POL. Fund this club wallet with POL and retry.`;
}

function normalizeAddress(address: string): Address {
  const normalized = address.trim().toLowerCase();
  if (!addressPattern.test(normalized)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return normalized as Address;
}

function getSignWithCandidates(walletAddress: Address, walletAccountId: string): string[] {
  const checksummedAddress = (() => {
    try {
      return ethersUtils.getAddress(walletAddress);
    } catch {
      return walletAddress;
    }
  })();
  return Array.from(new Set([checksummedAddress, walletAddress, walletAccountId]));
}

function getTradingConfig() {
  const usdc = getUsdcTokenAddress();
  if (!usdc) {
    throw new Error('Missing USDC token address for configured chain');
  }
  const ctf = getCtfTokenAddress();
  if (!ctf) {
    throw new Error('Missing CTF token address for configured chain');
  }

  const approvalAddresses = getPolymarketApprovalAddresses().map((value) =>
    normalizeAddress(value)
  );
  if (approvalAddresses.length === 0) {
    throw new Error('Missing Polymarket approval addresses for configured chain');
  }

  return {
    usdc: normalizeAddress(usdc),
    ctf: normalizeAddress(ctf),
    approvalAddresses,
  };
}

async function sendSignedTransaction(input: {
  organizationId: string;
  walletAccountId: string;
  walletAddress: Address;
  to: Address;
  data: Hex;
  nonce: number;
  action: 'usdc.approve' | 'ctf.setApprovalForAll';
  target: Address;
  logContext?: TradingLogContext;
  value?: bigint;
}): Promise<Hex> {
  const publicClient = createPolymarketPublicClient();
  const value = input.value ?? 0n;
  logTrading('info', 'tx.prepare', {
    flowId: input.logContext?.flowId,
    clubId: input.logContext?.clubId,
    userId: input.logContext?.userId,
    action: input.action,
    walletAddress: input.walletAddress,
    target: input.target,
    nonce: input.nonce,
  });
  const gasEstimate = await withRateLimitRetry(
    () =>
      publicClient.estimateGas({
        account: input.walletAddress,
        to: input.to,
        data: input.data,
        value,
      }),
    { label: `${input.action}.estimateGas`, logContext: input.logContext }
  );
  const gasLimit = gasEstimate + gasEstimate / 5n;
  const gasPrice = getAggressivePolygonGasPriceWei();

  const unsignedTx: Record<string, unknown> = {
    chainId: POLYMARKET_CHAIN_ID,
    to: input.to,
    data: input.data,
    nonce: input.nonce,
    value: ethersUtils.hexlify(value),
    gasLimit: ethersUtils.hexlify(gasLimit),
    type: 0,
    gasPrice: ethersUtils.hexlify(gasPrice),
  };

  const unsignedSerialized = ethersUtils.serializeTransaction(unsignedTx);
  const digest = ethersUtils.keccak256(unsignedSerialized);
  const signature = await signDigestWithTurnkey({
    organizationId: input.organizationId,
    signWithCandidates: getSignWithCandidates(input.walletAddress, input.walletAccountId),
    digestHex: digest,
  });

  const recovered = ethersUtils.recoverAddress(digest, signature);
  if (normalizeAddress(recovered) !== input.walletAddress) {
    throw new Error('Turnkey signature did not match club wallet address');
  }

  const signedSerialized = ethersUtils.serializeTransaction(
    unsignedTx,
    ethersUtils.splitSignature(signature)
  );
  let txHash: Hex;
  try {
    txHash = await withRateLimitRetry(
      () =>
        publicClient.sendRawTransaction({
          serializedTransaction: signedSerialized as Hex,
        }),
      { label: `${input.action}.sendRawTransaction`, logContext: input.logContext }
    );
  } catch (error) {
    if (isAlreadyKnownTxError(error)) {
      txHash = ethersUtils.keccak256(signedSerialized) as Hex;
      logTrading('warn', 'tx.already_known', {
        flowId: input.logContext?.flowId,
        clubId: input.logContext?.clubId,
        userId: input.logContext?.userId,
        action: input.action,
        txHash,
        nonce: input.nonce,
      });
    } else if (isReplacementUnderpricedError(error)) {
      throw new ClubWalletTradingError(
        'NONCE_CONFLICT',
        `Pending transaction already exists for nonce ${input.nonce}. Allow pending approvals to settle, then retry.`
      );
    } else {
      const insufficientGas = parseInsufficientGasError(error);
      if (insufficientGas) {
        throw new ClubWalletTradingError(
          'INSUFFICIENT_GAS',
          formatInsufficientGasMessage({
            walletAddress: input.walletAddress,
            balanceWei: insufficientGas.balanceWei,
            txCostWei: insufficientGas.txCostWei,
            overshotWei: insufficientGas.overshotWei,
          })
        );
      }
      throw error;
    }
  }
  logTrading('info', 'tx.submitted', {
    flowId: input.logContext?.flowId,
    clubId: input.logContext?.clubId,
    userId: input.logContext?.userId,
    action: input.action,
    txHash,
    nonce: input.nonce,
  });
  try {
    const receipt = await withRateLimitRetry(
      () =>
        publicClient.waitForTransactionReceipt({
          hash: txHash,
        }),
      { label: `${input.action}.waitForReceipt`, logContext: input.logContext }
    );
    if (receipt.status !== 'success') {
      throw new Error(`Approval transaction failed: ${txHash}`);
    }
    logTrading('info', 'tx.confirmed', {
      flowId: input.logContext?.flowId,
      clubId: input.logContext?.clubId,
      userId: input.logContext?.userId,
      action: input.action,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error) {
    if (!isRateLimitError(error) && !isReceiptTimeoutError(error)) {
      throw error;
    }
    // Transaction submission succeeded; receipt may still be pending or polling was throttled.
    // Keep moving and let readiness settle on subsequent refreshes.
    logTrading('warn', 'tx.receipt_pending', {
      flowId: input.logContext?.flowId,
      clubId: input.logContext?.clubId,
      userId: input.logContext?.userId,
      txHash,
      action: input.action,
      error: getErrorMessage(error),
    });
  }
  return txHash;
}

export async function getClubWalletTradingStatus(input: {
  walletAddress: string;
  forceRefresh?: boolean;
  logContext?: TradingLogContext;
}): Promise<ClubWalletTradingStatus> {
  const walletAddress = normalizeAddress(input.walletAddress);
  const { usdc, ctf, approvalAddresses } = getTradingConfig();
  const cacheKey = walletAddress;
  const now = Date.now();

  if (!input.forceRefresh) {
    const cached = statusCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      logTrading('info', 'status.cache_hit', {
        flowId: input.logContext?.flowId,
        clubId: input.logContext?.clubId,
        userId: input.logContext?.userId,
        walletAddress,
      });
      return cached.status;
    }
  }

  const inFlightRequest = statusRequestByWallet.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    const publicClient = createPolymarketPublicClient();

    const usdcApprovals: Record<string, boolean> = {};
    for (const target of approvalAddresses) {
      const allowance = await withRateLimitRetry(
        () =>
          publicClient.readContract({
            address: usdc,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [walletAddress, target],
          }),
        { label: 'status.usdcAllowance', logContext: input.logContext }
      );
      usdcApprovals[target] = allowance > 0n;
    }

    const ctfApprovals: Record<string, boolean> = {};
    for (const target of approvalAddresses) {
      const isApproved = await withRateLimitRetry(
        () =>
          publicClient.readContract({
            address: ctf,
            abi: erc1155ApprovalAbi,
            functionName: 'isApprovedForAll',
            args: [walletAddress, target],
          }),
        { label: 'status.ctfApproval', logContext: input.logContext }
      );
      ctfApprovals[target] = isApproved;
    }

    const status: ClubWalletTradingStatus = {
      ready: approvalAddresses.every((target) => usdcApprovals[target] && ctfApprovals[target]),
      usdcApprovals,
      ctfApprovals,
    };

    statusCache.set(cacheKey, {
      status,
      expiresAt: Date.now() + statusCacheTtlMs,
    });
    logTrading('info', 'status.resolved', {
      flowId: input.logContext?.flowId,
      clubId: input.logContext?.clubId,
      userId: input.logContext?.userId,
      walletAddress,
      ready: status.ready,
      usdcApprovedCount: Object.values(usdcApprovals).filter(Boolean).length,
      ctfApprovedCount: Object.values(ctfApprovals).filter(Boolean).length,
      approvalTargetCount: approvalAddresses.length,
    });
    return status;
  })();

  statusRequestByWallet.set(cacheKey, request);
  try {
    return await request;
  } finally {
    statusRequestByWallet.delete(cacheKey);
  }
}

export async function enableClubWalletTrading(input: {
  organizationId: string;
  walletAccountId: string;
  walletAddress: string;
  logContext?: TradingLogContext;
}): Promise<EnableClubWalletTradingResult> {
  const startedAtMs = Date.now();
  const walletAddress = normalizeAddress(input.walletAddress);
  const { usdc, ctf, approvalAddresses } = getTradingConfig();
  const publicClient = createPolymarketPublicClient();
  const txHashes: Hex[] = [];
  let sawNonceConflict = false;
  logTrading('info', 'enable.start', {
    flowId: input.logContext?.flowId,
    clubId: input.logContext?.clubId,
    userId: input.logContext?.userId,
    walletAddress,
    approvalTargetCount: approvalAddresses.length,
  });
  let nonce = await withRateLimitRetry(
    () =>
      publicClient.getTransactionCount({
        address: walletAddress,
        blockTag: 'pending',
      }),
    { label: 'enable.getNonce', logContext: input.logContext }
  );

  let status: ClubWalletTradingStatus;
  try {
    status = await getClubWalletTradingStatus({
      walletAddress,
      forceRefresh: true,
      logContext: input.logContext,
    });
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }
    status = {
      ready: false,
      usdcApprovals: createApprovalMap(approvalAddresses, false),
      ctfApprovals: createApprovalMap(approvalAddresses, false),
    };
  }

  if (status.ready) {
    return { txHashes, status };
  }

  const nativeBalance = await withRateLimitRetry(
    () =>
      publicClient.getBalance({
        address: walletAddress,
      }),
    { label: 'enable.getNativeBalance', logContext: input.logContext }
  );
  if (nativeBalance <= 0n) {
    throw new ClubWalletTradingError(
      'INSUFFICIENT_GAS',
      `Club wallet ${walletAddress} has 0 POL for gas. Fund this club wallet with POL (native token), then retry Enable trading.`
    );
  }

  outer: for (const target of approvalAddresses) {
    if (!status.usdcApprovals[target]) {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [target, maxApprovalAmount],
      });
      try {
        txHashes.push(
          await sendSignedTransaction({
            organizationId: input.organizationId,
            walletAccountId: input.walletAccountId,
            walletAddress,
            to: usdc,
            data,
            nonce,
            action: 'usdc.approve',
            target,
            logContext: input.logContext,
          })
        );
      } catch (error) {
        if (error instanceof ClubWalletTradingError && error.code === 'NONCE_CONFLICT') {
          sawNonceConflict = true;
          logTrading('warn', 'tx.nonce_conflict', {
            flowId: input.logContext?.flowId,
            clubId: input.logContext?.clubId,
            userId: input.logContext?.userId,
            action: 'usdc.approve',
            target,
            nonce,
            error: error.message,
          });
          break outer;
        }
        throw error;
      }
      nonce += 1;
    }

    if (!status.ctfApprovals[target]) {
      const data = encodeFunctionData({
        abi: erc1155ApprovalAbi,
        functionName: 'setApprovalForAll',
        args: [target, true],
      });
      try {
        txHashes.push(
          await sendSignedTransaction({
            organizationId: input.organizationId,
            walletAccountId: input.walletAccountId,
            walletAddress,
            to: ctf,
            data,
            nonce,
            action: 'ctf.setApprovalForAll',
            target,
            logContext: input.logContext,
          })
        );
      } catch (error) {
        if (error instanceof ClubWalletTradingError && error.code === 'NONCE_CONFLICT') {
          sawNonceConflict = true;
          logTrading('warn', 'tx.nonce_conflict', {
            flowId: input.logContext?.flowId,
            clubId: input.logContext?.clubId,
            userId: input.logContext?.userId,
            action: 'ctf.setApprovalForAll',
            target,
            nonce,
            error: error.message,
          });
          break outer;
        }
        throw error;
      }
      nonce += 1;
    }
  }

  try {
    status = await getClubWalletTradingStatus({
      walletAddress,
      forceRefresh: true,
      logContext: input.logContext,
    });
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }
    const optimisticReady = txHashes.length > 0;
    status = {
      ready: optimisticReady,
      usdcApprovals: createApprovalMap(approvalAddresses, optimisticReady),
      ctfApprovals: createApprovalMap(approvalAddresses, optimisticReady),
    };
  }

  statusCache.set(walletAddress, {
    status,
    expiresAt: Date.now() + statusCacheTtlMs,
  });

  if (!status.ready) {
    if (txHashes.length > 0 || sawNonceConflict) {
      logTrading('warn', 'enable.pending', {
        flowId: input.logContext?.flowId,
        clubId: input.logContext?.clubId,
        userId: input.logContext?.userId,
        walletAddress,
        txCount: txHashes.length,
        sawNonceConflict,
        durationMs: Date.now() - startedAtMs,
      });
      return {
        txHashes,
        status,
      };
    }
    throw new Error('Trading approvals are still incomplete after executing approval transactions');
  }

  logTrading('info', 'enable.complete', {
    flowId: input.logContext?.flowId,
    clubId: input.logContext?.clubId,
    userId: input.logContext?.userId,
    walletAddress,
    txCount: txHashes.length,
    ready: status.ready,
    durationMs: Date.now() - startedAtMs,
  });

  return {
    txHashes,
    status,
  };
}
