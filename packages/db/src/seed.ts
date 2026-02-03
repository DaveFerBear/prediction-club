import path from 'path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, LedgerEntryType, type PredictionRoundStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const localEnvPath = path.resolve(process.cwd(), '.env');
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
loadEnv({ path: localEnvPath });
loadEnv({ path: rootEnvPath });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in the environment.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_TAG = 'seed:v2';

type SeedUser = {
  email: string;
  walletAddress: string;
  safeAddress: string;
};

type SeedClub = {
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  managerWallet: string;
  members: Array<{ wallet: string; role: 'ADMIN' | 'MEMBER' }>;
};

type SeedRound = {
  clubSlug: string;
  marketRef: string;
  marketTitle: string;
  status: PredictionRoundStatus;
  createdAt?: string; // ISO date
  members: Array<{ wallet: string; commit: number; payout?: number }>;
};

type SeedDeposit = {
  clubSlug: string;
  wallet: string;
  amount: number;
  createdAt?: string;
};

function usdc(amount: number) {
  return Math.round(amount * 1_000_000).toString();
}

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const users: SeedUser[] = [
  {
    email: 'manager@example.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    safeAddress: '0x1000000000000000000000000000000000000001',
  },
  {
    email: 'member@example.com',
    walletAddress: '0x0987654321098765432109876543210987654321',
    safeAddress: '0x1000000000000000000000000000000000000002',
  },
  {
    email: 'sarah@example.com',
    walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    safeAddress: '0x1000000000000000000000000000000000000003',
  },
  {
    email: 'leo@example.com',
    walletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    safeAddress: '0x1000000000000000000000000000000000000004',
  },
  {
    email: 'mika@example.com',
    walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    safeAddress: '0x1000000000000000000000000000000000000005',
  },
  {
    email: 'nora@example.com',
    walletAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
    safeAddress: '0x1000000000000000000000000000000000000006',
  },
];

const clubs: SeedClub[] = [
  {
    name: 'Signal Room',
    slug: 'signal-room',
    description: 'A prediction club for signal traders on Polymarket.',
    isPublic: true,
    managerWallet: users[0].walletAddress,
    members: [
      { wallet: users[0].walletAddress, role: 'ADMIN' },
      { wallet: users[1].walletAddress, role: 'MEMBER' },
      { wallet: users[2].walletAddress, role: 'MEMBER' },
    ],
  },
  {
    name: 'Macro Mavericks',
    slug: 'macro-mavericks',
    description: 'Macro trades, rates, and big-picture bets.',
    isPublic: true,
    managerWallet: users[2].walletAddress,
    members: [
      { wallet: users[2].walletAddress, role: 'ADMIN' },
      { wallet: users[3].walletAddress, role: 'MEMBER' },
      { wallet: users[4].walletAddress, role: 'MEMBER' },
    ],
  },
  {
    name: 'Sports Lab',
    slug: 'sports-lab',
    description: 'Collaborative sports prediction club.',
    isPublic: false,
    managerWallet: users[3].walletAddress,
    members: [
      { wallet: users[3].walletAddress, role: 'ADMIN' },
      { wallet: users[1].walletAddress, role: 'MEMBER' },
      { wallet: users[5].walletAddress, role: 'MEMBER' },
    ],
  },
];

