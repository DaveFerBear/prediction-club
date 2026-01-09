import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { deployClub, type DeployClubResult, type SupportedChainId, getChainConfig } from '@prediction-club/chain';

export type DeployStatus = 'idle' | 'switching-chain' | 'deploying-safe' | 'deploying-vault' | 'success' | 'error';

interface UseDeployClubOptions {
  chainId: SupportedChainId;
  onSuccess?: (result: DeployClubResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to deploy a new club (Safe + ClubVault)
 *
 * Currently deploys in two separate transactions.
 * TODO: Replace with single-transaction ClubFactory deployment.
 */
export function useDeployClub(options: UseDeployClubOptions) {
  const { chainId, onSuccess, onError } = options;
  const { address, chain: connectedChain } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { switchChainAsync } = useSwitchChain();

  const [status, setStatus] = useState<DeployStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<DeployClubResult | null>(null);

  const deploy = useCallback(async () => {
    if (!address) {
      const err = new Error('Please connect your wallet');
      setError(err);
      onError?.(err);
      return null;
    }

    setError(null);
    setResult(null);

    // Switch chain if needed
    if (connectedChain?.id !== chainId) {
      setStatus('switching-chain');
      try {
        await switchChainAsync({ chainId });
      } catch (err: unknown) {
        // Check if error is "chain not added" (code 4902)
        const errorCode = (err as { code?: number })?.code;
        if (errorCode === 4902) {
          // Try to add the chain first
          try {
            const config = getChainConfig(chainId);
            await window.ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: `0x${chainId.toString(16)}`,
                  chainName: config.name,
                  nativeCurrency: config.nativeCurrency,
                  rpcUrls: [config.rpcUrl],
                  blockExplorerUrls: [config.blockExplorer],
                },
              ],
            });
            // After adding, the wallet should auto-switch, but try switching again just in case
            await switchChainAsync({ chainId });
          } catch (addErr) {
            const error = new Error(`Failed to add ${getChainConfig(chainId).name} network to wallet`);
            setStatus('error');
            setError(error);
            onError?.(error);
            return null;
          }
        } else {
          const error = new Error(`Please switch to the correct network (chain ${chainId})`);
          setStatus('error');
          setError(error);
          onError?.(error);
          return null;
        }
      }
    }

    // Re-check wallet client after chain switch
    if (!walletClient || !publicClient) {
      const err = new Error('Failed to connect to network. Please try again.');
      setStatus('error');
      setError(err);
      onError?.(err);
      return null;
    }

    setStatus('deploying-safe');

    try {
      // Deploy Safe + Vault
      const deployResult = await deployClub({
        walletClient,
        publicClient,
        chainId,
        owners: [address],
        threshold: 1,
      });

      setStatus('success');
      setResult(deployResult);
      onSuccess?.(deployResult);
      return deployResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Deployment failed');
      setStatus('error');
      setError(error);
      onError?.(error);
      return null;
    }
  }, [address, connectedChain, walletClient, publicClient, chainId, switchChainAsync, onSuccess, onError]);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
  }, []);

  return {
    deploy,
    reset,
    status,
    error,
    result,
    isDeploying: status === 'switching-chain' || status === 'deploying-safe' || status === 'deploying-vault',
    isSuccess: status === 'success',
    isError: status === 'error',
    needsChainSwitch: connectedChain?.id !== chainId,
  };
}
