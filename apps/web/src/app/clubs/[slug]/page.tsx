import Link from 'next/link';
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

// Mock club data
const mockClub = {
  id: '1',
  name: 'Alpha Traders',
  slug: 'alpha-traders',
  description: 'A prediction club focused on political and economic markets.',
  isPublic: true,
  memberCount: 12,
  tvl: '45,000',
  safeAddress: '0x1234...5678',
  vaultAddress: '0xABCD...EF01',
  manager: {
    name: 'alice.eth',
    address: '0x1111...2222',
    isVerified: true,
  },
  members: [
    { name: 'alice.eth', address: '0x1111...2222', role: 'ADMIN' },
    { name: '0x3333...4444', address: '0x3333...4444', role: 'MEMBER' },
    { name: 'bob.eth', address: '0x5555...6666', role: 'MEMBER' },
  ],
  cohorts: [
    {
      id: '1',
      title: 'US Election 2024',
      status: 'COMMITTED',
      stakeTotal: '15,000',
      memberCount: 8,
    },
    {
      id: '2',
      title: 'Fed Rate Decision',
      status: 'COMMITTED',
      stakeTotal: '8,000',
      memberCount: 6,
    },
    {
      id: '3',
      title: 'ETH Price EOY',
      status: 'SETTLED',
      stakeTotal: '12,000',
      memberCount: 10,
      pnl: '+2,400',
    },
  ],
};

export default function ClubPublicPage({ params }: { params: { slug: string } }) {
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
            <Button>Connect Wallet</Button>
          </nav>
        </div>
      </header>

      <main className="container py-8">
        {/* Club Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{mockClub.name}</h1>
                {mockClub.isPublic && <Badge variant="secondary">Public</Badge>}
              </div>
              <p className="mt-2 text-muted-foreground">{mockClub.description}</p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Manager:{' '}
                  <span className="text-foreground">
                    {mockClub.manager.name}
                    {mockClub.manager.isVerified && ' ✓'}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Safe: <span className="font-mono text-foreground">{mockClub.safeAddress}</span>
                </span>
              </div>
            </div>
            <Button>Apply to Join</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Value Locked</CardDescription>
              <CardTitle className="text-2xl">${mockClub.tvl}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Members</CardDescription>
              <CardTitle className="text-2xl">{mockClub.memberCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Cohorts</CardDescription>
              <CardTitle className="text-2xl">
                {mockClub.cohorts.filter((c) => c.status === 'COMMITTED').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Cohorts</CardDescription>
              <CardTitle className="text-2xl">{mockClub.cohorts.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cohorts */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-semibold">Cohorts</h2>
            <div className="space-y-4">
              {mockClub.cohorts.map((cohort) => (
                <Card key={cohort.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{cohort.title}</CardTitle>
                      <Badge
                        variant={cohort.status === 'COMMITTED' ? 'default' : 'secondary'}
                      >
                        {cohort.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Stake</span>
                      <span>${cohort.stakeTotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Participants</span>
                      <span>{cohort.memberCount}</span>
                    </div>
                    {cohort.pnl && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">PnL</span>
                        <span className="text-green-600">{cohort.pnl}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Members */}
          <div>
            <h2 className="mb-4 text-xl font-semibold">Members</h2>
            <Card>
              <CardContent className="py-4">
                <div className="space-y-4">
                  {mockClub.members.map((member) => (
                    <div key={member.address} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.address}</p>
                      </div>
                      {member.role === 'ADMIN' && (
                        <Badge variant="outline" className="text-xs">
                          Admin
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
