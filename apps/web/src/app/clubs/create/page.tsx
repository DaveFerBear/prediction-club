'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';
import { ActiveCheckList, ActiveCheckListItem } from '@/components/active-check-list';
import { useApi, useDeployClub, useCreateClub, type DeployStatus } from '@/hooks';
import { type SupportedChainId } from '@prediction-club/chain';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

const slugifyName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const getDeployStatusMessage = (status: DeployStatus) => {
  switch (status) {
    case 'switching-chain':
      return 'Switching network... Please approve in your wallet.';
    case 'deploying-safe':
      return 'Deploying Safe... Please confirm the transaction in your wallet.';
    case 'deploying-vault':
      return 'Deploying ClubVault... Please confirm the transaction in your wallet.';
    default:
      return null;
  }
};

export default function CreateClubPage() {
  const router = useRouter();
  const { fetch: apiFetch, isAuthenticated } = useApi();
  const { connect, isPending: isConnecting } = useConnect();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const { createClub, isCreating, error: createClubError } = useCreateClub();

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    chainId: 137 as SupportedChainId, // Default to Polygon mainnet
    isPublic: true,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    deploy,
    retrySafe,
    retryVault,
    reset: resetDeploy,
    status,
    isDeploying,
    result: deployResult,
    errorStage,
    safeResult,
  } = useDeployClub({
    chainId: formData.chainId,
    onError: (err) => setError(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      connect({ connector: injected() });
      return;
    }

    setError(null);

    // Step 1: Deploy contracts
    const result = await deploy();
    if (!result) return;

    // Step 2: Create club in database
    try {
      const response = await createClub({
        name: formData.name,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        safeAddress: result.safeAddress,
        vaultAddress: result.vaultAddress,
        chainId: formData.chainId,
        isPublic: formData.isPublic,
      });

      if (response.success) {
        router.push(`/clubs/${response.data?.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club');
    }
  };

  const statusMessage = getDeployStatusMessage(status);

  const safeComplete = status === 'deploying-vault' || status === 'success' || !!deployResult;
  const safeReady = safeComplete || !!safeResult;
  const vaultComplete = status === 'success' || !!deployResult;
  const progressValue = step === 1 ? 0 : deployResult ? 100 : 50;
  const connectComplete = isAuthenticated;
  const slugPreview = useMemo(() => formData.slug || 'your-slug', [formData.slug]);
  const safeActive = step === 2 && connectComplete && !safeComplete;
  const vaultActive = step === 2 && connectComplete && safeReady && !vaultComplete;
  const connectError = errorStage === 'connect' ? error : null;
  const safeError =
    errorStage === 'deploying-safe' || errorStage === 'switching-chain' ? error : null;
  const vaultError = errorStage === 'deploying-vault' ? error : null;
  const createError = createClubError ? createClubError.message : null;

  const handleNameChange = (value: string) => {
    if (slugTouched) {
      setFormData({ ...formData, name: value });
      return;
    }
    const nextSlug = slugifyName(value);
    setFormData({ ...formData, name: value, slug: nextSlug });
  };

  const handleRetryDeploy = () => {
    setError(null);
    resetDeploy();
    deploy();
  };

  useEffect(() => {
    if (step !== 2) return;
    if (!connectComplete) return;
    if (deployResult || isDeploying) return;
    if (status !== 'idle') return;
    deploy();
  }, [step, connectComplete, deployResult, isDeploying, status, deploy]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create a Club</h1>
          <p className="text-muted-foreground">
            Set up a new prediction club with an on-chain vault
          </p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <Progress value={progressValue} className="mb-4" />
            <CardTitle>{step === 1 ? 'Club Details' : 'Deploy Contracts'}</CardTitle>
            <CardDescription>
              {step === 1
                ? 'Tell us about your club to get started.'
                : 'We will deploy a Gnosis Safe and ClubVault for your club. You will sign two transactions.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Club Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g., Alpha Traders"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setFormData({ ...formData, slug: e.target.value });
                      }}
                      placeholder="alpha-traders"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your club URL: /clubs/{slugPreview}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="What's your club about?"
                    />
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
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!formData.name.trim()}
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {statusMessage && (
                    <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600">
                      {statusMessage}
                    </div>
                  )}

                  <ActiveCheckList>
                    <ActiveCheckListItem
                      active
                      status={connectComplete ? 'complete' : isConnecting ? 'in-progress' : 'idle'}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                          1
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium">Connect wallet</span>
                          {connectError && (
                            <span className="text-xs text-destructive break-all whitespace-break-spaces">
                              {connectError}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!connectComplete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => connect({ connector: injected() })}
                            disabled={isConnecting}
                          >
                            {isConnecting ? 'Connecting...' : 'Connect'}
                          </Button>
                        )}
                      </div>
                    </ActiveCheckListItem>
                    <ActiveCheckListItem
                      active={safeComplete || safeActive}
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
                          2
                        </span>
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">Deploy Safe</span>
                            {safeError && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={retrySafe}
                                disabled={isDeploying}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                          {safeError && (
                            <span className="max-h-32 overflow-auto text-xs text-destructive break-all whitespace-break-spaces">
                              {safeError}
                            </span>
                          )}
                        </div>
                      </div>
                    </ActiveCheckListItem>
                    <ActiveCheckListItem
                      active={vaultComplete || vaultActive}
                      status={
                        vaultComplete
                          ? 'complete'
                          : status === 'deploying-vault'
                            ? 'in-progress'
                            : 'idle'
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                          3
                        </span>
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">Deploy ClubVault</span>
                            {vaultError && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={retryVault}
                                disabled={isDeploying}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                          {vaultError && (
                            <span className="max-h-32 overflow-auto text-xs text-destructive break-all whitespace-break-spaces">
                              {vaultError}
                            </span>
                          )}
                          {createError && (
                            <span className="max-h-32 overflow-auto text-xs text-destructive break-all whitespace-break-spaces">
                              {createError}
                            </span>
                          )}
                        </div>
                      </div>
                    </ActiveCheckListItem>
                  </ActiveCheckList>

                  {deployResult && (
                    <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 space-y-1">
                      <p>Contracts deployed successfully!</p>
                      <div className="text-xs">
                        <span>Safe: </span>
                        <CopyableAddress address={deployResult.safeAddress} variant="compact" />
                      </div>
                      <div className="text-xs">
                        <span>Vault: </span>
                        <CopyableAddress address={deployResult.vaultAddress} variant="compact" />
                      </div>
                    </div>
                  )}

                  <Accordion
                    type="single"
                    collapsible
                    className="rounded-md border border-border bg-muted/30"
                  >
                    <AccordionItem value="advanced" className="border-none">
                      <AccordionTrigger className="px-3">Advanced</AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Network</label>
                            <select
                              value={formData.chainId}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  chainId: parseInt(e.target.value) as SupportedChainId,
                                })
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              disabled={isDeploying}
                            >
                              <option value={137}>Polygon Mainnet</option>
                              <option value={80002}>Polygon Amoy (Testnet)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isPublic"
                              checked={formData.isPublic}
                              onChange={(e) =>
                                setFormData({ ...formData, isPublic: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-gray-300"
                              disabled={isDeploying}
                            />
                            <label htmlFor="isPublic" className="text-sm">
                              Make this club public (visible to everyone)
                            </label>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                      disabled={isDeploying || isCreating}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isDeploying || isCreating || !vaultComplete}
                    >
                      {isCreating ? 'Creating...' : isDeploying ? 'Deploying...' : 'Create Club'}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    This will deploy a Safe and ClubVault contract. Gas fees apply.
                  </p>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
