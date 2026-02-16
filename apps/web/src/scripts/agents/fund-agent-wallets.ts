import { erc20Abi, formatUnits, http, parseUnits, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon, polygonAmoy } from 'viem/chains';
import type { ClubWallet, PrismaClient } from '@prediction-club/db';
import { loadAgentsConfig, type AgentDefinition } from './agent-config';
import { AGENT_TREASURY_MIN_USDC, AGENT_TREASURY_TARGET_USDC } from './agent-funding-config';
import {
  AGENT_OWNER_EMAIL,
  isWalletAddress,
  loadEnvForScripts,
  logJsonSummary,
  resolveOwnerUser,
} from './shared';

const privateKeyPattern = /^0x[a-fA-F0-9]{64}$/;

type OwnedClub = {
  id: string;
  slug: string;
  name: string;
  members: Array<{ userId: string; role: string; status: string }>;
};

type FundingResult = {
  agentId: string;
  clubSlug: string;
  clubId?: string;
  safeAddress?: string;
  amountFundedUsdc?: string;
  txHash?: string;
  status: 'FUNDED' | 'SKIPPED' | 'FAILED';
  reason?: string;
  error?: string;
};

function getDatabaseHostHint() {
  const url = process.env.DATABASE_URL;
  if (!url) return 'DATABASE_URL is not set';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || 'unknown-host';
    const port = parsed.port || '(default)';
    return `${host}:${port}`;
  } catch {
    return 'DATABASE_URL is not a valid URL';
  }
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  const normalized = unquoted.startsWith('0x') || unquoted.startsWith('0X')
    ? `0x${unquoted.slice(2)}`
    : `0x${unquoted}`;

  if (!privateKeyPattern.test(normalized)) {
    throw new Error('AGENT_TAP_PRIVATE_KEY must be a 0x-prefixed 32-byte hex private key');
  }
  return normalized.toLowerCase() as `0x${string}`;
}

function resolveWalletTransport(chainId: number) {
  if (chainId === polygon.id) {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.NEXT_PUBLIC_POLYGON_RPC_URL;
    return { chain: polygon, transport: rpcUrl ? http(rpcUrl) : http() };
  }
  if (chainId === polygonAmoy.id) {
    const rpcUrl = process.env.AMOY_RPC_URL || process.env.NEXT_PUBLIC_AMOY_RPC_URL;
    return { chain: polygonAmoy, transport: rpcUrl ? http(rpcUrl) : http() };
  }
  throw new Error(`Unsupported chain id ${chainId}`);
}

