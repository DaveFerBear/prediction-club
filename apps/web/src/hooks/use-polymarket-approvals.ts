import { useCallback, useMemo, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { encodeFunctionData, erc1155Abi, erc20Abi, maxUint256 } from 'viem';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CONTRACTS } from '@/lib/polymarket';
import { usePolymarketRelayClient } from './use-polymarket-relay-client';

type RelayTransaction = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
};

const usdcSpenders = [
  POLYMARKET_CONTRACTS.ctf,
  POLYMARKET_CONTRACTS.ctfExchange,
  POLYMARKET_CONTRACTS.negRiskCtfExchange,
  POLYMARKET_CONTRACTS.negRiskAdapter,
] as const;

const outcomeOperators = [
  POLYMARKET_CONTRACTS.ctfExchange,
  POLYMARKET_CONTRACTS.negRiskCtfExchange,
  POLYMARKET_CONTRACTS.negRiskAdapter,
] as const;

export function usePolymarketApprovals() {
  const publicClient = usePublicClient({ chainId: POLYMARKET_CHAIN_ID });
  const { relayClient } = usePolymarketRelayClient();
  const [isApproving, setIsApproving] = useState(false);

  const approvalTransactions = useMemo<RelayTransaction[]>(() => {
    const approvals: RelayTransaction[] = [];

    for (const spender of usdcSpenders) {
      approvals.push({
        to: POLYMARKET_CONTRACTS.usdcE as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender as `0x${string}`, maxUint256],
        }),
        value: '0',
      });
    }

    for (const operator of outcomeOperators) {
      approvals.push({
        to: POLYMARKET_CONTRACTS.ctf as `0x${string}`,
        data: encodeFunctionData({
          abi: erc1155Abi,
          functionName: 'setApprovalForAll',
          args: [operator as `0x${string}`, true],
        }),
        value: '0',
      });
    }

    return approvals;
  }, []);

  const checkApprovals = useCallback(
    async (safeAddress: `0x${string}`) => {
      if (!publicClient) {
        return { allApproved: false };
      }

      const usdcAllowances = await Promise.all(
        usdcSpenders.map((spender) =>
          publicClient.readContract({
            address: POLYMARKET_CONTRACTS.usdcE as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [safeAddress, spender as `0x${string}`],
          })
        )
      );

      const erc1155Approvals = await Promise.all(
        outcomeOperators.map((operator) =>
          publicClient.readContract({
            address: POLYMARKET_CONTRACTS.ctf as `0x${string}`,
            abi: erc1155Abi,
            functionName: 'isApprovedForAll',
            args: [safeAddress, operator as `0x${string}`],
          })
        )
      );

      const usdcApproved = usdcAllowances.every((allowance) => allowance > 0n);
      const erc1155Approved = erc1155Approvals.every(Boolean);

      return { allApproved: usdcApproved && erc1155Approved };
    },
    [publicClient]
  );

  const approveAll = useCallback(async () => {
    if (!relayClient) {
      throw new Error('Wallet not connected');
    }

    setIsApproving(true);
    try {
      const response = await relayClient.execute(approvalTransactions, 'Set Polymarket approvals');
      await response.wait();
    } finally {
      setIsApproving(false);
    }
  }, [relayClient, approvalTransactions]);

  return { checkApprovals, approveAll, isApproving };
}