const rounds: SeedRound[] = [
  {
    clubSlug: 'signal-room',
    marketRef: 'polymarket:us-election-2024',
    marketTitle: 'Who will win the 2024 US Presidential Election?',
    status: 'COMMITTED',
    members: [
      { wallet: users[0].walletAddress, commit: 250 },
      { wallet: users[1].walletAddress, commit: 150 },
      { wallet: users[2].walletAddress, commit: 100 },
    ],
  },
  {
    clubSlug: 'signal-room',
    marketRef: 'polymarket:btc-2025',
    marketTitle: 'Will BTC trade above $100k by 2025?',
    status: 'PENDING',
    members: [
      { wallet: users[0].walletAddress, commit: 100 },
      { wallet: users[2].walletAddress, commit: 75 },
    ],
  },
  {
    clubSlug: 'signal-room',
    marketRef: 'polymarket:ai-regulation-2025',
    marketTitle: 'Will the US pass major AI regulation in 2025?',
    status: 'PENDING',
    members: [
      { wallet: users[0].walletAddress, commit: 90 },
      { wallet: users[1].walletAddress, commit: 60 },
      { wallet: users[2].walletAddress, commit: 50 },
    ],
  },
  {
    clubSlug: 'signal-room',
    marketRef: 'polymarket:inflation-2024',
    marketTitle: 'US inflation above 3% by year-end 2024?',
    status: 'SETTLED',
    members: [
      { wallet: users[0].walletAddress, commit: 120, payout: 210 },
      { wallet: users[1].walletAddress, commit: 90, payout: 0 },
      { wallet: users[2].walletAddress, commit: 60, payout: 105 },
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:fed-cuts-2024',
    marketTitle: 'Will the Fed cut rates in 2024?',
    status: 'COMMITTED',
    createdAt: '2024-06-15',
    members: [
      { wallet: users[2].walletAddress, commit: 300 },
      { wallet: users[3].walletAddress, commit: 200 },
      { wallet: users[4].walletAddress, commit: 100 },
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:oil-100-2025',
    marketTitle: 'Will oil trade above $100 in 2025?',
    status: 'PENDING',
    createdAt: '2024-07-20',
    members: [
      { wallet: users[2].walletAddress, commit: 180 },
      { wallet: users[3].walletAddress, commit: 120 },
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:soft-landing-2024',
    marketTitle: 'Will the US economy achieve a soft landing in 2024?',
    status: 'SETTLED',
    createdAt: '2024-04-10',
    members: [
      { wallet: users[2].walletAddress, commit: 220, payout: 0 },
      { wallet: users[3].walletAddress, commit: 140, payout: 240 },
      { wallet: users[4].walletAddress, commit: 80, payout: 130 },
    ],
  },
  // Additional Macro Mavericks history for richer charts
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:usd-yen-150',
    marketTitle: 'Will USD/JPY hit 150 before Oct 2024?',
    status: 'SETTLED',
    createdAt: '2024-02-05',
    members: [
      { wallet: users[2].walletAddress, commit: 180, payout: 260 }, // win
      { wallet: users[3].walletAddress, commit: 120, payout: 0 },   // loss
      { wallet: users[4].walletAddress, commit: 90, payout: 150 },  // win
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:europe-recession-2024',
    marketTitle: 'Will Europe enter recession in 2024?',
    status: 'SETTLED',
    createdAt: '2024-03-12',
    members: [
      { wallet: users[2].walletAddress, commit: 200, payout: 0 },   // loss
      { wallet: users[3].walletAddress, commit: 140, payout: 220 }, // win
      { wallet: users[4].walletAddress, commit: 110, payout: 0 },   // loss
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:gold-2500-2024',
    marketTitle: 'Will gold hit $2,500 in 2024?',
    status: 'SETTLED',
    createdAt: '2024-05-08',
    members: [
      { wallet: users[2].walletAddress, commit: 260, payout: 420 }, // strong win
      { wallet: users[3].walletAddress, commit: 160, payout: 0 },   // loss
      { wallet: users[4].walletAddress, commit: 120, payout: 90 },  // small loss
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:treasury-10y-6pct',
    marketTitle: 'Will US 10Y yield touch 6% in 2024?',
    status: 'SETTLED',
    createdAt: '2024-08-18',
    members: [
      { wallet: users[2].walletAddress, commit: 240, payout: 0 },   // loss
      { wallet: users[3].walletAddress, commit: 170, payout: 280 }, // win
      { wallet: users[4].walletAddress, commit: 90, payout: 0 },    // loss
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:snp500-5200-2024',
    marketTitle: 'Will S&P 500 close above 5200 in 2024?',
    status: 'COMMITTED',
    createdAt: '2024-10-05',
    members: [
      { wallet: users[2].walletAddress, commit: 300 },
      { wallet: users[3].walletAddress, commit: 180 },
      { wallet: users[4].walletAddress, commit: 140 },
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:btc-halving-2024',
    marketTitle: 'Will BTC hit $90k by end of 2024?',
    status: 'PENDING',
    createdAt: '2024-11-12',
    members: [
      { wallet: users[2].walletAddress, commit: 280 },
      { wallet: users[3].walletAddress, commit: 200 },
      { wallet: users[4].walletAddress, commit: 120 },
    ],
  },
  // Recent activity for 30-day performance (relative dates)
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:cpi-latest',
    marketTitle: 'Will US CPI print above 3.5% YoY this month?',
    status: 'SETTLED',
    createdAt: daysAgo(22),
    members: [
      { wallet: users[2].walletAddress, commit: 220, payout: 310 }, // win
      { wallet: users[3].walletAddress, commit: 160, payout: 0 },   // loss
      { wallet: users[4].walletAddress, commit: 120, payout: 90 },  // slight loss
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:fomc-next',
    marketTitle: 'Will the Fed cut at the next FOMC?',
    status: 'COMMITTED',
    createdAt: daysAgo(8),
    members: [
      { wallet: users[2].walletAddress, commit: 260 },
      { wallet: users[3].walletAddress, commit: 180 },
      { wallet: users[4].walletAddress, commit: 140 },
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:gdp-surprise',
    marketTitle: 'Will GDP surprise to the upside?',
    status: 'SETTLED',
    createdAt: daysAgo(5),
    members: [
      { wallet: users[2].walletAddress, commit: 180, payout: 0 },   // loss
      { wallet: users[3].walletAddress, commit: 140, payout: 230 }, // win
      { wallet: users[4].walletAddress, commit: 90, payout: 0 },    // loss
    ],
  },
  {
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:jobs-surprise',
    marketTitle: 'Will nonfarm payrolls beat consensus by >100k?',
    status: 'SETTLED',
    createdAt: daysAgo(10),
    members: [
      { wallet: users[2].walletAddress, commit: 200, payout: 420 }, // strong win
      { wallet: users[3].walletAddress, commit: 150, payout: 80 },  // loss
      { wallet: users[4].walletAddress, commit: 120, payout: 60 },  // loss
    ],
  },
  {
    clubSlug: 'sports-lab',
    marketRef: 'polymarket:nfl-superbowl',
    marketTitle: 'Super Bowl winner 2025',
    status: 'SETTLED',
    members: [
      { wallet: users[3].walletAddress, commit: 120, payout: 180 },
      { wallet: users[1].walletAddress, commit: 80, payout: 0 },
      { wallet: users[5].walletAddress, commit: 60, payout: 90 },
    ],
  },
  {
    clubSlug: 'sports-lab',
    marketRef: 'polymarket:nba-finals-2025',
    marketTitle: 'NBA Finals winner 2025',
    status: 'PENDING',
    members: [
      { wallet: users[3].walletAddress, commit: 110 },
      { wallet: users[1].walletAddress, commit: 70 },
      { wallet: users[5].walletAddress, commit: 50 },
    ],
  },
  {
    clubSlug: 'sports-lab',
    marketRef: 'polymarket:nfl-mvp-2024',
    marketTitle: 'NFL MVP 2024 season',
    status: 'SETTLED',
    members: [
      { wallet: users[3].walletAddress, commit: 90, payout: 150 },
      { wallet: users[1].walletAddress, commit: 60, payout: 0 },
      { wallet: users[5].walletAddress, commit: 40, payout: 70 },
    ],
  },
];

function groupByClub<T extends { clubSlug: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = map.get(item.clubSlug) ?? [];
    bucket.push(item);
    map.set(item.clubSlug, bucket);
  }
  return map;
}

async function ensureUsers() {
  const results = new Map<string, string>();
  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { walletAddress: user.walletAddress },
      update: {
        email: user.email,
        polymarketSafeAddress: user.safeAddress,
      },
      create: {
        email: user.email,
        walletAddress: user.walletAddress,
        polymarketSafeAddress: user.safeAddress,
      },
    });
    results.set(user.walletAddress, record.id);
  }
  return results;
}

async function ensureClubs(userIds: Map<string, string>) {
  const results = new Map<string, string>();
  for (const club of clubs) {
    const managerId = userIds.get(club.managerWallet);
    if (!managerId) {
      throw new Error(`Missing manager for club ${club.slug}`);
    }
    const record = await prisma.club.upsert({
      where: { slug: club.slug },
      update: {
        name: club.name,
        description: club.description,
        isPublic: club.isPublic,
        managerUserId: managerId,
      },
      create: {
        name: club.name,
        slug: club.slug,
        description: club.description,
        isPublic: club.isPublic,
        managerUserId: managerId,
      },
    });
    results.set(club.slug, record.id);
  }
  return results;
}

async function ensureMemberships(userIds: Map<string, string>, clubIds: Map<string, string>) {
  for (const club of clubs) {
    const clubId = clubIds.get(club.slug);
    if (!clubId) continue;
    for (const member of club.members) {
      const userId = userIds.get(member.wallet);
      if (!userId) continue;
      await prisma.clubMember.upsert({
        where: {
          clubId_userId: {
            clubId,
            userId,
          },
        },
        update: {
          role: member.role,
          status: 'ACTIVE',
        },
        create: {
          clubId,
          userId,
          role: member.role,
          status: 'ACTIVE',
        },
      });
    }
  }
}

async function resetClubActivity(clubIds: Map<string, string>) {
  const clubIdList = Array.from(clubIds.values());
  if (clubIdList.length === 0) return;
  await prisma.ledgerEntry.deleteMany({ where: { clubId: { in: clubIdList } } });
  await prisma.predictionRoundMember.deleteMany({
    where: { predictionRound: { clubId: { in: clubIdList } } },
  });
  await prisma.predictionRound.deleteMany({ where: { clubId: { in: clubIdList } } });
}

async function seedPredictionRounds(userIds: Map<string, string>, clubIds: Map<string, string>) {
  const roundsByClub = groupByClub(rounds);

  for (const [clubSlug, clubRounds] of roundsByClub.entries()) {
    const clubId = clubIds.get(clubSlug);
    if (!clubId) continue;

    for (const round of clubRounds) {
      const members = round.members.map((member) => ({
        userId: userIds.get(member.wallet) ?? '',
        commitAmount: usdc(member.commit),
        payoutAmount: usdc(member.payout ?? 0),
        pnlAmount: usdc((member.payout ?? 0) - member.commit),
      }));

      const stakeTotal = members
        .reduce((sum, entry) => sum + BigInt(entry.commitAmount), 0n)
        .toString();

      const created = await prisma.predictionRound.create({
        data: {
          clubId,
          marketRef: round.marketRef,
          marketTitle: round.marketTitle,
          stakeTotal,
          status: round.status,
          createdAt: round.createdAt ? new Date(round.createdAt) : undefined,
          members: {
            create: members.map((member) => ({
              userId: member.userId,
              commitAmount: member.commitAmount,
              payoutAmount: member.payoutAmount,
              pnlAmount: member.pnlAmount,
            })),
          },
        },
      });

      await prisma.ledgerEntry.createMany({
        data: round.members.flatMap((member, idx) => {
          const userId = userIds.get(member.wallet) ?? '';
          const safeAddress =
            users.find((u) => u.walletAddress === member.wallet)?.safeAddress ?? '';
          const baseCreatedAt = round.createdAt
            ? new Date(new Date(round.createdAt).getTime() + idx * 60_000)
            : undefined;
          const commitEntry = {
            safeAddress,
            clubId,
            userId,
            predictionRoundId: created.id,
            type: LedgerEntryType.COMMIT,
            amount: `-${usdc(member.commit)}`,
            asset: 'USDC.e',
            metadata: { seed: SEED_TAG, marketRef: round.marketRef },
            createdAt: baseCreatedAt,
          };
          const payout = member.payout ?? 0;
          if (payout > 0) {
            return [
              commitEntry,
              {
                safeAddress,
                clubId,
                userId,
                predictionRoundId: created.id,
                type: LedgerEntryType.PAYOUT,
                amount: usdc(payout),
                asset: 'USDC.e',
                metadata: { seed: SEED_TAG, marketRef: round.marketRef },
                createdAt: baseCreatedAt
                  ? new Date(baseCreatedAt.getTime() + 30_000)
                  : undefined,
              },
            ];
          }
          return [commitEntry];
        }),
      });
    }
  }
}

async function seedDeposits(userIds: Map<string, string>, clubIds: Map<string, string>) {
  const deposits: SeedDeposit[] = [
    // Signal Room base funding
    { clubSlug: 'signal-room', wallet: users[0].walletAddress, amount: 600, createdAt: '2024-01-05' },
    { clubSlug: 'signal-room', wallet: users[1].walletAddress, amount: 300, createdAt: '2024-01-08' },
    { clubSlug: 'signal-room', wallet: users[2].walletAddress, amount: 200, createdAt: '2024-01-10' },
    // Macro Mavericks richer history (recent relative dates)
    { clubSlug: 'macro-mavericks', wallet: users[2].walletAddress, amount: 700, createdAt: daysAgo(400) },
    { clubSlug: 'macro-mavericks', wallet: users[3].walletAddress, amount: 350, createdAt: daysAgo(396) },
    { clubSlug: 'macro-mavericks', wallet: users[4].walletAddress, amount: 150, createdAt: daysAgo(392) },
    { clubSlug: 'macro-mavericks', wallet: users[2].walletAddress, amount: 250, createdAt: daysAgo(250) },
    { clubSlug: 'macro-mavericks', wallet: users[3].walletAddress, amount: 180, createdAt: daysAgo(248) },
    // Recent Macro Mavericks funding for performance window
    { clubSlug: 'macro-mavericks', wallet: users[2].walletAddress, amount: 400, createdAt: daysAgo(45) },
    { clubSlug: 'macro-mavericks', wallet: users[3].walletAddress, amount: 250, createdAt: daysAgo(32) },
    { clubSlug: 'macro-mavericks', wallet: users[4].walletAddress, amount: 180, createdAt: daysAgo(18) },
    // Sports Lab funding
    { clubSlug: 'sports-lab', wallet: users[3].walletAddress, amount: 400, createdAt: '2024-02-01' },
    { clubSlug: 'sports-lab', wallet: users[1].walletAddress, amount: 180, createdAt: '2024-02-04' },
    { clubSlug: 'sports-lab', wallet: users[5].walletAddress, amount: 220, createdAt: '2024-02-05' },
  ];

  await prisma.ledgerEntry.createMany({
    data: deposits.map((entry) => {
      const userId = userIds.get(entry.wallet) ?? '';
      const clubId = clubIds.get(entry.clubSlug) ?? '';
      const safeAddress = users.find((u) => u.walletAddress === entry.wallet)?.safeAddress ?? '';
      return {
        safeAddress,
        clubId,
        userId,
        type: LedgerEntryType.DEPOSIT,
        amount: usdc(entry.amount),
        asset: 'USDC.e',
        metadata: { seed: SEED_TAG },
        createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
      };
    }),
  });
}

async function main() {
  console.log('Seeding database...');

  const userIds = await ensureUsers();
  const clubIds = await ensureClubs(userIds);
  await ensureMemberships(userIds, clubIds);
  await resetClubActivity(clubIds);
  await seedDeposits(userIds, clubIds);
  await seedPredictionRounds(userIds, clubIds);

  console.log('Seeding complete!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
