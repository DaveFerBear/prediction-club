'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Progress,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';
import { useApi, useDeployClub } from '@/hooks';
import { type SupportedChainId } from '@prediction-club/chain';

export default function CreateClubPage() {
  const router = useRouter();
  const { fetch: apiFetch, isAuthenticated } = useApi();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    chainId: 80002 as SupportedChainId, // Default to Amoy testnet
    isPublic: true,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    deploy,
    status,
    isDeploying,
    result: deployResult,
    needsChainSwitch,
  } = useDeployClub({
    chainId: formData.chainId,
    onError: (err) => setError(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError('Please connect your wallet first');
      return;
    }

    setError(null);

    // Step 1: Deploy contracts
    const result = await deploy();
    if (!result) return;

    // Step 2: Create club in database
    try {
      const response = await apiFetch<{ success: boolean; data: { slug: string } }>('/api/clubs', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug || undefined,
          description: formData.description || undefined,
          safeAddress: result.safeAddress,
          vaultAddress: result.vaultAddress,
          chainId: formData.chainId,
          isPublic: formData.isPublic,
        }),
      });

      if (response.success) {
        router.push(`/clubs/${response.data.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club');
    }
  };

  const getStatusMessage = () => {
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

  const safeComplete = status === 'deploying-vault' || status === 'success' || !!deployResult;
  const vaultComplete = status === 'success' || !!deployResult;
  const progressValue = step === 1 ? 0 : deployResult ? 100 : 50;
  const slugPreview = useMemo(() => formData.slug || 'your-slug', [formData.slug]);

  const handleNameChange = (value: string) => {
    if (slugTouched) {
      setFormData({ ...formData, name: value });
      return;
    }
    const nextSlug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormData({ ...formData, name: value, slug: nextSlug });
  };

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
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

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
                    <p className="text-xs text-muted-foreground">Your club URL: /clubs/{slugPreview}</p>
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
                    <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
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
                  {getStatusMessage() && (
                    <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600">
                      {getStatusMessage()}
                    </div>
                  )}

                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Deploy Safe</span>
                      <span className={safeComplete ? 'text-green-600' : 'text-muted-foreground'}>
                        {safeComplete
                          ? '✓'
                          : status === 'deploying-safe'
                            ? 'In progress'
                            : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span>Deploy ClubVault</span>
                      <span className={vaultComplete ? 'text-green-600' : 'text-muted-foreground'}>
                        {vaultComplete
                          ? '✓'
                          : status === 'deploying-vault'
                            ? 'In progress'
                            : 'Pending'}
                      </span>
                    </div>
                  </div>

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
                      <option value={80002}>Polygon Amoy (Testnet)</option>
                      <option value={137}>Polygon Mainnet</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                      disabled={isDeploying}
                    />
                    <label htmlFor="isPublic" className="text-sm">
                      Make this club public (visible to everyone)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(1)}
                      disabled={isDeploying}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isDeploying || !isAuthenticated}
                    >
                      {isDeploying
                        ? 'Deploying...'
                        : !isAuthenticated
                          ? 'Connect Wallet to Create'
                          : 'Create Club'}
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
