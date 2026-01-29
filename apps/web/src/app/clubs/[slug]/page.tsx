'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
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
  Input,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';
import { isValidBytes32 } from '@prediction-club/shared';

function formatAmount(amount: string) {
  const num = Number(amount) / 1e6; // Assuming USDC with 6 decimals
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

type Application = {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    walletAddress: string;
    email: string | null;
  };
};

export default function ClubPublicPage({ params }: { params: { slug: string } }) {
  const { fetch: apiFetch, address } = useApi();
  const { mutate } = useSWRConfig();
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

  const members = club?.members ?? [];
  const activePredictionRounds = predictionRounds.filter(
    (round) => round.status === 'COMMITTED' || round.status === 'PENDING'
  );
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
    members.some(
      (member) => member.user.walletAddress.toLowerCase() === address.toLowerCase()
    );

  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubPublic, setClubPublic] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubSaveError, setClubSaveError] = useState<string | null>(null);
  const [clubSaveSuccess, setClubSaveSuccess] = useState<string | null>(null);

  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [creatingPrediction, setCreatingPrediction] = useState(false);
  const [cohortId, setCohortId] = useState('');
  const [marketRef, setMarketRef] = useState('');
  const [marketTitle, setMarketTitle] = useState('');
  const [commitAmounts, setCommitAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!club) return;
    setClubName(club.name);
    setClubDescription(club.description ?? '');
    setClubPublic(club.isPublic);
    setCommitAmounts((prev) => {
      const next: Record<string, string> = { ...prev };
      club.members.forEach((member) => {
        if (next[member.user.id] === undefined) {
          next[member.user.id] = '';
        }
      });
      return next;
    });
  }, [club]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const fetchApplications = async () => {
      setAppsLoading(true);
      setAppsError(null);
      try {
        const response = await apiFetch<{
          success: boolean;
          data: { items: Application[] };
        }>(`/api/clubs/${params.slug}/applications?status=PENDING`);
        if (!cancelled) {
          setApplications(response.success ? response.data.items : []);
        }
      } catch (err) {
        if (!cancelled) {
          setAppsError(err instanceof Error ? err.message : 'Failed to load applications');
        }
      } finally {
        if (!cancelled) {
          setAppsLoading(false);
        }
      }
    };

    fetchApplications();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, isAdmin, params.slug]);

  const handleApprove = async (applicationId: string) => {
    setApprovingId(applicationId);
    try {
      const response = await apiFetch<{ success: boolean }>(
        `/api/clubs/${params.slug}/applications/${applicationId}/approve`,
        {
          method: 'POST',
        }
      );
      if (response.success) {
        setApplications((prev) => prev.filter((app) => app.id !== applicationId));
        await mutate(`/api/clubs/${params.slug}`);
      }
    } catch {
      // errors handled by state below
    } finally {
      setApprovingId(null);
    }
  };

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

  const handleCreatePrediction = async (event: React.FormEvent) => {
    event.preventDefault();
    setPredictionError(null);
    if (!isValidBytes32(cohortId.trim())) {
      setPredictionError('Cohort ID must be a bytes32 hex string');
      return;
    }

    const members = (club?.members ?? [])
      .map((member) => ({
        userId: member.user.id,
        commitAmount: commitAmounts[member.user.id]?.trim() || '0',
      }))
      .filter((member) => {
        try {
          return BigInt(member.commitAmount) > 0n;
        } catch {
          return false;
        }
      });

    if (members.length === 0) {
      setPredictionError('Set a commit amount for at least one member');
      return;
    }

    setCreatingPrediction(true);
    try {
      const response = await apiFetch<{ success: boolean }>(
        `/api/clubs/${params.slug}/predictions`,
        {
          method: 'POST',
          body: JSON.stringify({
            cohortId: cohortId.trim(),
            marketRef: marketRef.trim() || undefined,
            marketTitle: marketTitle.trim() || undefined,
            members,
          }),
        }
      );
      if (response.success) {
        setCohortId('');
        setMarketRef('');
        setMarketTitle('');
        setCommitAmounts({});
        await mutate(`/api/clubs/${params.slug}/predictions`);
      }
    } catch (err) {
      setPredictionError(err instanceof Error ? err.message : 'Failed to create prediction');
    } finally {
      setCreatingPrediction(false);
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
              <Badge variant="outline">You are a manager</Badge>
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
                    <p className="text-sm text-destructive">{appsError}</p>
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
                                  <CopyableAddress address={app.user.walletAddress} variant="inline" />
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
                            <p className="mt-2 text-sm text-muted-foreground">&ldquo;{app.message}&rdquo;</p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(app.id)}
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
                    {clubSaveError && (
                      <p className="text-sm text-destructive">{clubSaveError}</p>
                    )}
                    {clubSaveSuccess && (
                      <p className="text-sm text-green-600">{clubSaveSuccess}</p>
                    )}
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

            <Card>
              <CardHeader>
                <CardTitle>Create Prediction</CardTitle>
                <CardDescription>Commit funds for a new prediction round.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePrediction} className="space-y-4">
                  {predictionError && <p className="text-sm text-destructive">{predictionError}</p>}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cohort ID (bytes32)</label>
                    <Input
                      value={cohortId}
                      onChange={(e) => setCohortId(e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Market Reference</label>
                    <Input
                      value={marketRef}
                      onChange={(e) => setMarketRef(e.target.value)}
                      placeholder="Polymarket URL or ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Market Title</label>
                    <Input
                      value={marketTitle}
                      onChange={(e) => setMarketTitle(e.target.value)}
                      placeholder="e.g., US Election 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Commit amounts (USDC, 6 decimals)</div>
                    <div className="space-y-2">
                      {club.members.map((member) => (
                        <div key={member.user.id} className="flex items-center gap-3">
                          <div className="w-40 text-xs text-muted-foreground">
                            {member.user.email || member.user.walletAddress.slice(0, 10) + '…'}
                          </div>
                          <Input
                            value={commitAmounts[member.user.id] || ''}
                            onChange={(e) =>
                              setCommitAmounts((prev) => ({
                                ...prev,
                                [member.user.id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingPrediction}>
                    {creatingPrediction ? 'Creating...' : 'Create Prediction'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
