'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Web3Provider, type ExternalProvider } from '@ethersproject/providers';
import { ClobClient } from '@polymarket/clob-client';
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, type WalletClient } from 'viem';
import { injected } from 'wagmi/connectors';
import { useSession } from 'next-auth/react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { ActiveCheckList, ActiveCheckListItem } from '@/components/active-check-list';
import { CopyableAddress } from '@/components/copyable-address';
import { POLYMARKET_CHAIN_ID, POLYMARKET_CLOB_URL, POLYMARKET_CONTRACTS } from '@/lib/polymarket';
import {
  useApi,
  usePolymarketApprovals,
  usePolymarketCreds,
  usePolymarketSafe,
  useSiweSignIn,
} from '@/hooks';

type SetupStatus =
  | 'idle'
  | 'connecting'
  | 'switching-chain'
  | 'signing-in'
  | 'deriving-creds'
  | 'saving-creds'
  | 'deploying-safe'
  | 'funding-safe'
  | 'checking-approvals'
  | 'approving'
  | 'success'
  | 'error';

type ApiCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

type WalletClientWithAccount = WalletClient & { account: { address: `0x${string}` } };

function walletClientToSigner(walletClient?: WalletClientWithAccount | null) {
  if (!walletClient) return null;
  const chainId = walletClient.chain?.id;
  if (!chainId) return null;
  // TODO: Replace with a proper viem->ethers provider adapter to avoid casting transport.
  const provider = new Web3Provider(walletClient.transport as unknown as ExternalProvider, chainId);
  return provider.getSigner(walletClient.account.address);
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, isPending: isConnecting } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: POLYMARKET_CHAIN_ID });
  const signer = useMemo(() => walletClientToSigner(walletClient), [walletClient]);
  const { data: session, status: sessionStatus } = useSession();
  const { signInWithSiwe } = useSiweSignIn();
  const publicClient = usePublicClient({ chainId: POLYMARKET_CHAIN_ID });
  const { fetch } = useApi();

  const { saveCreds } = usePolymarketCreds();
  const { safeAddress, deploySafe } = usePolymarketSafe();
  const { checkApprovals, approveAll } = usePolymarketApprovals();

  const [step] = useState<1 | 2>(2);
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<ApiCreds | null>(null);
  const [safeReady, setSafeReady] = useState(false);
  const [approvalsReady, setApprovalsReady] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);
  const [safeFunded, setSafeFunded] = useState(false);
  const [safeBalanceUsdcE, setSafeBalanceUsdcE] = useState<bigint | null>(null);
  const [safeBalanceUsdc, setSafeBalanceUsdc] = useState<bigint | null>(null);
  const [credsChecked, setCredsChecked] = useState(false);
  const [safeAddressOverride, setSafeAddressOverride] = useState<string | null>(null);
  const lastChainCheckRef = useRef(0);
  const chainCheckInFlightRef = useRef(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chainReady = chainId === POLYMARKET_CHAIN_ID && !!walletClient;
  const connectComplete = isConnected;
  const sessionAddress = session?.address?.toLowerCase() ?? null;
  const walletAddress = address?.toLowerCase() ?? null;
  const isAuthenticated = !!sessionAddress && sessionAddress === walletAddress;
  const effectiveSafeAddress = safeAddressOverride ?? safeAddress;
  const credsReady = !!creds || credsSaved;
  const safeBalanceDisplay = formatUnits(safeBalanceUsdcE ?? BigInt(0), 6);
  // TODO: Fetch market-committed balance via relayer API.
  const marketBalanceDisplay = '0';
  const completedSteps = [
    connectComplete,
    credsReady,
    safeReady,
    approvalsReady,
    safeFunded,
    credsSaved,
  ].filter(Boolean).length;
  const progressValue = step === 1 ? 0 : Math.min(100, Math.round((completedSteps / 6) * 100));

  const statusMessage = (() => {
    switch (status) {
      case 'connecting':
        return 'Connecting wallet...';
      case 'switching-chain':
        return 'Switching to Polygon...';
      case 'signing-in':
        return 'Signing in...';
      case 'deriving-creds':
        return 'Deriving Polymarket API credentials...';
      case 'saving-creds':
        return 'Saving credentials to server...';
      case 'deploying-safe':
        return 'Deploying Safe...';
      case 'funding-safe':
        return 'Funding Safe...';
      case 'checking-approvals':
        return 'Checking approvals...';
      case 'approving':
        return 'Setting approvals...';
      case 'success':
        return 'Profile setup complete.';
      default:
        return null;
    }
  })();

  const safeComplete = safeReady;
  const approvalsComplete = approvalsReady;

  const checkSafeDeployed = useCallback(
    async (targetAddress: string) => {
      if (!publicClient) return false;
      const code = await publicClient.getBytecode({ address: toHexAddress(targetAddress) });
      return !!code && code !== '0x';
    },
    [publicClient]
  );

  useEffect(() => {
    if (!isAuthenticated || credsChecked) return;
    let cancelled = false;

    const runCheck = async () => {
      try {
        const response = await fetch<{
          success: boolean;
          data?: { hasCreds: boolean; safeAddress: string | null };
        }>('/api/polymarket/creds');

        if (cancelled) return;
        if (response?.success && response.data?.hasCreds) {
          setCredsSaved(true);
          setCreds({ key: 'saved', secret: 'saved', passphrase: 'saved' });
        }
        if (response?.success && response.data?.safeAddress) {
          setSafeAddressOverride(response.data.safeAddress);
        }
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) {
          setCredsChecked(true);
        }
      }
    };

    runCheck();
    return () => {
      cancelled = true;
    };
  }, [credsChecked, fetch, isAuthenticated]);

  useEffect(() => {
    if (!effectiveSafeAddress || !publicClient) return;
    let cancelled = false;

    const runCheck = async () => {
      if (chainCheckInFlightRef.current) return;
      if (status === 'deploying-safe') return;
      const now = Date.now();
      if (now - lastChainCheckRef.current < 15000) return;
      lastChainCheckRef.current = now;
      chainCheckInFlightRef.current = true;
      setStatus('checking-approvals');
      console.log('[profile] safe check start', {
        effectiveSafeAddress,
        derivedSafeAddress: safeAddress,
        status,
      });
      try {
        let deployed = await checkSafeDeployed(effectiveSafeAddress);
        let deployedAddress: string | null = deployed ? effectiveSafeAddress : null;
        console.log('[profile] effective safe deployed', {
          deployed,
          address: effectiveSafeAddress,
        });
        if (!deployed && safeAddress && safeAddress !== effectiveSafeAddress) {
          const derivedDeployed = await checkSafeDeployed(safeAddress);
          console.log('[profile] derived safe deployed', {
            deployed: derivedDeployed,
            address: safeAddress,
          });
          if (derivedDeployed) {
            deployed = true;
            deployedAddress = safeAddress;
            setSafeAddressOverride(safeAddress);
            try {
              await fetch('/api/polymarket/creds', {
                method: 'POST',
                body: JSON.stringify({ safeAddress }),
              });
            } catch {
              // best-effort persistence
            }
          }
        }
        if (cancelled) return;
        setSafeReady(deployed);

        if (deployed) {
          const targetAddress = toHexAddress(deployedAddress ?? effectiveSafeAddress);
          const approvalStatus = await checkApprovals(targetAddress);
          if (cancelled) return;
          setApprovalsReady(approvalStatus.allApproved);
          console.log('[profile] approvals checked', {
            address: targetAddress,
            allApproved: approvalStatus.allApproved,
          });
        } else {
          setApprovalsReady(false);
          if (!cancelled) {
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            retryTimeoutRef.current = setTimeout(() => {
              if (cancelled) return;
              lastChainCheckRef.current = 0;
              runCheck();
            }, 20000);
          }
        }

        const [balanceUsdcE, balanceUsdc] = await Promise.all([
          publicClient.readContract({
            address: POLYMARKET_CONTRACTS.usdcE as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [toHexAddress(deployedAddress ?? effectiveSafeAddress)],
          }),
          publicClient.readContract({
            address: POLYMARKET_CONTRACTS.usdc as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [toHexAddress(deployedAddress ?? effectiveSafeAddress)],
          }),
        ]);

        if (cancelled) return;
        setSafeBalanceUsdcE(balanceUsdcE);
        setSafeBalanceUsdc(balanceUsdc);
        setSafeFunded(balanceUsdcE > BigInt(0));
        console.log('[profile] safe balance', {
          address: deployedAddress ?? effectiveSafeAddress,
          balanceUsdcE: balanceUsdcE.toString(),
          balanceUsdc: balanceUsdc.toString(),
        });
        setStatus('idle');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to check Safe');
        console.log('[profile] safe check error', err);
      } finally {
        chainCheckInFlightRef.current = false;
      }
    };

    runCheck();
    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [checkApprovals, checkSafeDeployed, effectiveSafeAddress, publicClient]);
  const ensureConnected = async () => {
    setError(null);
    if (!isConnected) {
      setStatus('connecting');
      connect({ connector: injected() });
      return false;
    }
    if (chainId !== POLYMARKET_CHAIN_ID) {
      setStatus('switching-chain');
      await switchChainAsync({ chainId: POLYMARKET_CHAIN_ID });
      return false;
    }
    if (!walletClient || !signer) {
      setStatus('connecting');
      connect({ connector: injected(), chainId: POLYMARKET_CHAIN_ID });
      return false;
    }
    if (sessionStatus === 'loading') {
      setStatus('signing-in');
      return false;
    }
    if (!isAuthenticated) {
      setStatus('signing-in');
      try {
        await signInWithSiwe();
        setStatus('idle');
        return true;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to sign in');
        return false;
      }
    }
    return true;
  };

  const handleFundSafe = async () => {
    const ok = await ensureConnected();
    if (!ok) return;
    if (!walletClient || !effectiveSafeAddress) {
      setError('Safe address not available');
      setStatus('error');
      return;
    }
    const input = window.prompt('Amount of USDC.e to send', '5');
    if (!input) return;
    const trimmed = input.trim();
    if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
      setError('Invalid amount');
      setStatus('error');
      return;
    }

    setStatus('funding-safe');
    try {
      const safeAddressHex = toHexAddress(effectiveSafeAddress);
      await walletClient.writeContract({
        address: POLYMARKET_CONTRACTS.usdcE,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [safeAddressHex, parseUnits(trimmed, 6)],
      });
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to fund Safe');
    }
  };

  const handleDeriveCreds = async () => {
    const ok = await ensureConnected();
    if (!ok || !signer) return;
    setStatus('deriving-creds');
    try {
      const tmpClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID, signer);
      let derived: ApiCreds | null = null;
      try {
        derived = await tmpClient.deriveApiKey();
      } catch {
        derived = await tmpClient.createApiKey();
      }
      setCreds(derived);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to derive credentials');
    }
  };

  const handleDeploySafe = async () => {
    const ok = await ensureConnected();
    if (!ok) return;
    setStatus('deploying-safe');
    try {
      const deployedSafe = await deploySafe();
      if (!deployedSafe) {
        throw new Error('Safe address not available');
      }
      setSafeReady(true);
      setSafeAddressOverride(deployedSafe);
      try {
        await fetch('/api/polymarket/creds', {
          method: 'POST',
          body: JSON.stringify({ safeAddress: deployedSafe }),
        });
      } catch {
        // best-effort persistence
      }
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to deploy Safe');
    }
  };

  const handleApproveAll = async () => {
    const ok = await ensureConnected();
    if (!ok) return;
    if (!safeAddress) {
      setError('Safe address not available');
      setStatus('error');
      return;
    }
    setStatus('approving');
    try {
      await approveAll();
      setApprovalsReady(true);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleSaveCreds = async () => {
    const ok = await ensureConnected();
    if (!ok) return;
    if (!creds || !safeAddress) {
      setError('Credentials or Safe address missing');
      setStatus('error');
      return;
    }
    setStatus('saving-creds');
    try {
      const response = await saveCreds({
        key: creds.key,
        secret: creds.secret,
        passphrase: creds.passphrase,
        safeAddress,
      });
      if (response && !response.success) {
        throw new Error(response.error?.message || 'Failed to save credentials');
      }
      setCredsSaved(true);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Profile Setup</h1>
          <p className="text-muted-foreground">Set up Polymarket access to trade with your club.</p>
        </div>

        <Card className="mb-6 max-w-2xl">
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Track funds held in the Safe vs markets.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Safe balance (uncommitted)
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {safeBalanceDisplay}{' '}
                  <span className="text-base text-muted-foreground">USDC.e</span>
                </div>
                {safeBalanceUsdc !== null && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    USDC (native): {formatUnits(safeBalanceUsdc, 6)}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">In markets</div>
                <div className="mt-2 text-2xl font-semibold">
                  {marketBalanceDisplay}{' '}
                  <span className="text-base text-muted-foreground">USDC.e</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <Progress value={progressValue} className="mb-4" />
            <CardTitle>Initialize Polymarket</CardTitle>
            <CardDescription>Follow the steps below to finish your setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {statusMessage && (
                <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600">
                  {statusMessage}
                </div>
              )}

              {error && (
                <div className="break-words rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <ActiveCheckList>
                <ActiveCheckListItem
                  active
                  status={
                    connectComplete
                      ? 'complete'
                      : isConnecting || isSwitching
                        ? 'in-progress'
                        : 'idle'
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      1
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Connect wallet</span>
                      {address && <span className="text-xs text-muted-foreground">{address}</span>}
                      {isConnected && !chainReady && (
                        <span className="text-xs text-muted-foreground">
                          Switch to Polygon to continue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isConnected && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          connect({ connector: injected(), chainId: POLYMARKET_CHAIN_ID })
                        }
                        disabled={isConnecting || isSwitching}
                      >
                        {isConnecting || isSwitching ? 'Connecting...' : 'Connect'}
                      </Button>
                    )}
                    {isConnected && !chainReady && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => switchChainAsync({ chainId: POLYMARKET_CHAIN_ID })}
                        disabled={isSwitching}
                      >
                        {isSwitching ? 'Switching...' : 'Switch'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>

                <ActiveCheckListItem
                  active
                  status={
                    credsReady ? 'complete' : status === 'deriving-creds' ? 'in-progress' : 'idle'
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      2
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Derive & save API credentials</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!credsReady && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleDeriveCreds}
                        disabled={!connectComplete || status === 'deriving-creds'}
                      >
                        {status === 'deriving-creds' ? 'Deriving...' : 'Derive'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>

                <ActiveCheckListItem
                  active
                  status={
                    safeComplete ? 'complete' : status === 'deploying-safe' ? 'in-progress' : 'idle'
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      3
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Deploy Safe</span>
                      {safeAddress && (
                        <span className="text-xs text-muted-foreground">{safeAddress}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!safeComplete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleDeploySafe}
                        disabled={!connectComplete || status === 'deploying-safe'}
                      >
                        {status === 'deploying-safe' ? 'Deploying...' : 'Deploy'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>

                <ActiveCheckListItem
                  active={safeComplete}
                  status={
                    approvalsComplete
                      ? 'complete'
                      : status === 'approving' || status === 'checking-approvals'
                        ? 'in-progress'
                        : 'idle'
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      4
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Set approvals</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!approvalsComplete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleApproveAll}
                        disabled={!safeComplete || status === 'approving'}
                      >
                        {status === 'approving' ? 'Approving...' : 'Approve'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>

                <ActiveCheckListItem
                  active={approvalsComplete}
                  status={
                    credsSaved ? 'complete' : status === 'saving-creds' ? 'in-progress' : 'idle'
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      5
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Save credentials</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!credsSaved && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSaveCreds}
                        disabled={!approvalsComplete || status === 'saving-creds'}
                      >
                        {status === 'saving-creds' ? 'Saving...' : 'Save'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>

                <ActiveCheckListItem
                  active={safeComplete}
                  status={safeFunded ? 'complete' : 'idle'}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                      6
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium">Fund Safe (USDC.e)</span>
                      {effectiveSafeAddress && (
                        <span className="text-xs text-muted-foreground">
                          Send USDC.e to your Safe address:{' '}
                          <CopyableAddress address={effectiveSafeAddress} variant="inline" />
                        </span>
                      )}
                      {safeBalanceUsdcE !== null && (
                        <span className="text-xs text-muted-foreground">
                          Balance: {formatUnits(safeBalanceUsdcE, 6)} USDC.e
                        </span>
                      )}
                      {safeBalanceUsdc !== null && (
                        <span className="text-xs text-muted-foreground">
                          USDC (native): {formatUnits(safeBalanceUsdc, 6)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        USDC.e token contract (do not send funds here):{' '}
                        <CopyableAddress address={POLYMARKET_CONTRACTS.usdcE} variant="inline" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!safeFunded && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleFundSafe}
                        disabled={!safeComplete || status === 'funding-safe'}
                      >
                        {status === 'funding-safe' ? 'Funding...' : 'Fund'}
                      </Button>
                    )}
                  </div>
                </ActiveCheckListItem>
              </ActiveCheckList>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}

function toHexAddress(value: string | null | undefined): `0x${string}` {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error('Invalid address');
  }
  // TODO: Add a shared branded Address type helper so regex guards narrow automatically.
  return value as `0x${string}`;
}
