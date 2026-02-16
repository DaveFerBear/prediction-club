'use client';

import Link from 'next/link';
import { formatUsdAmount } from '@prediction-club/shared';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useSWRConfig } from 'swr';
import {
  useApi,
  useApproveApplication,
  useApplyToClub,
  useClubBalance,
  useClub,
  useClubSetupStatus,
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
import { CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/header';
import { ClubSetupChecklist } from '@/components/club-setup-checklist';
import { ClubDepositPopover } from '@/components/club-deposit-popover';
import { CopyableAddress } from '@/components/copyable-address';
import { ClubActionPanel } from '@/components/club/ClubActionPanel';
import { AdminConsoleSection } from '@/components/club/AdminConsoleSection';
import { ClubHeroPanel } from '@/components/club/ClubHeroPanel';
import { ClubMetricsPanel } from '@/components/club/ClubMetricsPanel';
import { ClubTreasuryCard } from '@/components/club/ClubTreasuryCard';
import { PredictionRoundListItem } from '@/components/club/PredictionRoundListItem';

const clubPageVars = {
  '--club-bg-accent': 'linear-gradient(135deg, #f7f9fc 0%, #f2f6ff 100%)',
  '--club-border-strong': '#d7e0f0',
  '--club-border-soft': '#e7ecf5',
  '--club-text-primary': '#0f172a',
  '--club-text-secondary': '#475569',
  '--club-success': '#15803d',
  '--club-danger': '#b91c1c',
} as CSSProperties;

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

  const performance = club?.performance ?? null;
  const hasActivity = performance?.hasWindowActivity ?? false;

  const perfLoading = false;

  const members = club?.members ?? [];
  const activePredictionRounds = predictionRounds.filter(
    (round) => round.status === 'COMMITTED' || round.status === 'PENDING'
  );

  const exposureSeries = useMemo(() => buildExposureSeries(clubHistory, 7), [clubHistory]);

  const isAdmin = useMemo(() => {
    if (!address) return false;
    const member = members.find(
      (item) => item.user.walletAddress.toLowerCase() === address.toLowerCase()
    );
    return member?.role === 'ADMIN';
  }, [address, members]);

  const isMember =
    !!address &&
    members.some((member) => member.user.walletAddress.toLowerCase() === address.toLowerCase());
  const setup = useClubSetupStatus({
    slug: params.slug,
    isMember,
  });

  const membershipLabel = isMember ? (isAdmin ? 'Admin member' : 'Member') : null;

  const activeVolumeText = `$${formatUsdAmount(club?.activeCommittedVolume ?? '0')}`;

  const returnPct = perfLoading || !hasActivity ? null : (performance?.simpleReturn ?? 0) * 100;

  const returnTone =
    returnPct == null
      ? 'neutral'
      : returnPct > 0.05
        ? 'up'
        : returnPct < -0.05
          ? 'down'
          : 'neutral';

  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubPublic, setClubPublic] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [clubSaveError, setClubSaveError] = useState<string | null>(null);
  const [clubSaveSuccess, setClubSaveSuccess] = useState<string | null>(null);

  const [applyMessage, setApplyMessage] = useState('');
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

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

  const nextSetupAction = useMemo(() => {
    const nextIncomplete = setup.steps.find((step) => step.status !== 'complete');
    if (!nextIncomplete) return 'Ready for autonomous execution.';
    return `Next required step: ${nextIncomplete.label}.`;
  }, [setup.steps]);

  const handleSaveClub = async (event: FormEvent) => {
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
      setApplyError('Sign in to apply.');
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

  const handleRequestWithdraw = async () => {
    setWithdrawMessage(null);
    try {
      await apiFetch(`/api/clubs/${params.slug}/wallet/withdraw`, {
        method: 'POST',
      });
      setWithdrawMessage('Withdrawal requested.');
    } catch (err) {
      setWithdrawMessage(err instanceof Error ? err.message : 'Unable to request withdrawal.');
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

  const heroExposureContent = balanceLoading ? (
    <div className="py-8 text-sm text-[color:var(--club-text-secondary)]">Loading exposure...</div>
  ) : exposureSeries.length === 0 ? (
    <div className="py-8 text-sm text-[color:var(--club-text-secondary)]">No activity yet to chart.</div>
  ) : (
    <ChartExposure
      data={exposureSeries}
      showHeader={false}
      showFooter={false}
      compact
      seamless
      windowBadgeLabel="Past 7 days"
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container space-y-8 py-8" style={clubPageVars}>
        <ClubHeroPanel
          clubName={club.name}
          description={club.description || 'No description'}
          isPublic={club.isPublic}
          membershipLabel={membershipLabel}
          descriptionContent={heroExposureContent}
          actionPanel={
            isMember ? (
              <ClubActionPanel
                title="Next action"
                description="Use your club treasury to participate in autonomous trading rounds."
                helperText={
                  setup.ready
                    ? 'Treasury is funded and ready for autonomous execution.'
                    : 'Complete setup and funding to become trading-ready.'
                }
                primaryAction={
                  isAdmin ? (
                    <Link href={`/clubs/${club.slug}/predict`} className="block">
                      <Button className="w-full">Make prediction</Button>
                    </Link>
                  ) : (
                    <ClubDepositPopover
                      slug={params.slug}
                      walletAddress={setup.wallet?.walletAddress ?? null}
                      canDeposit={setup.authenticated}
                      triggerLabel="Deposit into club"
                      triggerVariant="default"
                      triggerSize="default"
                      triggerClassName="w-full justify-center"
                    />
                  )
                }
                secondaryAction={
                  isAdmin ? (
                    <ClubDepositPopover
                      slug={params.slug}
                      walletAddress={setup.wallet?.walletAddress ?? null}
                      canDeposit={setup.authenticated}
                      triggerLabel="Deposit into club"
                      triggerVariant="outline"
                      triggerSize="sm"
                      triggerClassName="w-full justify-center"
                    />
                  ) : undefined
                }
              />
            ) : (
              <ClubActionPanel
                title="Join this club"
                description="Apply to join this club and start participating in rounds."
                primaryAction={
                  <Button type="button" onClick={handleApply} disabled={isApplying} className="w-full">
                    {isApplying ? 'Submitting...' : 'Apply to Join'}
                  </Button>
                }
              >
                <Input
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Message (optional)"
                  className="h-9 bg-muted text-sm"
                />
                {!isUserAuthenticated ? (
                  <p className="text-xs text-muted-foreground">Sign in to apply.</p>
                ) : null}
                {applySuccess ? <p className="text-xs text-emerald-600">{applySuccess}</p> : null}
                {applyError ? <p className="text-xs text-destructive">{applyError}</p> : null}
              </ClubActionPanel>
            )
          }
        />

        {isMember ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="h-full border-[color:var(--club-border-soft)] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <span>Your Club Setup</span>
                  {setup.ready ? (
                    <CheckCircle2
                      className="h-7 w-7 text-[color:var(--club-success)]"
                      aria-label="Setup complete"
                    />
                  ) : null}
                </CardTitle>
                <CardDescription>Complete this checklist to enable autonomous trading.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="rounded-lg border border-[color:var(--club-border-soft)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--club-text-primary)]">
                  {nextSetupAction}
                </p>
                <ClubSetupChecklist steps={setup.steps} />
              </CardContent>
            </Card>

            <ClubTreasuryCard
              wallet={setup.wallet}
              onInitWallet={setup.initWallet}
              onRefreshWallet={setup.refreshWallet}
              onWithdraw={handleRequestWithdraw}
              walletInitializing={setup.walletInitializing}
              walletInitError={setup.walletInitError}
              withdrawMessage={withdrawMessage}
            />
          </section>
        ) : null}

        <ClubMetricsPanel
          activeVolumeText={activeVolumeText}
          returnPct={returnPct}
          perfLoading={perfLoading}
          hasActivity={hasActivity}
          returnTone={returnTone}
          membersCount={club._count.members}
          activePredictionsCount={activePredictionRounds.length}
          totalPredictionsCount={club._count.predictionRounds}
        />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[color:var(--club-text-primary)]">
                Predictions
              </h2>
              {predictionRounds.length === 0 ? (
                <Card className="border-[color:var(--club-border-soft)] shadow-sm">
                  <CardContent className="py-10 text-center">
                    <div className="text-4xl">📈</div>
                    <p className="mt-3 text-muted-foreground">No predictions yet</p>
                    {isAdmin ? (
                      <Link href={`/clubs/${club.slug}/predict`} className="mt-4 inline-block">
                        <Button size="sm">Make first prediction</Button>
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {predictionRounds.map((predictionRound) => (
                    <PredictionRoundListItem key={predictionRound.id} round={predictionRound} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[color:var(--club-text-primary)]">Members</h2>
            <Card className="border-[color:var(--club-border-soft)] bg-white shadow-sm">
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

                        <div className="min-w-0 flex-1">
                          <CopyableAddress address={member.user.walletAddress} variant="compact" />
                        </div>

                        {member.role === 'ADMIN' ? (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {isAdmin ? (
          <AdminConsoleSection
            applications={applications}
            appsLoading={appsLoading}
            appsError={appsError ?? undefined}
            approvingId={approvingId}
            onApprove={approve}
            settingsPanel={
              <Card className="border-[color:var(--club-border-soft)] bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Edit Club Details</CardTitle>
                  <CardDescription>Update name, description, and visibility.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveClub} className="space-y-4">
                    {clubSaveError ? <p className="text-sm text-destructive">{clubSaveError}</p> : null}
                    {clubSaveSuccess ? <p className="text-sm text-green-600">{clubSaveSuccess}</p> : null}

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
            }
          />
        ) : null}
      </main>
    </div>
  );
}
