import { createPublicClient, http, type Address } from 'viem';
import { polygon, polygonAmoy } from 'viem/chains';

export const POLYMARKET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 137);
export const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com';

const polygonUsdcEAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const polygonCtfAddress = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const polygonApprovalTargets = [
  '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
] as const;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

function normalizeAddress(address: string): Address | null {
  const value = address.trim();
  if (!addressPattern.test(value)) return null;
  return value.toLowerCase() as Address;
}

export function getUsdcTokenAddress(chainId = POLYMARKET_CHAIN_ID): `0x${string}` | null {
  const configuredAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS?.trim();
  const normalizedConfiguredAddress = configuredAddress ? normalizeAddress(configuredAddress) : null;
  if (normalizedConfiguredAddress) {
    return normalizedConfiguredAddress;
  }

  if (chainId === 137) {
    return polygonUsdcEAddress as `0x${string}`;
  }

  return null;
}

export function getCtfTokenAddress(chainId = POLYMARKET_CHAIN_ID): `0x${string}` | null {
  const configuredAddress = process.env.NEXT_PUBLIC_CTF_TOKEN_ADDRESS?.trim();
  const normalizedConfiguredAddress = configuredAddress ? normalizeAddress(configuredAddress) : null;
  if (normalizedConfiguredAddress) {
    return normalizedConfiguredAddress;
  }

  if (chainId === 137) {
    return polygonCtfAddress as `0x${string}`;
  }

  return null;
}

export function getPolymarketApprovalAddresses(chainId = POLYMARKET_CHAIN_ID): `0x${string}`[] {
  const configuredRaw = process.env.NEXT_PUBLIC_POLYMARKET_APPROVAL_ADDRESSES?.trim();
  if (configuredRaw) {
    return configuredRaw
      .split(',')
      .map((value) => normalizeAddress(value))
      .filter((value): value is `0x${string}` => Boolean(value));
  }

  if (chainId === 137) {
    return [...polygonApprovalTargets];
  }

  return [];
}

export function createPolymarketPublicClient(chainId = POLYMARKET_CHAIN_ID) {
  if (chainId === polygon.id) {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL;
    return createPublicClient({
      chain: polygon,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });
  }

  if (chainId === polygonAmoy.id) {
    const rpcUrl = process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL;
    return createPublicClient({
      chain: polygonAmoy,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });
  }

  throw new Error(`Unsupported chain id ${chainId}`);
}

export function getTargetChainHex(chainId = POLYMARKET_CHAIN_ID): `0x${string}` {
  return `0x${chainId.toString(16)}` as `0x${string}`;
}

export function getExplorerTxUrl(txHash: string, chainId = POLYMARKET_CHAIN_ID): string {
  if (chainId === 137) {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  if (chainId === 80002) {
    return `https://amoy.polygonscan.com/tx/${txHash}`;
  }
  return `https://polygonscan.com/tx/${txHash}`;
}
