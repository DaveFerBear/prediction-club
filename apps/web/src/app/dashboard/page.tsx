import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@prediction-club/ui';
import { Header } from '@/components/header';

// Mock data for the dashboard
const mockClubs = [
  {
    id: '1',
    name: 'Alpha Traders',
    slug: 'alpha-traders',
    memberCount: 12,
    tvl: '45,000',
    activeCohorts: 3,
  },
  {
    id: '2',
    name: 'DeFi Degens',
    slug: 'defi-degens',
    memberCount: 8,
    tvl: '28,500',
    activeCohorts: 2,
  },
];

const mockStats = {
  totalDeposited: '25,000',
  totalCommitted: '15,000',
  availableBalance: '10,000',
  activeCohorts: 5,
  recentPnl: '+2,340',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your prediction club activity</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Deposited</CardDescription>
              <CardTitle className="text-2xl">${mockStats.totalDeposited}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Committed</CardDescription>
              <CardTitle className="text-2xl">${mockStats.totalCommitted}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available</CardDescription>
              <CardTitle className="text-2xl">${mockStats.availableBalance}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Recent PnL</CardDescription>
              <CardTitle className="text-2xl text-green-600">{mockStats.recentPnl}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Clubs Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Clubs</h2>
            <Link href="/clubs/create">
              <Button>Create Club</Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockClubs.map((club) => (
              <Card key={club.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{club.name}</CardTitle>
                    <Badge variant="secondary">{club.activeCohorts} active</Badge>
                  </div>
                  <CardDescription>/{club.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Members</span>
                    <span>{club.memberCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVL</span>
                    <span>${club.tvl}</span>
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
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
          <Card>
            <CardContent className="py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">Cohort Settled</p>
                    <p className="text-sm text-muted-foreground">
                      Alpha Traders - Election 2024 Market
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">+$1,200</p>
                    <p className="text-sm text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">Deposit</p>
                    <p className="text-sm text-muted-foreground">DeFi Degens</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$5,000</p>
                    <p className="text-sm text-muted-foreground">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Cohort Created</p>
                    <p className="text-sm text-muted-foreground">
                      Alpha Traders - Fed Rate Decision
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">$8,000 committed</p>
                    <p className="text-sm text-muted-foreground">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
