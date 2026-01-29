'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { useApi, useClub } from '@/hooks';
import { isValidBytes32 } from '@prediction-club/shared';

export default function ClubPredictPage({ params }: { params: { slug: string } }) {
  const { fetch: apiFetch, address } = useApi();
  const { mutate } = useSWRConfig();
  const { club, isLoading, error } = useClub(params.slug);

  const members = club?.members ?? [];
  const isManager =
    !!address && club?.manager?.walletAddress?.toLowerCase() === address.toLowerCase();
  const isAdmin = useMemo(() => {
    if (!address) return false;
    const member = members.find(
      (item) => item.user.walletAddress.toLowerCase() === address.toLowerCase()
    );
    return member?.role === 'ADMIN' || isManager;
  }, [address, members, isManager]);

  const [cohortId, setCohortId] = useState('');
  const [marketRef, setMarketRef] = useState('');
  const [marketTitle, setMarketTitle] = useState('');
  const [commitAmounts, setCommitAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!club) return;
    setCommitAmounts((prev) => {
      const next: Record<string, string> = { ...prev };
      club.members.forEach((member) => {
        if (next[member.user.id] === undefined) {
          next[member.user.id] = '';
        }
      });
      return next;
    });
  }, [club]);

  const handleCreatePrediction = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isAdmin) {
      setErrorMessage('Only club admins can create predictions.');
      return;
    }

    if (!isValidBytes32(cohortId.trim())) {
      setErrorMessage('Cohort ID must be a bytes32 hex string.');
      return;
    }

    const entries = members
      .map((member) => ({
        userId: member.user.id,
        commitAmount: commitAmounts[member.user.id]?.trim() || '0',
      }))
      .filter((member) => {
        try {
          return BigInt(member.commitAmount) > 0n;
        } catch {
          return false;
        }
      });

    if (entries.length === 0) {
      setErrorMessage('Set a commit amount for at least one member.');
      return;
    }

    setCreating(true);
    try {
      const response = await apiFetch<{ success: boolean }>(
        `/api/clubs/${params.slug}/predictions`,
        {
          method: 'POST',
          body: JSON.stringify({
            cohortId: cohortId.trim(),
            marketRef: marketRef.trim() || undefined,
            marketTitle: marketTitle.trim() || undefined,
            members: entries,
          }),
        }
      );

      if (response.success) {
        setSuccessMessage('Prediction created.');
        setCohortId('');
        setMarketRef('');
        setMarketTitle('');
        setCommitAmounts({});
        await mutate(`/api/clubs/${params.slug}/predictions`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create prediction.');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-muted-foreground">Loading club...</div>
        </main>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">{error?.message || 'Club not found'}</p>
              <Link href="/clubs" className="mt-4 inline-block">
                <Button variant="outline">Find a club</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Make a Prediction</h1>
            <p className="text-muted-foreground">Create a new prediction for {club.name}.</p>
          </div>
          <Link href={`/clubs/${club.slug}`}>
            <Button variant="outline">Back to club</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Prediction</CardTitle>
            <CardDescription>Commit funds for a new prediction round.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isAdmin && (
              <div className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Only club admins can create predictions.
              </div>
            )}
            <form onSubmit={handleCreatePrediction} className="space-y-4">
              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
              {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cohort ID (bytes32)</label>
                <Input
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                  placeholder="0x..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Market Reference</label>
                <Input
                  value={marketRef}
                  onChange={(e) => setMarketRef(e.target.value)}
                  placeholder="Polymarket URL or ID"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Market Title</label>
                <Input
                  value={marketTitle}
                  onChange={(e) => setMarketTitle(e.target.value)}
                  placeholder="e.g., US Election 2024"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Commit amounts (USDC, 6 decimals)</div>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.user.id} className="flex items-center gap-3">
                      <div className="w-40 text-xs text-muted-foreground">
                        {member.user.email || member.user.walletAddress.slice(0, 10) + '…'}
                      </div>
                      <Input
                        value={commitAmounts[member.user.id] || ''}
                        onChange={(e) =>
                          setCommitAmounts((prev) => ({
                            ...prev,
                            [member.user.id]: e.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={creating || !isAdmin}>
                {creating ? 'Creating...' : 'Create Prediction'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
