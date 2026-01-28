import { BuilderConfig } from '@polymarket/builder-signing-sdk';

export const POLYMARKET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 137);
export const POLYMARKET_RELAYER_URL = 'https://relayer-v2.polymarket.com/';
export const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com';

export const POLYMARKET_CONTRACTS = {
  usdcE: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  ctf: '0x4d97dcd97ec945f40cf65f87097ace5ea0476045',
  ctfExchange: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  negRiskCtfExchange: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  negRiskAdapter: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
} as const;

export function getPolymarketBuilderConfig() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const url = baseUrl ? new URL('/api/polymarket/sign', baseUrl).toString() : '';

  return new BuilderConfig({
    remoteBuilderConfig: { url },
  });
}
