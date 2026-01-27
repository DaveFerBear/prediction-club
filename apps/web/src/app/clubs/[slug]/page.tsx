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
  Avatar,
  AvatarFallback,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';
import { useApi } from '@/hooks';

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  safeAddress: string;
  vaultAddress: string;
  manager: {
    id: string;
    walletAddress: string;
    email: string | null;
  } | null;
  members: Array<{
    role: string;
    user: {
      id: string;
      walletAddress: string;
      email: string | null;
    };
  }>;
  cohorts: Array<{
    id: string;
    cohortId: string;
    marketTitle: string | null;
    status: string;
    stakeTotal: string;
  }>;
  _count: {
    members: number;
    cohorts: number;
  };
}

interface Cohort {
  id: string;
  cohortId: string;
  marketTitle: string | null;
  marketRef: string | null;
  status: string;
  stakeTotal: string;
  _count: {
    members: number;
  };
}

interface ClubResponse {
  success: boolean;
  data: Club;
}

interface CohortsResponse {
  success: boolean;
  data: {
    items: Cohort[];
    total: number;
  };
}

function formatAmount(amount: string) {
  const num = Number(amount) / 1e6; // Assuming USDC with 6 decimals
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function ClubPublicPage({ params }: { params: { slug: string } }) {
  const { address } = useApi();
  const [club, setClub] = useState<Club | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [clubRes, cohortsRes] = await Promise.all([
          fetch(`/api/clubs/${params.slug}`),
          fetch(`/api/clubs/${params.slug}/cohorts`),
        ]);

        const clubData: ClubResponse = await clubRes.json();
        const cohortsData: CohortsResponse = await cohortsRes.json();

        if (clubData.success) {
          setClub(clubData.data);
        } else {
          setError('Club not found');
        }

        if (cohortsData.success) {
          setCohorts(cohortsData.data.items);
        }
      } catch (err) {
        console.error('Failed to fetch club:', err);
        setError('Failed to load club');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.slug]);

  if (loading) {
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
              <p className="text-muted-foreground">{error || 'Club not found'}</p>
              <Link href="/clubs" className="mt-4 inline-block">
                <Button variant="outline">Browse Clubs</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const activeCohorts = cohorts.filter((c) => c.status === 'COMMITTED' || c.status === 'PENDING');
  const isManager =
    !!address && club.manager?.walletAddress?.toLowerCase() === address.toLowerCase();
  const isMember =
    !!address &&
    club.members.some(
      (member) => member.user.walletAddress.toLowerCase() === address.toLowerCase()
    );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Club Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{club.name}</h1>
                {club.isPublic && <Badge variant="secondary">Public</Badge>}
              </div>
              <p className="mt-2 text-muted-foreground">{club.description || 'No description'}</p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                {club.manager && (
                  <span className="text-muted-foreground">
                    Manager:{' '}
                    <span className="text-foreground">
                      <CopyableAddress address={club.manager.walletAddress} variant="inline" />
                    </span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  Safe: <CopyableAddress address={club.safeAddress} variant="inline" />
                </span>
              </div>
            </div>
            {isManager ? (
              <Badge variant="outline">You are a manager</Badge>
            ) : isMember ? (
              <Badge variant="secondary">You are a member</Badge>
            ) : (
              <Button>Apply to Join</Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-2xl">{club._count.members}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Cohorts</CardDescription>
              <CardTitle className="text-2xl">{activeCohorts.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cohorts</CardDescription>
              <CardTitle className="text-2xl">{club._count.cohorts}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vault Address</CardDescription>
              <CardTitle>
                <CopyableAddress address={club.vaultAddress} variant="compact" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cohorts */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold">Cohorts</h2>
            {cohorts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No cohorts yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cohorts.map((cohort) => (
                  <Card key={cohort.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{cohort.marketTitle || 'Untitled Market'}</CardTitle>
                        <Badge
                          variant={cohort.status === 'COMMITTED' || cohort.status === 'PENDING' ? 'default' : 'secondary'}
                        >
                          {cohort.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Stake</span>
                        <span>${formatAmount(cohort.stakeTotal)} USDC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participants</span>
                        <span>{cohort._count.members}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Members</h2>
            <Card>
              <CardContent className="py-4">
                {club.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet</p>
                ) : (
                  <div className="space-y-4">
                    {club.members.map((member) => (
                      <div key={member.user.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.user.walletAddress.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CopyableAddress address={member.user.walletAddress} variant="compact" />
                          {member.user.email && (
                            <p className="text-xs text-muted-foreground">{member.user.email}</p>
                          )}
                        </div>
                        {member.role === 'ADMIN' && (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
