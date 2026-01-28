import { useCallback, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { POLYMARKET_CHAIN_ID } from '@/lib/polymarket';
import { usePolymarketRelayClient } from './use-polymarket-relay-client';

export function usePolymarketSafe() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: POLYMARKET_CHAIN_ID });
  const { relayClient } = usePolymarketRelayClient();
  const [isDeploying, setIsDeploying] = useState(false);

  const safeAddress = useMemo<`0x${string}` | null>(() => {
    if (!address) return null;
    const config = getContractConfig(POLYMARKET_CHAIN_ID);
    const derived = deriveSafe(address, config.SafeContracts.SafeFactory);
    return isHexAddress(derived) ? derived : null;
  }, [address]);

  const isSafeDeployed = useCallback(async () => {
    if (!publicClient || !safeAddress) return false;
    const code = await publicClient.getBytecode({ address: safeAddress });
    return !!code && code !== '0x';
  }, [publicClient, safeAddress]);

  const deploySafe = useCallback(async () => {
    if (!relayClient || !safeAddress) {
      throw new Error('Wallet not connected');
    }

    const deployed = await isSafeDeployed();
    if (deployed) {
      return safeAddress;
    }

    setIsDeploying(true);
    try {
      const response = await relayClient.deploy();
      const result = await response.wait();
      return result?.proxyAddress || safeAddress;
    } finally {
      setIsDeploying(false);
    }
  }, [relayClient, safeAddress, isSafeDeployed]);

  return {
    safeAddress,
    isDeploying,
    isSafeDeployed,
    deploySafe,
  };
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
