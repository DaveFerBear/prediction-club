'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { useApi, useClub, type MarketItem } from '@/hooks';
import { generatePredictionRoundId } from '@prediction-club/chain';
import { parseUnits } from 'viem';
import { MarketSearch } from '@/components/market-search';

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

  const [selectedMarket, setSelectedMarket] = useState<MarketItem | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const outcomes = Array.isArray(selectedMarket?.outcomes) ? selectedMarket?.outcomes ?? [] : [];

  const handleCreatePrediction = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isAdmin) {
      setErrorMessage('Only club admins can create predictions.');
      return;
    }

    if (!selectedMarket) {
      setErrorMessage('Select a market.');
      return;
    }

    if (!selectedOutcome) {
      setErrorMessage('Pick a winning outcome.');
      return;
    }

    if (!betAmount.trim()) {
      setErrorMessage('Enter a bet amount.');
      return;
    }

    let commitAmount: string;
    try {
      commitAmount = parseUnits(betAmount.trim(), 6).toString();
    } catch {
      setErrorMessage('Bet amount must be a valid number.');
      return;
    }

    if (BigInt(commitAmount) <= 0n) {
      setErrorMessage('Bet amount must be greater than 0.');
      return;
    }

    const entries = members.map((member) => ({
      userId: member.user.id,
      commitAmount,
    }));

    if (entries.length === 0) {
      setErrorMessage('No active members found.');
      return;
    }

    setCreating(true);
    try {
      const cohortId = generatePredictionRoundId(
        `${selectedMarket.id ?? selectedMarket.slug ?? 'market'}:${selectedOutcome}:${Date.now()}`
      );
      const marketTitle = selectedMarket.question || selectedMarket.title || selectedMarket.slug || 'Market';
      const response = await apiFetch<{ success: boolean }>(
        `/api/clubs/${params.slug}/predictions`,
        {
          method: 'POST',
          body: JSON.stringify({
            cohortId,
            marketRef: String(selectedMarket.id ?? selectedMarket.slug ?? selectedMarket.eventId ?? ''),
            marketTitle: `${marketTitle} — ${selectedOutcome}`,
            members: entries,
          }),
        }
      );

      if (response.success) {
        setSuccessMessage('Prediction created.');
        setSelectedMarket(null);
        setSelectedOutcome(null);
        setBetAmount('');
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
            <CardDescription>Search for a market, pick a winner, and set your bet.</CardDescription>
          </CardHeader>
          <CardContent>
            {!isAdmin && (
              <div className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Only club admins can create predictions.
              </div>
            )}
            <MarketSearch
              selectedMarket={selectedMarket}
              onSelect={(market) => {
                setSelectedMarket(market);
                setSelectedOutcome(null);
              }}
            />

            <form onSubmit={handleCreatePrediction} className="mt-6 space-y-4">
              {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
              {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected market</label>
                <div className="rounded-md border border-dashed p-3 text-sm">
                  {selectedMarket
                    ? selectedMarket.question || selectedMarket.title || selectedMarket.slug
                    : 'No market selected.'}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pick winner</label>
                {outcomes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Select a market with outcomes to continue.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {outcomes.map((outcome) => (
                      <Button
                        key={outcome}
                        type="button"
                        variant={selectedOutcome === outcome ? 'default' : 'outline'}
                        onClick={() => setSelectedOutcome(outcome)}
                      >
                        {outcome}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bet amount (USDC)</label>
                <Input
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="e.g. 250"
                />
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
