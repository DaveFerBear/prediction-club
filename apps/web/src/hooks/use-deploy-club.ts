import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import {
  deploySafe,
  deployClubVault,
  type DeployClubResult,
  type SupportedChainId,
  type Address,
  getChainConfig,
} from '@prediction-club/chain';

export type DeployStatus =
  | 'idle'
  | 'switching-chain'
  | 'deploying-safe'
  | 'deploying-vault'
  | 'success'
  | 'error';
export type DeployErrorStage =
  | 'connect'
  | 'switching-chain'
  | 'deploying-safe'
  | 'deploying-vault'
  | 'unknown';

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
  const [errorStage, setErrorStage] = useState<DeployErrorStage | null>(null);
  const [result, setResult] = useState<DeployClubResult | null>(null);
  const [safeResult, setSafeResult] = useState<Pick<
    DeployClubResult,
    'safeAddress' | 'safeTxHash'
  > | null>(null);

  const deploy = useCallback(
    async (options?: { skipSafe?: boolean }) => {
      if (
        status === 'switching-chain' ||
        status === 'deploying-safe' ||
        status === 'deploying-vault'
      ) {
        return null;
      }
      if (result) {
        return result;
      }
      if (!address) {
        const err = new Error('Please connect your wallet');
        setStatus('error');
        setError(err);
        setErrorStage('connect');
        onError?.(err);
        return null;
      }

      setError(null);
      setErrorStage(null);
      setResult(null);
      if (!options?.skipSafe) {
        setSafeResult(null);
      }

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
            } catch {
              const error = new Error(
                `Failed to add ${getChainConfig(chainId).name} network to wallet`
              );
              setStatus('error');
              setError(error);
              setErrorStage('switching-chain');
              onError?.(error);
              return null;
            }
          } else {
            const error = new Error(`Please switch to the correct network (chain ${chainId})`);
            setStatus('error');
            setError(error);
            setErrorStage('switching-chain');
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
        setErrorStage('deploying-safe');
        onError?.(err);
        return null;
      }

      try {
        let resolvedSafe = safeResult;
        if (!options?.skipSafe || !resolvedSafe) {
          setStatus('deploying-safe');
          const createdSafe = await deploySafe({
            walletClient,
            publicClient,
            owners: [address],
            threshold: 1,
          });
          resolvedSafe = { safeAddress: createdSafe.address, safeTxHash: createdSafe.txHash };
          setSafeResult(resolvedSafe);
        }

        setStatus('deploying-vault');
        const config = getChainConfig(chainId);
        const usdcAddress = config.usdc as Address;
        let vaultResult: Awaited<ReturnType<typeof deployClubVault>> | null = null;
        try {
          vaultResult = await deployClubVault({
            walletClient,
            publicClient,
            safeAddress: resolvedSafe.safeAddress,
            usdcAddress,
          });
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Deployment failed');
          setStatus('error');
          setError(error);
          setErrorStage('deploying-vault');
          onError?.(error);
          return null;
        }

        const deployResult: DeployClubResult = {
          safeAddress: resolvedSafe.safeAddress,
          vaultAddress: vaultResult.address,
          safeTxHash: resolvedSafe.safeTxHash,
          vaultTxHash: vaultResult.txHash,
        };

        setStatus('success');
        setResult(deployResult);
        onSuccess?.(deployResult);
        return deployResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Deployment failed');
        setStatus('error');
        setError(error);
        setErrorStage('deploying-safe');
        onError?.(error);
        return null;
      }
    },
    [
      address,
      connectedChain,
      walletClient,
      publicClient,
      chainId,
      switchChainAsync,
      onSuccess,
      onError,
      result,
      safeResult,
      status,
    ]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setErrorStage(null);
    setResult(null);
    setSafeResult(null);
  }, []);

  const retrySafe = useCallback(() => {
    setStatus('idle');
    setError(null);
    setErrorStage(null);
    setResult(null);
    setSafeResult(null);
    return deploy();
  }, [deploy]);

  const retryVault = useCallback(() => {
    if (!safeResult) {
      return deploy();
    }
    setStatus('idle');
    setError(null);
    setErrorStage(null);
    setResult(null);
    return deploy({ skipSafe: true });
  }, [deploy, safeResult]);

  return {
    deploy,
    retrySafe,
    retryVault,
    reset,
    status,
    error,
    errorStage,
    result,
    safeResult,
    isDeploying:
      status === 'switching-chain' || status === 'deploying-safe' || status === 'deploying-vault',
    isSuccess: status === 'success',
    isError: status === 'error',
    needsChainSwitch: connectedChain?.id !== chainId,
  };
}
