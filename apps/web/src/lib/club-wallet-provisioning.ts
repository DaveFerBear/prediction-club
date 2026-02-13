import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient } from '@polymarket/clob-client';
import { RelayClient, type Transaction as RelayTransaction } from '@polymarket/builder-relayer-client';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { utils as ethersUtils } from 'ethers';
import {
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  hashMessage,
  hashTypedData,
  http,
  type Address,
} from 'viem';
import { toAccount } from 'viem/accounts';
import { polygon, polygonAmoy } from 'viem/chains';
import {
  POLYMARKET_CHAIN_ID,
  POLYMARKET_CLOB_URL,
  createPolymarketPublicClient,
  getCtfTokenAddress,
  getPolymarketApprovalAddresses,
  getUsdcTokenAddress,
} from '@/lib/polymarket';
import { signDigestWithTurnkey } from '@/lib/turnkey-server';

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const maxApprovalAmount = 2n ** 256n - 1n;

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

type TurnkeyRelaySignerInput = {
  organizationId: string;
  walletAccountId: string;
  walletAddress: Address;
};

export type ClubWalletApprovalStatus = {
  ready: boolean;
  usdcApprovals: Record<string, boolean>;
  ctfApprovals: Record<string, boolean>;
};

export type ClubWalletProvisioningResult = {
  polymarketSafeAddress: Address;
  polymarketApiKeyId: string;
  polymarketApiSecret: string;
  polymarketApiPassphrase: string;
  approvalsReady: boolean;
  approvalTxHashes: string[];
};

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

function getRelayerUrl(): string {
  const relayerUrl = process.env.POLYMARKET_RELAYER_URL?.trim();
  if (!relayerUrl) {
    throw new Error('POLYMARKET_RELAYER_URL is required');
  }
  return relayerUrl;
}

function getBuilderConfig(): BuilderConfig {
  const key = process.env.POLY_BUILDER_API_KEY;
  const secret = process.env.POLY_BUILDER_SECRET;
  const passphrase = process.env.POLY_BUILDER_PASSPHRASE;

  if (!key || !secret || !passphrase) {
    throw new Error(
      'POLY_BUILDER_API_KEY, POLY_BUILDER_SECRET, and POLY_BUILDER_PASSPHRASE are required'
    );
  }

  return new BuilderConfig({
    localBuilderCreds: {
      key,
      secret,
      passphrase,
    },
  });
}

function getTransport() {
  if (POLYMARKET_CHAIN_ID === polygon.id) {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL;
    return rpcUrl ? http(rpcUrl) : http();
  }

  if (POLYMARKET_CHAIN_ID === polygonAmoy.id) {
    const rpcUrl = process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL;
    return rpcUrl ? http(rpcUrl) : http();
  }

  throw new Error(`Unsupported chain id ${POLYMARKET_CHAIN_ID}`);
}

function getChain() {
  if (POLYMARKET_CHAIN_ID === polygon.id) return polygon;
  if (POLYMARKET_CHAIN_ID === polygonAmoy.id) return polygonAmoy;
  throw new Error(`Unsupported chain id ${POLYMARKET_CHAIN_ID}`);
}

function createTurnkeyViemAccount(input: TurnkeyRelaySignerInput) {
  const signWithCandidates = getSignWithCandidates(input.walletAddress, input.walletAccountId);
  return toAccount({
    address: input.walletAddress,
    signMessage: async ({ message }) => {
      const digest = hashMessage(message);
      return signDigestWithTurnkey({
        organizationId: input.organizationId,
        signWithCandidates,
        digestHex: digest,
      });
    },
    signTypedData: async (typedData) => {
      const digest = hashTypedData(typedData as Parameters<typeof hashTypedData>[0]);
      return signDigestWithTurnkey({
        organizationId: input.organizationId,
        signWithCandidates,
        digestHex: digest,
      });
    },
    signTransaction: async () => {
      throw new Error('Turnkey relay account does not support signTransaction');
    },
  });
}

function createRelayClient(input: TurnkeyRelaySignerInput) {
  const account = createTurnkeyViemAccount(input);
  const walletClient = createWalletClient({
    account,
    chain: getChain(),
    transport: getTransport(),
  });
  return new RelayClient(
    getRelayerUrl(),
    POLYMARKET_CHAIN_ID,
    walletClient,
    getBuilderConfig()
  );
}

class TurnkeyClobSigner {
  constructor(
    private readonly organizationId: string,
    private readonly walletAccountId: string,
    private readonly walletAddress: Address
  ) {}

  async getAddress(): Promise<string> {
    return this.walletAddress;
  }

  async _signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string> {
    const digest = ethersUtils._TypedDataEncoder.hash(
      domain as Parameters<typeof ethersUtils._TypedDataEncoder.hash>[0],
      types,
      value
    );
    return signDigestWithTurnkey({
      organizationId: this.organizationId,
      signWithCandidates: getSignWithCandidates(this.walletAddress, this.walletAccountId),
      digestHex: digest,
    });
  }
}

