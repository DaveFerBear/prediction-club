'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Web3Provider, type ExternalProvider } from '@ethersproject/providers';
import { ClobClient } from '@polymarket/clob-client';
import { useAccount, useChainId, useConnect, useSwitchChain, useWalletClient } from 'wagmi';
import type { WalletClient } from 'viem';
import { injected } from 'wagmi/connectors';
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
import { usePolymarketApprovals, usePolymarketCreds, usePolymarketSafe } from '@/hooks';

type SetupStatus =
  | 'idle'
  | 'connecting'
  | 'switching-chain'
  | 'deriving-creds'
  | 'saving-creds'
  | 'deploying-safe'
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
  const provider = new Web3Provider(walletClient.transport as unknown as ExternalProvider, chainId);
  return provider.getSigner(walletClient.account.address);
}

export default function ProfilePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, isPending: isConnecting } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: POLYMARKET_CHAIN_ID });
  const signer = useMemo(() => walletClientToSigner(walletClient), [walletClient]);

  const { saveCreds, isSaving } = usePolymarketCreds();
  const { safeAddress, deploySafe, isDeploying, isSafeDeployed } = usePolymarketSafe();
  const { checkApprovals, approveAll, isApproving } = usePolymarketApprovals();

  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<ApiCreds | null>(null);
  const [safeReady, setSafeReady] = useState(false);
  const [approvalsReady, setApprovalsReady] = useState(false);
  const [credsSaved, setCredsSaved] = useState(false);
  const [safeChecked, setSafeChecked] = useState(false);
  const [approvalsChecked, setApprovalsChecked] = useState(false);
  const [safeFunded, setSafeFunded] = useState(false);

  const chainReady = chainId === POLYMARKET_CHAIN_ID && !!walletClient;
  const connectComplete = isConnected;
  const completedSteps = [
    connectComplete,
    !!creds,
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
      case 'deriving-creds':
        return 'Deriving Polymarket API credentials...';
      case 'saving-creds':
        return 'Saving credentials to server...';
      case 'deploying-safe':
        return 'Deploying Safe...';
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

  useEffect(() => {
    if (!connectComplete || !safeAddress || safeReady || safeChecked || status !== 'idle') return;
    let cancelled = false;

    const runCheck = async () => {
      setStatus('checking-approvals');
      try {
        const deployed = await isSafeDeployed();
        if (cancelled) return;
        setSafeReady(deployed);
        setSafeChecked(true);
        setStatus('idle');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to check Safe');
      }
    };

    runCheck();
    return () => {
      cancelled = true;
    };
  }, [connectComplete, safeAddress, safeReady, safeChecked, status, isSafeDeployed]);

  useEffect(() => {
    if (!safeReady || !safeAddress || approvalsReady || approvalsChecked || status !== 'idle')
      return;
    let cancelled = false;

    const runCheck = async () => {
      setStatus('checking-approvals');
      try {
        const approvalStatus = await checkApprovals(safeAddress as `0x${string}`);
        if (cancelled) return;
        setApprovalsReady(approvalStatus.allApproved);
        setApprovalsChecked(true);
        setStatus('idle');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to check approvals');
      }
    };

    runCheck();
    return () => {
      cancelled = true;
    };
  }, [safeReady, safeAddress, approvalsReady, approvalsChecked, status, checkApprovals]);
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
    return true;
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

        <Card className="max-w-2xl">
          <CardHeader>
            <Progress value={progressValue} className="mb-4" />
            <CardTitle>{step === 1 ? 'Get Ready' : 'Initialize Polymarket'}</CardTitle>
            <CardDescription>
              {step === 1
                ? 'We will connect your wallet, derive API credentials, deploy a Safe, and set approvals.'
                : 'Follow the steps below to finish your setup.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <div className="space-y-6">
                <div className="text-sm text-muted-foreground">
                  This flow uses your wallet to create Polymarket API credentials, deploys a Safe
                  through the relayer, and approves trading contracts.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    Back
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => setStep(2)}>
                    Start setup
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {statusMessage && (
                  <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600">
                    {statusMessage}
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
                        {address && (
                          <span className="text-xs text-muted-foreground">{address}</span>
                        )}
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
                      creds ? 'complete' : status === 'deriving-creds' ? 'in-progress' : 'idle'
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
                      {!creds && (
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
                      safeComplete
                        ? 'complete'
                        : status === 'deploying-safe'
                          ? 'in-progress'
                          : 'idle'
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSaveCreds}
                        disabled={!approvalsComplete || credsSaved || status === 'saving-creds'}
                      >
                        {status === 'saving-creds' ? 'Saving...' : 'Save'}
                      </Button>
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
                        {safeAddress && (
                          <span className="text-xs text-muted-foreground">
                            Send USDC.e to{' '}
                            <CopyableAddress address={safeAddress} variant="inline" />
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          USDC.e:{' '}
                          <CopyableAddress address={POLYMARKET_CONTRACTS.usdcE} variant="inline" />
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSafeFunded(true)}
                        disabled={!safeComplete || safeFunded}
                      >
                        {safeFunded ? 'Funded' : 'Mark funded'}
                      </Button>
                    </div>
                  </ActiveCheckListItem>
                </ActiveCheckList>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                    disabled={isConnecting || isSwitching || isSaving || isDeploying || isApproving}
                  >
                    Back
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => setStatus('idle')}>
                    Resume
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
