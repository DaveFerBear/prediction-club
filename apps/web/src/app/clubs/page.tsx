'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@prediction-club/ui';
import { Header } from '@/components/header';

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  _count: {
    members: number;
    predictionRounds: number;
  };
}

interface ClubsResponse {
  success: boolean;
  data: {
    items: Club[];
    total: number;
  };
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch('/api/clubs');
        const data: ClubsResponse = await res.json();
        if (data.success) {
          setClubs(data.data.items);
        }
      } catch (error) {
        console.error('Failed to fetch clubs:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchClubs();
  }, []);

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

        {loading ? (
          <div className="text-muted-foreground">Loading clubs...</div>
        ) : clubs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No public clubs yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Be the first to create a public club!
              </p>
              <Link href="/clubs/create" className="mt-4 inline-block">
                <Button>Create Club</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <Card key={club.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{club.name}</CardTitle>
                    <Badge variant="secondary">{club._count.members} members</Badge>
                  </div>
                  <CardDescription>/{club.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  {club.description && (
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                      {club.description}
                    </p>
                  )}
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Predictions</span>
                    <span>{club._count.predictionRounds}</span>
                  </div>
                  <Link href={`/clubs/${club.slug}`}>
                    <Button className="w-full">View Club</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
