'use client';

import Link from 'next/link';
import { useClubs } from '@/hooks';
import { Button, Card, CardContent } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { ClubCard } from '@/components/club-card';

export default function ClubsPage() {
  const { clubs, isLoading } = useClubs({ publicOnly: true });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Find a club</h1>
            <p className="text-muted-foreground">Browse and join prediction clubs</p>
          </div>
          <Link href="/clubs/create">
            <Button>Create a Club</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading clubs...</div>
        ) : clubs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No public clubs yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first to create a public club!
              </p>
              <Link href="/clubs/create" className="mt-4 inline-block">
                <Button>Create a Club</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} statsLabel="members" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
