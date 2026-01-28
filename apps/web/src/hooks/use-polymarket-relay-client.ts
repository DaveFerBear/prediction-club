import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { getPolymarketBuilderConfig, POLYMARKET_CHAIN_ID, POLYMARKET_RELAYER_URL } from '@/lib/polymarket';

export function usePolymarketRelayClient() {
  const { data: walletClient } = useWalletClient({ chainId: POLYMARKET_CHAIN_ID });

  const relayClient = useMemo(() => {
    if (!walletClient) return null;
    const builderConfig = getPolymarketBuilderConfig();
    return new RelayClient(POLYMARKET_RELAYER_URL, POLYMARKET_CHAIN_ID, walletClient, builderConfig);
  }, [walletClient]);

  return { relayClient, walletClient };
}
