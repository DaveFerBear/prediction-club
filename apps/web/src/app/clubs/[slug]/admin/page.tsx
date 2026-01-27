'use client';

import Link from 'next/link';
import { useClub, useClubApplications, useApproveApplication } from '@/hooks';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Avatar,
  AvatarFallback,
} from '@prediction-club/ui';
import { Header } from '@/components/header';
import { CopyableAddress } from '@/components/copyable-address';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

export default function ClubAdminPage({ params }: { params: { slug: string } }) {
  const { club, isLoading: clubLoading, error: clubError } = useClub(params.slug);
  const {
    applications,
    isLoading: appsLoading,
    error: appsError,
  } = useClubApplications(params.slug, 'PENDING');
  const { approve, approvingId, error: approveError } = useApproveApplication(params.slug);
  const loading = clubLoading || appsLoading;
  const error = clubError || appsError || approveError;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-muted-foreground">Loading...</div>
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
              <Link href="/dashboard" className="mt-4 inline-block">
                <Button variant="outline">Back to My clubs</Button>
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
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Link href={`/clubs/${params.slug}`} className="text-muted-foreground hover:text-foreground">
              {club.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>Admin</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold">Club Administration</h1>
        </div>

        {/* Vault Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-2xl">{club._count.members}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Predictions</CardDescription>
              <CardTitle className="text-2xl">{club._count.predictionRounds}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Applications</CardDescription>
              <CardTitle className="text-2xl">{applications.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Applications */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Applications</CardTitle>
              <CardDescription>Review and approve membership requests</CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending applications</p>
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
                        <span className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</span>
                      </div>
                      {app.message && (
                        <p className="mt-2 text-sm text-muted-foreground">&ldquo;{app.message}&rdquo;</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve(app.id)}
                          disabled={approvingId === app.id}
                        >
                          {approvingId === app.id ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="outline">
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Prediction */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Prediction</CardTitle>
              <CardDescription>Start a new prediction</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Market Reference</label>
                  <Input placeholder="Polymarket URL or ID" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Market Title</label>
                  <Input placeholder="e.g., US Election 2024" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Total Stake (USDC)</label>
                  <Input type="number" placeholder="10000" className="mt-1" />
                </div>
                <p className="text-xs text-muted-foreground">
                  All eligible members will be automatically included based on their available
                  balance.
                </p>
                <Button className="w-full">Create Prediction</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Members Management */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage club membership</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Member</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {club.members.map((member) => (
                    <tr key={member.user.id} className="border-b">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {member.user.walletAddress.slice(2, 4).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.user.email || (
                                <CopyableAddress address={member.user.walletAddress} variant="inline" />
                              )}
                            </p>
                            {member.user.email && (
                              <CopyableAddress
                                address={member.user.walletAddress}
                                variant="compact"
                                className="text-muted-foreground"
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </td>
                      <td className="py-4 text-right">
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Contract Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Contract Addresses</CardTitle>
            <CardDescription>On-chain deployment info</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Safe Address</span>
                <CopyableAddress address={club.safeAddress} variant="compact" />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vault Address</span>
                <CopyableAddress address={club.vaultAddress} variant="compact" />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
