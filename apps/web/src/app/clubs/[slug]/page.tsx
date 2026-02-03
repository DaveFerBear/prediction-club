'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import {
  useApi,
  useApproveApplication,
  useApplyToClub,
  useClubBalance,
  useClub,
  useClubApplications,
  usePredictionRounds,
} from '@/hooks';
import { ChartExposure } from '@/components/chart-exposure';
import { buildExposureSeries } from '@/lib/exposure';
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
  Input,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';

export default function ClubPublicPage({ params }: { params: { slug: string } }) {
  const { fetch: apiFetch, address } = useApi();
  const { mutate } = useSWRConfig();
  const { club, isLoading: clubLoading, error: clubError } = useClub(params.slug);
  const {
    predictionRounds,
    isLoading: roundsLoading,
    error: roundsError,
  } = usePredictionRounds(params.slug);
  const { history: clubHistory, isLoading: balanceLoading } = useClubBalance(params.slug);
  const loading = clubLoading || roundsLoading;
  const error = clubError || roundsError;

  const members = club?.members ?? [];
  const activePredictionRounds = predictionRounds.filter(
    (round) => round.status === 'COMMITTED' || round.status === 'PENDING'
  );
  const exposureSeries = useMemo(() => buildExposureSeries(clubHistory), [clubHistory]);
  const isManager =
    !!address && club?.manager?.walletAddress?.toLowerCase() === address.toLowerCase();
  const isAdmin = useMemo(() => {
    if (!address) return false;
    const member = members.find(
      (item) => item.user.walletAddress.toLowerCase() === address.toLowerCase()
    );
    return member?.role === 'ADMIN' || isManager;
  }, [address, members, isManager]);
  const isMember =
    !!address &&
    members.some((member) => member.user.walletAddress.toLowerCase() === address.toLowerCase());

  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubPublic, setClubPublic] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubSaveError, setClubSaveError] = useState<string | null>(null);
  const [clubSaveSuccess, setClubSaveSuccess] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const {
    applications,
    isLoading: appsLoading,
    error: appsError,
  } = useClubApplications(isAdmin ? params.slug : undefined, 'PENDING');
  const { approve, approvingId } = useApproveApplication(params.slug);
  const { apply, isApplying, isAuthenticated: isUserAuthenticated } = useApplyToClub(params.slug);

  useEffect(() => {
    if (!club) return;
    setClubName(club.name);
    setClubDescription(club.description ?? '');
    setClubPublic(club.isPublic);
  }, [club]);

  const handleSaveClub = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingClub(true);
    setClubSaveError(null);
    setClubSaveSuccess(null);
    try {
      const response = await apiFetch<{ success: boolean }>(`/api/clubs/${params.slug}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: clubName.trim(),
          description: clubDescription.trim() || null,
          isPublic: clubPublic,
        }),
      });
      if (response.success) {
        setClubSaveSuccess('Club updated');
        await mutate(`/api/clubs/${params.slug}`);
      }
    } catch (err) {
      setClubSaveError(err instanceof Error ? err.message : 'Failed to update club');
    } finally {
      setSavingClub(false);
    }
  };

  const handleApply = async () => {
    setApplyError(null);
    setApplySuccess(null);
    if (!isUserAuthenticated) {
      setApplyError('Connect your wallet to apply.');
      return;
    }

    try {
      await apply(applyMessage.trim() || undefined);
      setApplySuccess('Application submitted.');
      setApplyMessage('');
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to submit application.');
    }
  };

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
            {isAdmin ? (
              <Link href={`/clubs/${club.slug}/predict`}>
                <Button size="sm">Make prediction</Button>
              </Link>
            ) : isMember ? (
              <Badge variant="secondary">You are a member</Badge>
            ) : (
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <Input
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Message (optional)"
                  className="sm:w-64"
                />
                <Button type="button" onClick={handleApply} disabled={isApplying} variant="default">
                  {isApplying ? 'Submitting...' : 'Apply to Join'}
                </Button>
                {!isUserAuthenticated && (
                  <p className="text-xs text-muted-foreground">Connect your wallet to apply.</p>
                )}
                {applySuccess && <p className="text-xs text-emerald-600">{applySuccess}</p>}
                {applyError && <p className="text-xs text-destructive">{applyError}</p>}
              </div>
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
              <CardDescription>Active Volume</CardDescription>
              <CardTitle className="text-2xl">
                ${formatUsdAmount(club.activeCommittedVolume)} USDC
              </CardTitle>
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
          {/* Performance + Predictions */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="mb-4 text-xl font-semibold">Club Performance</h2>
              {balanceLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Loading exposure...</p>
                  </CardContent>
                </Card>
              ) : exposureSeries.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No activity yet to chart.</p>
                  </CardContent>
                </Card>
              ) : (
                <ChartExposure
                  title="Wallet vs In-Market"
                  description="All-time"
                  data={exposureSeries}
                  footerText="Wallet + open market positions"
                  footerSubtext="Based on ledger entries for this club"
                />
              )}
            </div>

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
                        <span>${formatUsdAmount(predictionRound.stakeTotal)} USDC</span>
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

        {isAdmin && (
          <div className="mt-10 space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Applications</CardTitle>
                  <CardDescription>Approve new members.</CardDescription>
                </CardHeader>
                <CardContent>
                  {appsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading applications...</p>
                  ) : appsError ? (
                    <p className="text-sm text-destructive">{appsError.message}</p>
                  ) : applications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending applications.</p>
                  ) : (
                    <div className="space-y-4">
                      {applications.map((app) => (
                        <div key={app.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">
                                {app.user.email || (
                                  <CopyableAddress
                                    address={app.user.walletAddress}
                                    variant="inline"
                                  />
                                )}
                              </p>
                              {app.user.email && (
                                <CopyableAddress
                                  address={app.user.walletAddress}
                                  variant="compact"
                                  className="text-muted-foreground"
                                />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {app.message && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              &ldquo;{app.message}&rdquo;
                            </p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approve(app.id)}
                              disabled={approvingId === app.id}
                            >
                              {approvingId === app.id ? 'Approving...' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Edit Club Details</CardTitle>
                  <CardDescription>Update name, description, and visibility.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveClub} className="space-y-4">
                    {clubSaveError && <p className="text-sm text-destructive">{clubSaveError}</p>}
                    {clubSaveSuccess && <p className="text-sm text-green-600">{clubSaveSuccess}</p>}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Club name</label>
                      <Input value={clubName} onChange={(e) => setClubName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Input
                        value={clubDescription}
                        onChange={(e) => setClubDescription(e.target.value)}
                        placeholder="Describe your club"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={clubPublic}
                        onChange={(e) => setClubPublic(e.target.checked)}
                      />
                      Make club public
                    </label>
                    <Button type="submit" disabled={savingClub}>
                      {savingClub ? 'Saving...' : 'Save changes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
