import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a test user (manager)
  const manager = await prisma.user.upsert({
    where: { walletAddress: '0x1234567890123456789012345678901234567890' },
    update: {},
    create: {
      email: 'manager@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    },
  });

  console.log('Created manager:', manager.id);

  // Create a test user (member)
  const member = await prisma.user.upsert({
    where: { walletAddress: '0x0987654321098765432109876543210987654321' },
    update: {},
    create: {
      email: 'member@example.com',
      walletAddress: '0x0987654321098765432109876543210987654321',
    },
  });

  console.log('Created member:', member.id);

  // Create a test club
  const club = await prisma.club.upsert({
    where: { slug: 'signal-room' },
    update: {},
    create: {
      name: 'Signal Room',
      slug: 'signal-room',
      description: 'A prediction club for signal traders on Polymarket.',
      managerUserId: manager.id,
      isPublic: true,
    },
  });

  console.log('Created club:', club.slug);

  // Add manager as admin member
  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId: club.id,
        userId: manager.id,
      },
    },
    update: {},
    create: {
      clubId: club.id,
      userId: manager.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // Add member
  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId: club.id,
        userId: member.id,
      },
    },
    update: {},
    create: {
      clubId: club.id,
      userId: member.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  console.log('Added members to club');

  // Create a sample cohort
  const marketRef = 'polymarket:election-2024';
  let predictionRound = await prisma.predictionRound.findFirst({
    where: {
      clubId: club.id,
      marketRef,
    },
  });

  if (!predictionRound) {
    predictionRound = await prisma.predictionRound.create({
      data: {
        clubId: club.id,
        marketRef,
        marketTitle: 'Who will win the 2024 US Presidential Election?',
        stakeTotal: '1000000000', // 1000 USDC (6 decimals)
        status: 'COMMITTED',
      },
    });
  }

  console.log('Created prediction round:', predictionRound.id);

  // Add cohort members
  await prisma.predictionRoundMember.upsert({
    where: {
      predictionRoundId_userId: {
        predictionRoundId: predictionRound.id,
        userId: manager.id,
      },
    },
    update: {},
    create: {
      predictionRoundId: predictionRound.id,
      userId: manager.id,
      commitAmount: '500000000', // 500 USDC
      payoutAmount: '0',
      pnlAmount: '0',
    },
  });

  await prisma.predictionRoundMember.upsert({
    where: {
      predictionRoundId_userId: {
        predictionRoundId: predictionRound.id,
        userId: member.id,
      },
    },
    update: {},
    create: {
      predictionRoundId: predictionRound.id,
      userId: member.id,
      commitAmount: '500000000', // 500 USDC
      payoutAmount: '0',
      pnlAmount: '0',
    },
  });

  console.log('Added cohort members');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
