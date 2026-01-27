import { z } from 'zod';

/**
 * Environment configuration schema
 */
export const chainEnvSchema = z.object({
  // RPC URLs
  POLYGON_RPC_URL: z.string().url().optional(),
  AMOY_RPC_URL: z.string().url().optional(),

  // Default chain
  DEFAULT_CHAIN_ID: z.coerce.number().default(80002), // Amoy testnet

  // Contract addresses (optional, can be per-club)
  DEFAULT_USDC_ADDRESS: z.string().optional(),
});

export type ChainEnv = z.infer<typeof chainEnvSchema>;

/**
 * Supported chain configurations
 */
const POLYGON_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
  process.env.POLYGON_RPC_URL ||
  'https://polygon-rpc.com';

const AMOY_RPC_URL =
  process.env.NEXT_PUBLIC_AMOY_RPC_URL ||
  process.env.AMOY_RPC_URL ||
  'https://rpc-amoy.polygon.technology';

export const CHAIN_CONFIG = {
  // Polygon Mainnet
  137: {
    name: 'Polygon',
    rpcUrl: POLYGON_RPC_URL,
    blockExplorer: 'https://polygonscan.com',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
    usdce: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC.e (bridged)
    nativeCurrency: {
      name: 'POL',
      symbol: 'POL',
      decimals: 18,
    },
  },
  // Polygon Amoy Testnet
  80002: {
    name: 'Polygon Amoy',
    rpcUrl: AMOY_RPC_URL,
    blockExplorer: 'https://amoy.polygonscan.com',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Test USDC (verify)
    nativeCurrency: {
      name: 'POL',
      symbol: 'POL',
      decimals: 18,
    },
  },
} as const;

export type SupportedChainId = keyof typeof CHAIN_CONFIG;

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in CHAIN_CONFIG;
}

export function getChainConfig(chainId: SupportedChainId) {
  return CHAIN_CONFIG[chainId];
}

/**
 * USDC has 6 decimals
 */
export const USDC_DECIMALS = 6;

/**
 * Parse USDC amount from human-readable to wei
 */
export function parseUsdc(amount: string | number): bigint {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return BigInt(Math.floor(num * 10 ** USDC_DECIMALS));
}

/**
 * Format USDC amount from wei to human-readable
 */
export function formatUsdc(amount: bigint): string {
  const num = Number(amount) / 10 ** USDC_DECIMALS;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
