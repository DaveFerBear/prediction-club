'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { useApi, useDeployClub } from '@/hooks';
import { type SupportedChainId } from '@prediction-club/chain';

export default function CreateClubPage() {
  const router = useRouter();
  const { fetch: apiFetch, isAuthenticated } = useApi();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    chainId: 80002 as SupportedChainId, // Default to Amoy testnet
    isPublic: true,
  });

  const { deploy, status, isDeploying, result: deployResult, needsChainSwitch } = useDeployClub({
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <Link href="/clubs" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to Clubs
          </Link>
          <h1 className="mt-4 text-3xl font-bold">Create a Club</h1>
          <p className="text-muted-foreground">Set up a new prediction club with an on-chain vault</p>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Club Details</CardTitle>
            <CardDescription>
              We'll deploy a Gnosis Safe and ClubVault contract for your club.
              You'll need to sign two transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {getStatusMessage() && (
                <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-600">
                  {getStatusMessage()}
                </div>
              )}

              {deployResult && (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 space-y-1">
                  <p>Contracts deployed successfully!</p>
                  <p className="font-mono text-xs">Safe: {deployResult.safeAddress}</p>
                  <p className="font-mono text-xs">Vault: {deployResult.vaultAddress}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Club Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Alpha Traders"
                  required
                  disabled={isDeploying}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Slug (optional)</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., alpha-traders (auto-generated if empty)"
                  disabled={isDeploying}
                />
                <p className="text-xs text-muted-foreground">
                  This will be your club's URL: /clubs/{formData.slug || 'your-slug'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What's your club about?"
                  disabled={isDeploying}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Network</label>
                <select
                  value={formData.chainId}
                  onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) as SupportedChainId })}
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

              <Button type="submit" className="w-full" disabled={isDeploying || !isAuthenticated}>
                {isDeploying
                  ? 'Deploying...'
                  : !isAuthenticated
                    ? 'Connect Wallet to Create'
                    : 'Create Club'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This will deploy a Safe and ClubVault contract. Gas fees apply.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
