import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { getPolymarketBuilderConfig, POLYMARKET_CHAIN_ID, POLYMARKET_RELAYER_URL } from '@/lib/polymarket';

export function usePolymarketRelayClient() {
  const { data: walletClient } = useWalletClient();

  const relayClient = useMemo(() => {
    if (!walletClient) return null;
    const builderConfig = getPolymarketBuilderConfig();
    return new RelayClient(POLYMARKET_RELAYER_URL, POLYMARKET_CHAIN_ID, walletClient, builderConfig);
  }, [walletClient]);

  const relaySafeAddress = useMemo<`0x${string}` | null>(() => {
    const account = walletClient?.account?.address;
    if (!account) return null;
    const config = getContractConfig(POLYMARKET_CHAIN_ID);
    const derived = deriveSafe(account, config.SafeContracts.SafeFactory);
    return isHexAddress(derived) ? derived : null;
  }, [walletClient]);

  return { relayClient, relaySafeAddress, walletClient };
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
