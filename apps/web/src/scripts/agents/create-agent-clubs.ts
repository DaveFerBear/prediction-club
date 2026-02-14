import { slugify } from '@prediction-club/shared';
import {
  getBooleanArg,
  getPositiveIntArg,
  getRequiredStringArg,
  loadEnvForScripts,
  logJsonSummary,
  parseCliArgs,
  resolveOwnerUser,
} from './shared';

type CreateClubResult = {
  name: string;
  slug: string;
  clubId: string;
  walletId?: string;
  safeAddress?: string | null;
  turnkeyWalletAddress?: string;
  provisioningStatus?: string;
  success: boolean;
  error?: string;
};

async function createClubWithRetries(input: {
  ClubController: {
    create: (input: {
      name: string;
      slug?: string;
      description?: string;
      isPublic?: boolean;
    }, userId: string) => Promise<{ id: string; slug: string }>;
  };
  ownerUserId: string;
  name: string;
  baseSlug: string;
  description: string;
  isPublic: boolean;
}) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? input.baseSlug : `${input.baseSlug}-${attempt + 1}`;
    try {
      const club = await input.ClubController.create(
        {
          name: input.name,
          slug,
          description: input.description,
          isPublic: input.isPublic,
        },
        input.ownerUserId
      );
      return club;
    } catch (error) {
      lastError = error;
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
      if (code === 'SLUG_TAKEN') continue;
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to create club after retries');
}

async function main() {
  loadEnvForScripts();
  const args = parseCliArgs();
  const ownerArg = getRequiredStringArg(args, 'owner');
  const count = getPositiveIntArg(args, 'count', 1, { min: 1, max: 500 });
  const prefix = getRequiredStringArg(args, 'prefix');
  const isPublic = getBooleanArg(args, 'public', true);
  const startIndex = getPositiveIntArg(args, 'start-index', 1, { min: 1 });

  const [{ prisma }, { ClubController, ClubWalletController }] = await Promise.all([
    import('@prediction-club/db'),
    import('../../controllers'),
  ]);

  const owner = await resolveOwnerUser(prisma, ownerArg);
  if (!owner.turnkeySubOrgId) {
    throw new Error(
      `Owner ${owner.email ?? owner.walletAddress} is missing turnkeySubOrgId. Sign in via Turnkey first.`
    );
  }

  const results: CreateClubResult[] = [];

  for (let i = 0; i < count; i += 1) {
    const index = startIndex + i;
    const name = `${prefix} ${index}`.trim();
    const baseSlug = slugify(name);
    const description = `Autonomous club agent ${index}`;

    try {
      const club = await createClubWithRetries({
        ClubController,
        ownerUserId: owner.id,
        name,
        baseSlug,
        description,
        isPublic,
      });

      const wallet = await ClubWalletController.ensureClubWallet({
        userId: owner.id,
        clubId: club.id,
      });

      results.push({
        name,
        slug: club.slug,
        clubId: club.id,
        walletId: wallet.id,
        safeAddress: wallet.polymarketSafeAddress,
        turnkeyWalletAddress: wallet.turnkeyWalletAddress,
        provisioningStatus: wallet.provisioningStatus,
        success: wallet.provisioningStatus === 'READY',
        error:
          wallet.provisioningStatus === 'READY'
            ? undefined
            : wallet.provisioningError ?? `Provisioning status: ${wallet.provisioningStatus}`,
      });
    } catch (error) {
      results.push({
        name,
        slug: baseSlug,
        clubId: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const created = results.filter((entry) => entry.success);
  const failed = results.filter((entry) => !entry.success);

  console.log(
    `[create-agent-clubs] Completed. requested=${count}, created=${created.length}, failed=${failed.length}`
  );
  for (const item of results) {
    if (item.success) {
      console.log(
        `[create-agent-clubs] READY ${item.slug} safe=${item.safeAddress ?? '<missing-safe>'}`
      );
    } else {
      console.log(`[create-agent-clubs] FAILED ${item.name} error=${item.error ?? 'Unknown error'}`);
    }
  }

  logJsonSummary('[create-agent-clubs] Summary', {
    owner: {
      id: owner.id,
      email: owner.email,
      walletAddress: owner.walletAddress,
    },
    requested: count,
    createdCount: created.length,
    failedCount: failed.length,
    clubs: results,
  });

  await prisma.$disconnect();

  if (created.length === 0) {
    process.exitCode = 1;
  } else {
    console.log('[create-agent-clubs] Fund club safes manually with USDC.e before running agents.');
  }
}

void main().catch((error) => {
  console.error('[create-agent-clubs] Fatal error:', error);
  process.exitCode = 1;
});
