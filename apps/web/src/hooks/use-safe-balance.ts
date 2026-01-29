import useSWR from 'swr';
import { usePublicClient } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CONTRACTS } from '@/lib/polymarket';

export function useSafeBalance(safeAddress?: `0x${string}` | null) {
  const publicClient = usePublicClient({ chainId: POLYMARKET_CHAIN_ID });
  const key = safeAddress && publicClient ? `safe-balance:${safeAddress}` : null;

  const { data, error, isLoading } = useSWR(
    key,
    async () => {
      if (!publicClient || !safeAddress) return null;
      const balance = await publicClient.readContract({
        address: POLYMARKET_CONTRACTS.usdcE as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress],
      });
      return balance as bigint;
    },
    {
      refreshInterval: 30000,
    }
  );

  return {
    balance: data ?? null,
    balanceDisplay: data ? formatUnits(data, 6) : '0',
    error,
    isLoading,
  };
}
