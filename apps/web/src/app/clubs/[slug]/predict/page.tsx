'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { ClubPredictionForm } from '@/components/club-prediction-form';
import { useApi, useClub } from '@/hooks';
import { getMarketTitle } from '@/components/markets/market-utils';

export default function ClubPredictPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const { address } = useApi();
  const { club, isLoading, error } = useClub(params.slug);
  const prefill = useMemo(
    () => ({
      marketSlug: searchParams.get('marketSlug')?.trim() || undefined,
      marketId: searchParams.get('marketId')?.trim() || undefined,
      conditionId: searchParams.get('conditionId')?.trim() || undefined,
      outcome: searchParams.get('outcome')?.trim() || undefined,
      title: searchParams.get('marketTitle')?.trim() || undefined,
    }),
    [searchParams]
  );

  const hasPrefill = Boolean(prefill.marketSlug || prefill.marketId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container space-y-6 py-8">
          <Card className="border-border/70">
            <CardHeader>
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
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

      <main className="container space-y-6 py-8">
        <section className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/35 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create prediction</h1>
              <p className="mt-1 text-muted-foreground">
                Select a market, choose the expected winner, and set stake size.
              </p>
            </div>
            <Link href={`/clubs/${club.slug}`}>
              <Button variant="outline">Back to club</Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">1. Select event</Badge>
            <Badge variant="outline">2. Pick market</Badge>
            <Badge variant="outline">3. Choose outcome</Badge>
            <Badge variant="outline">4. Set stake</Badge>
          </div>
          {hasPrefill ? (
            <div className="mt-4 rounded-md border bg-background/80 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Starting from market:</span>{' '}
              <span className="font-medium">
                {prefill.title || (prefill.marketSlug ? getMarketTitle({ slug: prefill.marketSlug }) : 'Selected market')}
              </span>
            </div>
          ) : null}
        </section>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-xl">Prediction builder</CardTitle>
            <CardDescription>Workflow is shared with the Markets page for consistency.</CardDescription>
          </CardHeader>
          <CardContent>
            {club && (
              <ClubPredictionForm
                club={club}
                clubSlug={params.slug}
                address={address}
                prefillMarket={prefill}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
