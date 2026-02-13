'use client';

import { useReducer } from 'react';
import { parseUnits } from 'viem';
import { utils } from 'ethers';
import { useSWRConfig } from 'swr';
import { useApi } from './use-api';
import { POLYMARKET_CHAIN_ID, getTargetChainHex, getUsdcTokenAddress } from '@/lib/polymarket';

type DepositState =
  | { tag: 'idle' }
  | { tag: 'connecting' }
  | { tag: 'switching-chain' }
  | { tag: 'submitting' }
  | { tag: 'confirming' }
  | { tag: 'success'; txHash: string }
  | { tag: 'error'; message: string };

type DepositAction =
  | { type: 'set'; state: DepositState }
  | { type: 'reset' };

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

type DepositResponse = {
  success: boolean;
  data?: { txHash: string };
};

const initialState: DepositState = { tag: 'idle' };

function depositReducer(_state: DepositState, action: DepositAction): DepositState {
  if (action.type === 'reset') return initialState;
  return action.state;
}

function getInjectedProvider(): EthereumProvider {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!provider) {
    throw new Error('No browser wallet detected. Install MetaMask (or another injected wallet).');
  }
  return provider;
}

function normalizeHexAddress(value: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('Invalid wallet address');
  }
  return value.toLowerCase() as `0x${string}`;
}

async function ensureConnectedAddress(provider: EthereumProvider): Promise<`0x${string}`> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[] | undefined;
  const selected = accounts?.[0];
  if (!selected) {
    throw new Error('No wallet account available');
  }
  return normalizeHexAddress(selected);
}

async function ensureChain(provider: EthereumProvider) {
  const currentChainHex = (await provider.request({ method: 'eth_chainId' })) as string;
  const targetChainHex = getTargetChainHex();
  if (currentChainHex?.toLowerCase() === targetChainHex.toLowerCase()) {
    return;
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainHex }],
    });
  } catch {
    throw new Error(`Switch wallet network to chain ${POLYMARKET_CHAIN_ID} and try again.`);
  }
}

async function waitForReceipt(input: { provider: EthereumProvider; txHash: string }) {
  const timeoutMs = 120_000;
  const pollMs = 1_500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = (await input.provider.request({
      method: 'eth_getTransactionReceipt',
      params: [input.txHash],
    })) as { status?: string } | null;

    if (receipt) {
      if (receipt.status === '0x1') return;
      throw new Error('Transaction failed onchain.');
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error('Timed out waiting for transaction confirmation.');
}

export function useClubWalletDeposit(slug: string) {
  const { fetch } = useApi();
  const { mutate } = useSWRConfig();
  const [state, dispatch] = useReducer(depositReducer, initialState);

  const reset = () => dispatch({ type: 'reset' });

  const submitDeposit = async (input: {
    amount: string;
    clubWalletAddress: string;
  }) => {
    const trimmed = input.amount.trim();
    if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
      dispatch({ type: 'set', state: { tag: 'error', message: 'Enter a valid USDC amount.' } });
      return;
    }

    const tokenAddress = getUsdcTokenAddress();
    if (!tokenAddress) {
      dispatch({
        type: 'set',
        state: {
          tag: 'error',
          message: 'USDC token address is not configured for the current chain.',
        },
      });
      return;
    }

    try {
      dispatch({ type: 'set', state: { tag: 'connecting' } });
      const provider = getInjectedProvider();
      const from = await ensureConnectedAddress(provider);

      dispatch({ type: 'set', state: { tag: 'switching-chain' } });
      await ensureChain(provider);

      const destination = normalizeHexAddress(input.clubWalletAddress);
      const amountBaseUnits = parseUnits(trimmed, 6);
      if (amountBaseUnits <= 0n) {
        throw new Error('Amount must be greater than zero.');
      }

      const transferData = new utils.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]).encodeFunctionData('transfer', [destination, amountBaseUnits.toString()]);

      dispatch({ type: 'set', state: { tag: 'submitting' } });
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from,
            to: tokenAddress,
            data: transferData,
            value: '0x0',
          },
        ],
      })) as string;

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        throw new Error('Wallet returned an invalid transaction hash.');
      }

      dispatch({ type: 'set', state: { tag: 'confirming' } });
      await waitForReceipt({ provider, txHash });

      await fetch<DepositResponse>(`/api/clubs/${slug}/wallet/deposit`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountBaseUnits.toString(),
          txHash,
        }),
      });

      await Promise.all([
        mutate(`/api/clubs/${slug}/wallet`),
        mutate(`/api/clubs/${slug}`),
        mutate('/api/user/balance'),
      ]);

      dispatch({ type: 'set', state: { tag: 'success', txHash } });
    } catch (error) {
      dispatch({
        type: 'set',
        state: {
          tag: 'error',
          message: error instanceof Error ? error.message : 'Failed to deposit into club wallet.',
        },
      });
    }
  };

  return {
    state,
    isBusy:
      state.tag === 'connecting' ||
      state.tag === 'switching-chain' ||
      state.tag === 'submitting' ||
      state.tag === 'confirming',
    reset,
    submitDeposit,
  };
}
