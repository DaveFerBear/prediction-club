import Link from 'next/link';
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

// Mock data
const mockClub = {
  name: 'Alpha Traders',
  slug: 'alpha-traders',
  tvl: '45,000',
  available: '30,000',
  committed: '15,000',
};

const mockApplications = [
  { id: '1', address: '0x7777...8888', name: 'trader.eth', message: 'Experienced trader, 5y+ in markets', createdAt: '2 hours ago' },
  { id: '2', address: '0x9999...AAAA', name: '0x9999...AAAA', message: 'Looking to join a professional group', createdAt: '1 day ago' },
];

const mockMembers = [
  { id: '1', name: 'alice.eth', address: '0x1111...2222', role: 'ADMIN', available: '15,000', committed: '5,000' },
  { id: '2', name: '0x3333...4444', address: '0x3333...4444', role: 'MEMBER', available: '8,000', committed: '4,000' },
  { id: '3', name: 'bob.eth', address: '0x5555...6666', role: 'MEMBER', available: '7,000', committed: '6,000' },
];

export default function ClubAdminPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Prediction Club
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Button>0x1234...5678</Button>
          </nav>
        </div>
      </header>

      <main className="container py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Link href={`/clubs/${params.slug}`} className="text-muted-foreground hover:text-foreground">
              {mockClub.name}
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
              <CardDescription>Total Value Locked</CardDescription>
              <CardTitle className="text-2xl">${mockClub.tvl}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available</CardDescription>
              <CardTitle className="text-2xl text-green-600">${mockClub.available}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Committed</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">${mockClub.committed}</CardTitle>
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
              {mockApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending applications</p>
              ) : (
                <div className="space-y-4">
                  {mockApplications.map((app) => (
                    <div key={app.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{app.name}</p>
                          <p className="text-xs text-muted-foreground">{app.address}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{app.createdAt}</span>
                      </div>
                      {app.message && (
                        <p className="mt-2 text-sm text-muted-foreground">&ldquo;{app.message}&rdquo;</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm">Approve</Button>
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

          {/* Create Cohort */}
          <Card>
            <CardHeader>
              <CardTitle>Create New Cohort</CardTitle>
              <CardDescription>Start a new prediction round</CardDescription>
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
                <Button className="w-full">Create Cohort</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Members Management */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage club membership and process withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Member</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium text-right">Available</th>
                    <th className="pb-3 font-medium text-right">Committed</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockMembers.map((member) => (
                    <tr key={member.id} className="border-b">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                      </td>
                      <td className="py-4 text-right">${member.available}</td>
                      <td className="py-4 text-right">${member.committed}</td>
                      <td className="py-4 text-right">
                        <Button size="sm" variant="outline">
                          Withdraw
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Safe Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Safe Actions</CardTitle>
            <CardDescription>Execute transactions via Gnosis Safe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline">View Pending Transactions</Button>
              <Button variant="outline">Upgrade Threshold</Button>
              <Button variant="outline">Add Signer</Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Note: All vault operations (commit, settle, withdraw) are executed via the Safe
              multisig. Currently operating as 1-of-1.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
