'use client';

import Link from 'next/link';
import { useClubs } from '@/hooks';
import { Button, Card, CardContent } from '@prediction-club/ui';
import { Header } from '@/components/header';
import { ClubCard } from '@/components/club-card';

export default function DashboardPage() {
  const { clubs, isLoading } = useClubs({ publicOnly: false });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">My clubs</h1>
              <p className="text-muted-foreground">Overview of your prediction club activity</p>
            </div>
            <Link href="/clubs/create">
              <Button className="w-full sm:w-auto">Create a Club</Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground">Loading clubs...</div>
          ) : clubs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No clubs found.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a new club or explore public clubs to get started.
                </p>
                <div className="mt-4 flex justify-center gap-4">
                  <Link href="/clubs/create">
                    <Button>Create a Club</Button>
                  </Link>
                  <Link href="/clubs">
                    <Button variant="outline">Find a Club</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clubs.map((club) => (
                <ClubCard key={club.id} club={club} statsLabel="predictions" />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
