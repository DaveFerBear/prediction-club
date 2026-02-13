export const POLYMARKET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 137);
export const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com';

const polygonUsdcEAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export function getUsdcTokenAddress(chainId = POLYMARKET_CHAIN_ID): `0x${string}` | null {
  const configuredAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS?.trim();
  if (configuredAddress && addressPattern.test(configuredAddress)) {
    return configuredAddress as `0x${string}`;
  }

  if (chainId === 137) {
    return polygonUsdcEAddress as `0x${string}`;
  }

  return null;
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
