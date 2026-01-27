import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  getContract,
} from 'viem';
import { polygon, polygonAmoy } from 'viem/chains';
import { ClubVaultV1Abi, ERC20Abi } from './abi';
import { CHAIN_CONFIG, type SupportedChainId } from './config';

/**
 * Get the viem chain object for a supported chain ID
 */
export function getViemChain(chainId: SupportedChainId): Chain {
  switch (chainId) {
    case 137:
      return polygon;
    case 80002:
      return polygonAmoy;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Create a public client for reading from the blockchain
 */
export function createChainPublicClient(
  chainId: SupportedChainId,
  rpcUrl?: string
): PublicClient<Transport, Chain> {
  const chain = getViemChain(chainId);
  const config = CHAIN_CONFIG[chainId];

  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? config.rpcUrl),
  });
}

/**
 * Create a wallet client for signing transactions
 */
export function createChainWalletClient(
  chainId: SupportedChainId,
  account: Address,
  rpcUrl?: string
): WalletClient {
  const chain = getViemChain(chainId);
  const config = CHAIN_CONFIG[chainId];

  return createWalletClient({
    chain,
    account,
    transport: http(rpcUrl ?? config.rpcUrl),
  });
}

/**
 * Get a ClubVaultV1 contract instance for reading
 */
export function getVaultContract(
  client: PublicClient<Transport, Chain>,
  vaultAddress: Address
) {
  return getContract({
    address: vaultAddress,
    abi: ClubVaultV1Abi,
    client,
  });
}

/**
 * Get an ERC20 contract instance for reading
 */
export function getERC20Contract(
  client: PublicClient<Transport, Chain>,
  tokenAddress: Address
) {
  return getContract({
    address: tokenAddress,
    abi: ERC20Abi,
    client,
  });
}

/**
 * Read member balance from vault
 */
export async function getMemberBalance(
  client: PublicClient<Transport, Chain>,
  vaultAddress: Address,
  memberAddress: Address
) {
  const vault = getVaultContract(client, vaultAddress);

  const [balance, withdrawAddress] = await Promise.all([
    vault.read.balanceOf([memberAddress]),
    vault.read.withdrawAddressOf([memberAddress]),
  ]);

  return {
    available: balance.available,
    committed: balance.committed,
    total: balance.available + balance.committed,
    withdrawAddress,
  };
}

/**
 * Get prediction round status from vault
 */
export async function getPredictionRoundStatus(
  client: PublicClient<Transport, Chain>,
  vaultAddress: Address,
  predictionRoundId: `0x${string}`
) {
  const vault = getVaultContract(client, vaultAddress);

  const [totalRemaining, finalized] = await Promise.all([
    vault.read.cohortTotalRemaining([predictionRoundId]),
    vault.read.cohortFinalized([predictionRoundId]),
  ]);

  return {
    totalRemaining,
    finalized,
  };
}

/**
 * Get ERC20 token balance
 */
export async function getTokenBalance(
  client: PublicClient<Transport, Chain>,
  tokenAddress: Address,
  accountAddress: Address
): Promise<bigint> {
  const token = getERC20Contract(client, tokenAddress);
  return token.read.balanceOf([accountAddress]);
}

/**
 * Get ERC20 allowance
 */
export async function getTokenAllowance(
  client: PublicClient<Transport, Chain>,
  tokenAddress: Address,
  ownerAddress: Address,
  spenderAddress: Address
): Promise<bigint> {
  const token = getERC20Contract(client, tokenAddress);
  return token.read.allowance([ownerAddress, spenderAddress]);
}
