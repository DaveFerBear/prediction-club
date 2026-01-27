/**
 * Contract deployment utilities
 *
 * Currently deploys Safe + ClubVault in two separate transactions.
 * TODO: Replace with a ClubFactory contract for single-transaction deployment.
 */

import {
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
  encodeFunctionData,
  encodeDeployData,
  decodeEventLog,
} from 'viem';
import { ClubVaultV1Abi, ClubVaultV1Bytecode } from './abi';
import { type SupportedChainId, getChainConfig } from './config';

const TX_RECEIPT_POLL_INTERVAL_MS = 2500;
const TX_RECEIPT_TIMEOUT_MS = 180_000;

const getSaltNonce = () => {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return BigInt(`0x${hex}`);
  }
  return (BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) << 32n) ^ BigInt(Date.now());
};

const waitForReceipt = async (publicClient: PublicClient, hash: Hash) => {
  const start = Date.now();
  // Poll manually to avoid block polling + extra RPC calls.
  for (;;) {
    try {
      return await publicClient.getTransactionReceipt({ hash });
    } catch (error) {
      if (Date.now() - start >= TX_RECEIPT_TIMEOUT_MS) {
        throw error instanceof Error ? error : new Error('Transaction receipt timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, TX_RECEIPT_POLL_INTERVAL_MS));
    }
  }
};

// Safe factory addresses (same on all EVM chains)
// See: https://github.com/safe-global/safe-deployments
const SAFE_ADDRESSES = {
  // Safe v1.4.1 addresses
  safeProxyFactory: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as Address,
  safeSingleton: '0x41675C099F32341bf84BFc5382aF534df5C7461a' as Address,
  fallbackHandler: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as Address,
};

// Safe Proxy Factory ABI (minimal)
const SafeProxyFactoryAbi = [
  {
    name: 'createProxyWithNonce',
    type: 'function',
    inputs: [
      { name: '_singleton', type: 'address' },
      { name: 'initializer', type: 'bytes' },
      { name: 'saltNonce', type: 'uint256' },
    ],
    outputs: [{ name: 'proxy', type: 'address' }],
  },
  {
    type: 'event',
    name: 'ProxyCreation',
    inputs: [
      { name: 'proxy', type: 'address', indexed: true },
      { name: 'singleton', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
] as const;

// Safe Singleton ABI (minimal - just setup)
const SafeSingletonAbi = [
  {
    name: 'setup',
    type: 'function',
    inputs: [
      { name: '_owners', type: 'address[]' },
      { name: '_threshold', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'fallbackHandler', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint256' },
      { name: 'paymentReceiver', type: 'address' },
    ],
    outputs: [],
  },
] as const;

export interface DeployClubParams {
  /** Wallet client for signing transactions */
  walletClient: WalletClient;
  /** Public client for reading chain data */
  publicClient: PublicClient;
  /** Chain ID */
  chainId: SupportedChainId;
  /** Owners of the Safe (usually just the creator's address) */
  owners: Address[];
  /** Number of signatures required (usually 1 for single-owner) */
  threshold: number;
  /** USDC token address for the vault */
  usdcAddress?: Address;
}

export interface DeployClubResult {
  safeAddress: Address;
  vaultAddress: Address;
  safeTxHash: Hash;
  vaultTxHash: Hash;
}

/**
 * Deploy a new club (Safe + ClubVault)
 *
 * Currently requires two transactions:
 * 1. Deploy Gnosis Safe
 * 2. Deploy ClubVault (owned by the Safe)
 *
 * TODO: Replace with single-transaction ClubFactory deployment
 */
export async function deployClub(params: DeployClubParams): Promise<DeployClubResult> {
  const { walletClient, publicClient, chainId, owners, threshold, usdcAddress } = params;

  // Get USDC address from config if not provided
  const chainConfig = getChainConfig(chainId);
  const usdc = usdcAddress || (chainConfig.usdc as Address);

  // Step 1: Deploy Safe
  console.log('Deploying Safe...');
  const { address: safeAddress, txHash: safeTxHash } = await deploySafe({
    walletClient,
    publicClient,
    owners,
    threshold,
  });
  console.log('Safe deployed:', safeAddress);

  // Step 2: Deploy ClubVault (owned by the Safe)
  console.log('Deploying ClubVault...');
  const { address: vaultAddress, txHash: vaultTxHash } = await deployClubVault({
    walletClient,
    publicClient,
    safeAddress,
    usdcAddress: usdc,
  });
  console.log('ClubVault deployed:', vaultAddress);

  return {
    safeAddress,
    vaultAddress,
    safeTxHash,
    vaultTxHash,
  };
}

/**
 * Deploy a Gnosis Safe
 */
export async function deploySafe(params: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  owners: Address[];
  threshold: number;
}): Promise<{ address: Address; txHash: Hash }> {
  const { walletClient, publicClient, owners, threshold } = params;

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Encode Safe setup call
  const setupData = encodeFunctionData({
    abi: SafeSingletonAbi,
    functionName: 'setup',
    args: [
      owners,
      BigInt(threshold),
      '0x0000000000000000000000000000000000000000' as Address, // to
      '0x' as `0x${string}`, // data
      SAFE_ADDRESSES.fallbackHandler,
      '0x0000000000000000000000000000000000000000' as Address, // paymentToken
      BigInt(0), // payment
      '0x0000000000000000000000000000000000000000' as Address, // paymentReceiver
    ],
  });

  // Generate unique salt nonce
  const saltNonce = getSaltNonce();

  // Deploy via factory
  const txHash = await walletClient.writeContract({
    address: SAFE_ADDRESSES.safeProxyFactory,
    abi: SafeProxyFactoryAbi,
    functionName: 'createProxyWithNonce',
    args: [SAFE_ADDRESSES.safeSingleton, setupData, saltNonce],
    account,
    chain: walletClient.chain,
  });

  // Wait for receipt to get deployed address
  const receipt = await waitForReceipt(publicClient, txHash);

  // Parse Safe address from ProxyCreation event (indexed args -> topics)
  let safeAddress: Address | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== SAFE_ADDRESSES.safeProxyFactory.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: SafeProxyFactoryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'ProxyCreation' && decoded.args && !Array.isArray(decoded.args)) {
        const args = decoded.args as unknown;
        if (args && typeof args === 'object' && 'proxy' in args) {
          safeAddress = (args as { proxy: Address }).proxy;
          break;
        }
      }
    } catch {
      // ignore logs that don't match
    }
    const proxyTopic = log.topics[1];
    if (!safeAddress && proxyTopic) {
      safeAddress = `0x${proxyTopic.slice(26)}` as Address;
      break;
    }
  }

  if (!safeAddress) {
    throw new Error('Failed to find ProxyCreation event');
  }

  return { address: safeAddress, txHash };
}

/**
 * Deploy a ClubVault contract
 */
export async function deployClubVault(params: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  safeAddress: Address;
  usdcAddress: Address;
}): Promise<{ address: Address; txHash: Hash }> {
  const { walletClient, publicClient, safeAddress, usdcAddress } = params;

  const account = walletClient.account;
  if (!account) throw new Error('Wallet not connected');

  // Encode constructor args and deploy
  const deployData = encodeDeployData({
    abi: ClubVaultV1Abi,
    bytecode: ClubVaultV1Bytecode,
    args: [safeAddress, usdcAddress],
  });

  const txHash = await walletClient.sendTransaction({
    data: deployData,
    account,
    chain: walletClient.chain,
  });

  // Wait for receipt
  const receipt = await waitForReceipt(publicClient, txHash);

  if (!receipt.contractAddress) {
    throw new Error('Failed to deploy ClubVault');
  }

  return { address: receipt.contractAddress, txHash };
}
