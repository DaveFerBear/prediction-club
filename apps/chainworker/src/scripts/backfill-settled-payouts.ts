import { prisma } from '@prediction-club/db';

async function main() {
  throw new Error(
    'backfill-settled-payouts is deprecated. Use redeem-historical-payouts to repair payouts from on-chain redemptions.',
  );
}

main()
  .catch((error) => {
    console.error('[chainworker] Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
