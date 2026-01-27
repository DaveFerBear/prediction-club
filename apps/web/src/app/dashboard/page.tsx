'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from '@prediction-club/ui';
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

export default function DashboardPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClubs() {
      try {
        const res = await fetch('/api/clubs?public=false');
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
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">My clubs</h1>
              <p className="text-muted-foreground">Overview of your prediction club activity</p>
            </div>
            <Link href="/clubs/create">
              <Button className="w-full sm:w-auto">Create Club</Button>
            </Link>
          </div>

          {loading ? (
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
                    <Button>Create Club</Button>
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
                <Card key={club.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{club.name}</CardTitle>
                      <Badge variant="secondary">{club._count.predictionRounds} predictions</Badge>
                    </div>
                    <CardDescription>/{club.slug}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {club.description && (
                      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                        {club.description}
                      </p>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span>{club._count.members}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/clubs/${club.slug}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          View
                        </Button>
                      </Link>
                      <Link href={`/clubs/${club.slug}/admin`} className="flex-1">
                        <Button className="w-full">Manage</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