async function getOrCreateClubBySlug(input: {
  prisma: PrismaClient;
  ClubController: {
    create: (
      values: {
        name: string;
        slug?: string;
        description?: string;
        isPublic?: boolean;
      },
      userId: string
    ) => Promise<{ id: string; slug: string }>;
  };
  agent: AgentDefinition;
  ownerUserId: string;
}): Promise<OwnedClub> {
  const existing = await input.prisma.club.findUnique({
    where: { slug: input.agent.clubSlug },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        select: {
          userId: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const clubName = input.agent.clubName ?? input.agent.name;
  await input.ClubController.create(
    {
      name: clubName,
      slug: input.agent.clubSlug,
      description: input.agent.clubDescription ?? `Autonomous club for agent ${input.agent.id}`,
      isPublic: input.agent.clubIsPublic ?? false,
    },
    input.ownerUserId
  );

  const created = await input.prisma.club.findUnique({
    where: { slug: input.agent.clubSlug },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        select: {
          userId: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!created) {
    throw new Error(`Failed to create club for slug "${input.agent.clubSlug}"`);
  }
  return created;
}

function assertOwnerAdmin(club: OwnedClub, ownerUserId: string) {
  const isAdmin = club.members.some(
    (member) => member.userId === ownerUserId && member.role === 'ADMIN' && member.status === 'ACTIVE'
  );
  if (!isAdmin) {
    throw new Error(`Owner ${AGENT_OWNER_EMAIL} is not an active admin for club ${club.slug}`);
  }
}

function assertReadyWallet(wallet: ClubWallet) {
  if (wallet.provisioningStatus !== 'READY') {
    throw new Error(
      `Club wallet is not ready. status=${wallet.provisioningStatus} error=${wallet.provisioningError ?? 'none'}`
    );
  }
  if (!wallet.polymarketSafeAddress || !isWalletAddress(wallet.polymarketSafeAddress)) {
    throw new Error('Club wallet missing a valid Polymarket safe address');
  }
  return wallet.polymarketSafeAddress as `0x${string}`;
}

async function main() {
  loadEnvForScripts();

  const chainId = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || 137);
  const [{ prisma }, { ClubController, ClubWalletController, LedgerController }, polymarketLib] =
    await Promise.all([import('@prediction-club/db'), import('../../controllers'), import('@/lib/polymarket')]);
  const { createPolymarketPublicClient, getUsdcTokenAddress } = polymarketLib;
  const agents = loadAgentsConfig().agents.filter((agent) => agent.enabled);
  if (agents.length === 0) {
    throw new Error('No enabled agents found in agents.json');
  }

  const tapPrivateKeyRaw = process.env.AGENT_TAP_PRIVATE_KEY;
  if (!tapPrivateKeyRaw) {
    throw new Error('AGENT_TAP_PRIVATE_KEY is required');
  }
  const tapPrivateKey = normalizePrivateKey(tapPrivateKeyRaw);
  const tapAccount = privateKeyToAccount(tapPrivateKey);
  const usdcAddress = getUsdcTokenAddress(chainId);
  if (!usdcAddress) {
    throw new Error('USDC token address is not configured for this chain');
  }

  const minUsdc = parseUnits(AGENT_TREASURY_MIN_USDC, 6);
  const targetUsdc = parseUnits(AGENT_TREASURY_TARGET_USDC, 6);
  if (targetUsdc <= minUsdc) {
    throw new Error(
      `Invalid treasury tap policy: target (${AGENT_TREASURY_TARGET_USDC}) must be greater than min (${AGENT_TREASURY_MIN_USDC})`
    );
  }

  const publicClient = createPolymarketPublicClient(chainId);
  const walletClient = createWalletClient({
    account: tapAccount,
    ...resolveWalletTransport(chainId),
  });
  const owner = await resolveOwnerUser(prisma, AGENT_OWNER_EMAIL);
  const results: FundingResult[] = [];

  for (const agent of agents) {
    try {
      const club = await getOrCreateClubBySlug({
        prisma,
        ClubController,
        agent,
        ownerUserId: owner.id,
      });
      assertOwnerAdmin(club, owner.id);

      const clubWallet = await ClubWalletController.ensureClubWallet({
        userId: owner.id,
        clubId: club.id,
      });
      const safeAddress = assertReadyWallet(clubWallet);

      const balanceBefore = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress],
      });

      if (balanceBefore >= minUsdc) {
        results.push({
          agentId: agent.id,
          clubSlug: club.slug,
          clubId: club.id,
          safeAddress,
          status: 'SKIPPED',
          reason: `balance_above_min (${formatUnits(balanceBefore, 6)} USDC.e)`,
        });
        continue;
      }

      const amountToFund = targetUsdc - balanceBefore;
      if (amountToFund <= 0n) {
        results.push({
          agentId: agent.id,
          clubSlug: club.slug,
          clubId: club.id,
          safeAddress,
          status: 'SKIPPED',
          reason: 'target_already_reached',
        });
        continue;
      }

      const txHash = await walletClient.writeContract({
        account: tapAccount,
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [safeAddress, amountToFund],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== 'success') {
        throw new Error(`Funding transaction failed: ${txHash}`);
      }

      await LedgerController.recordDeposit({
        safeAddress,
        clubId: club.id,
        userId: owner.id,
        amount: amountToFund.toString(),
        txHash,
        metadata: {
          source: 'agent-treasury-tap',
          chainId,
          agentId: agent.id,
        },
      });

      const balanceAfter = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [safeAddress],
      });

      results.push({
        agentId: agent.id,
        clubSlug: club.slug,
        clubId: club.id,
        safeAddress,
        amountFundedUsdc: formatUnits(amountToFund, 6),
        txHash,
        status: 'FUNDED',
        reason: `before=${formatUnits(balanceBefore, 6)} after=${formatUnits(balanceAfter, 6)}`,
      });
    } catch (error) {
      results.push({
        agentId: agent.id,
        clubSlug: agent.clubSlug,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const fundedCount = results.filter((result) => result.status === 'FUNDED').length;
  const skippedCount = results.filter((result) => result.status === 'SKIPPED').length;
  const failedCount = results.filter((result) => result.status === 'FAILED').length;

  console.log(
    `[agent:fund] Completed agents=${agents.length} funded=${fundedCount} skipped=${skippedCount} failed=${failedCount}`
  );
  for (const result of results) {
    if (result.status === 'FUNDED') {
      console.log(
        `[agent:fund] FUNDED agent=${result.agentId} club=${result.clubSlug} amount=${result.amountFundedUsdc} tx=${result.txHash}`
      );
      continue;
    }
    if (result.status === 'SKIPPED') {
      console.log(
        `[agent:fund] SKIP agent=${result.agentId} club=${result.clubSlug} reason=${result.reason ?? 'none'}`
      );
      continue;
    }
    console.log(
      `[agent:fund] FAIL agent=${result.agentId} club=${result.clubSlug} error=${result.error ?? 'unknown'}`
    );
  }

  logJsonSummary('[agent:fund] Summary', {
    chainId,
    usdcAddress,
    owner: {
      id: owner.id,
      email: owner.email,
      walletAddress: owner.walletAddress,
    },
    policy: {
      minUsdc: AGENT_TREASURY_MIN_USDC,
      targetUsdc: AGENT_TREASURY_TARGET_USDC,
    },
    agentsProcessed: agents.length,
    fundedCount,
    skippedCount,
    failedCount,
    results,
  });

  await prisma.$disconnect();
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (code === 'ECONNREFUSED') {
    console.error(
      `[agent:fund] Database connection refused. Check DATABASE_URL and env precedence. Current host: ${getDatabaseHostHint()}`
    );
  }
  console.error('[agent:fund] Fatal error:', error);
  process.exitCode = 1;
});
