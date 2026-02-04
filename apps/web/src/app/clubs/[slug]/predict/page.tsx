'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { ClubPredictionForm } from '@/components/club-prediction-form';
import { useApi, useClub } from '@/hooks';

export default function ClubPredictPage({ params }: { params: { slug: string } }) {
  const { address } = useApi();
  const { club, isLoading, error } = useClub(params.slug);
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
            <p className="text-muted-foreground">
              Search for a market, pick a winner, and set your bet.
            </p>
          </div>
          <Link href={`/clubs/${club.slug}#predictions`}>
            <Button variant="outline">Back to club</Button>
          </Link>
        </div>

        <Card>
          <CardContent>
            {club && <ClubPredictionForm club={club} clubSlug={params.slug} address={address} />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
