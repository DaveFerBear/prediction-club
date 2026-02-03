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

const MIN_ALLOWANCE = 10_000n * 10n ** 6n;

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
  const { relayClient, relaySafeAddress } = usePolymarketRelayClient();
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

      const usdcApproved = usdcAllowances.every((allowance) => allowance >= MIN_ALLOWANCE);
      const erc1155Approved = erc1155Approvals.every(Boolean);

      return { allApproved: usdcApproved && erc1155Approved };
    },
    [publicClient]
  );

  const approveAll = useCallback(
    async (expectedSafe: `0x${string}`) => {
    if (!relayClient) {
      throw new Error('Wallet not connected');
    }

    if (!relaySafeAddress || relaySafeAddress.toLowerCase() !== expectedSafe.toLowerCase()) {
      throw new Error('Relay is configured for a different Safe');
    }

    setIsApproving(true);
    try {
      const response = await relayClient.execute(approvalTransactions, 'Set Polymarket approvals');
      await response.wait();
    } finally {
      setIsApproving(false);
    }
  }, [relayClient, relaySafeAddress, approvalTransactions]);

  return { checkApprovals, approveAll, isApproving };
}
