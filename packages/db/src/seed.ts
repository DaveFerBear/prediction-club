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
  members: Array<{ wallet: string; commit: number; payout?: number }>;
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
    clubSlug: 'macro-mavericks',
    marketRef: 'polymarket:fed-cuts-2024',
    marketTitle: 'Will the Fed cut rates in 2024?',
    status: 'COMMITTED',
    members: [
      { wallet: users[2].walletAddress, commit: 300 },
      { wallet: users[3].walletAddress, commit: 200 },
      { wallet: users[4].walletAddress, commit: 100 },
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
];

function usdc(amount: number) {
  return Math.round(amount * 1_000_000).toString();
}

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
        data: round.members.flatMap((member) => {
          const userId = userIds.get(member.wallet) ?? '';
          const safeAddress =
            users.find((u) => u.walletAddress === member.wallet)?.safeAddress ?? '';
          const commitEntry = {
            safeAddress,
            clubId,
            userId,
            predictionRoundId: created.id,
            type: LedgerEntryType.COMMIT,
            amount: `-${usdc(member.commit)}`,
            asset: 'USDC.e',
            metadata: { seed: SEED_TAG, marketRef: round.marketRef },
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
  const deposits: Array<{
    clubSlug: string;
    wallet: string;
    amount: number;
  }> = [
    { clubSlug: 'signal-room', wallet: users[0].walletAddress, amount: 600 },
    { clubSlug: 'signal-room', wallet: users[1].walletAddress, amount: 300 },
    { clubSlug: 'signal-room', wallet: users[2].walletAddress, amount: 200 },
    { clubSlug: 'macro-mavericks', wallet: users[2].walletAddress, amount: 700 },
    { clubSlug: 'macro-mavericks', wallet: users[3].walletAddress, amount: 350 },
    { clubSlug: 'macro-mavericks', wallet: users[4].walletAddress, amount: 150 },
    { clubSlug: 'sports-lab', wallet: users[3].walletAddress, amount: 400 },
    { clubSlug: 'sports-lab', wallet: users[1].walletAddress, amount: 180 },
    { clubSlug: 'sports-lab', wallet: users[5].walletAddress, amount: 220 },
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