function getTradingConfig() {
  const usdc = getUsdcTokenAddress();
  const ctf = getCtfTokenAddress();
  const approvalAddresses = getPolymarketApprovalAddresses().map((value) => normalizeAddress(value));

  if (!usdc) {
    throw new Error('USDC token address is not configured');
  }
  if (!ctf) {
    throw new Error('CTF token address is not configured');
  }
  if (approvalAddresses.length === 0) {
    throw new Error('Polymarket approval addresses are not configured');
  }

  return {
    usdc: normalizeAddress(usdc),
    ctf: normalizeAddress(ctf),
    approvalAddresses,
  };
}

async function getClubWalletApprovalStatus(input: {
  walletAddress: Address;
}): Promise<ClubWalletApprovalStatus> {
  const publicClient = createPolymarketPublicClient();
  const { usdc, ctf, approvalAddresses } = getTradingConfig();

  const usdcApprovals: Record<string, boolean> = {};
  for (const target of approvalAddresses) {
    const allowance = await publicClient.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [input.walletAddress, target],
    });
    usdcApprovals[target] = allowance > 0n;
  }

  const ctfApprovals: Record<string, boolean> = {};
  for (const target of approvalAddresses) {
    const isApproved = await publicClient.readContract({
      address: ctf,
      abi: erc1155ApprovalAbi,
      functionName: 'isApprovedForAll',
      args: [input.walletAddress, target],
    });
    ctfApprovals[target] = isApproved;
  }

  const ready = approvalAddresses.every((target) => usdcApprovals[target] && ctfApprovals[target]);
  return { ready, usdcApprovals, ctfApprovals };
}

export async function ensureClubWalletSafeAddress(input: TurnkeyRelaySignerInput): Promise<Address> {
  const relayClient = createRelayClient(input);
  const contractConfig = getContractConfig(POLYMARKET_CHAIN_ID);
  const safeAddress = normalizeAddress(
    deriveSafe(input.walletAddress, contractConfig.SafeContracts.SafeFactory)
  );

  const isDeployed = await relayClient.getDeployed(safeAddress);
  if (!isDeployed) {
    const deployResponse = await relayClient.deploy();
    const deployment = await deployResponse.wait();
    if (!deployment) {
      throw new Error('Safe deployment failed');
    }
  }

  return safeAddress;
}

export async function ensureClubWalletApprovals(
  input: TurnkeyRelaySignerInput & { safeAddress: Address }
) {
  const relayClient = createRelayClient(input);
  const { usdc, ctf, approvalAddresses } = getTradingConfig();
  const approvalStatus = await getClubWalletApprovalStatus({
    walletAddress: input.safeAddress,
  });

  if (approvalStatus.ready) {
    return {
      approvalTxHashes: [] as string[],
      approvalStatus,
    };
  }

  const txs: RelayTransaction[] = [];
  for (const target of approvalAddresses) {
    if (!approvalStatus.usdcApprovals[target]) {
      txs.push({
        to: usdc,
        value: '0',
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [target, maxApprovalAmount],
        }),
      });
    }

    if (!approvalStatus.ctfApprovals[target]) {
      txs.push({
        to: ctf,
        value: '0',
        data: encodeFunctionData({
          abi: erc1155ApprovalAbi,
          functionName: 'setApprovalForAll',
          args: [target, true],
        }),
      });
    }
  }

  if (txs.length === 0) {
    return {
      approvalTxHashes: [] as string[],
      approvalStatus: await getClubWalletApprovalStatus({
        walletAddress: input.safeAddress,
      }),
    };
  }

  const response = await relayClient.execute(txs, 'club-wallet-approvals');
  const result = await response.wait();
  if (!result) {
    throw new Error('Polymarket approval relay transaction failed');
  }

  const refreshedStatus = await getClubWalletApprovalStatus({
    walletAddress: input.safeAddress,
  });
  return {
    approvalTxHashes: [response.transactionHash, result.transactionHash].filter(Boolean),
    approvalStatus: refreshedStatus,
  };
}

export async function deriveClubWalletPolymarketCreds(
  input: TurnkeyRelaySignerInput & { safeAddress: Address }
) {
  const signer = new TurnkeyClobSigner(
    input.organizationId,
    input.walletAccountId,
    input.walletAddress
  );

  const clobClient = new ClobClient(
    POLYMARKET_CLOB_URL,
    POLYMARKET_CHAIN_ID,
    signer as never,
    undefined,
    undefined,
    input.safeAddress,
    undefined,
    undefined,
    getBuilderConfig(),
    () => signer as never
  );

  const creds = await clobClient.createOrDeriveApiKey();
  if (!creds.key || !creds.secret || !creds.passphrase) {
    throw new Error('Polymarket API key derivation returned incomplete credentials');
  }

  return {
    polymarketApiKeyId: creds.key,
    polymarketApiSecret: creds.secret,
    polymarketApiPassphrase: creds.passphrase,
  };
}

export async function provisionClubWallet(input: TurnkeyRelaySignerInput): Promise<ClubWalletProvisioningResult> {
  const safeAddress = await ensureClubWalletSafeAddress(input);
  const { approvalStatus, approvalTxHashes } = await ensureClubWalletApprovals({
    ...input,
    safeAddress,
  });

  if (!approvalStatus.ready) {
    throw new Error('Polymarket approvals are still incomplete after relay execution');
  }

  const creds = await deriveClubWalletPolymarketCreds({
    ...input,
    safeAddress,
  });

  return {
    polymarketSafeAddress: safeAddress,
    ...creds,
    approvalsReady: approvalStatus.ready,
    approvalTxHashes,
  };
}
