'use client';

import Link from 'next/link';
import { useApi, useClub, usePredictionRounds } from '@/hooks';
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

function formatAmount(amount: string) {
  const num = Number(amount) / 1e6; // Assuming USDC with 6 decimals
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function ClubPublicPage({ params }: { params: { slug: string } }) {
  const { address } = useApi();
  const {
    club,
    isLoading: clubLoading,
    error: clubError,
  } = useClub(params.slug);
  const {
    predictionRounds,
    isLoading: roundsLoading,
    error: roundsError,
  } = usePredictionRounds(params.slug);
  const loading = clubLoading || roundsLoading;
  const error = clubError || roundsError;

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

  const activePredictionRounds = predictionRounds.filter(
    (round) => round.status === 'COMMITTED' || round.status === 'PENDING'
  );
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{club.name}</h1>
                <Badge variant="secondary">{club.isPublic ? 'Public' : 'Private'}</Badge>
                {isManager && <Badge variant="outline">You are a manager</Badge>}
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
              </div>
            </div>
            {isManager ? (
              <Link href={`/clubs/${club.slug}/admin`}>
                <Button size="sm">Manage</Button>
              </Link>
            ) : isMember ? (
              <Badge variant="secondary">You are a member</Badge>
            ) : (
              <Button>Apply to Join</Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-2xl">{club._count.members}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Predictions</CardDescription>
              <CardTitle className="text-2xl">{activePredictionRounds.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Predictions</CardDescription>
              <CardTitle className="text-2xl">{club._count.predictionRounds}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Predictions */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold">Predictions</h2>
            {predictionRounds.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No predictions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {predictionRounds.map((predictionRound) => (
                  <Card key={predictionRound.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {predictionRound.marketTitle || 'Untitled Market'}
                        </CardTitle>
                        <Badge
                          variant={
                            predictionRound.status === 'COMMITTED' ||
                            predictionRound.status === 'PENDING'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {predictionRound.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Stake</span>
                        <span>${formatAmount(predictionRound.stakeTotal)} USDC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participants</span>
                        <span>{predictionRound._count.members}</span>
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
