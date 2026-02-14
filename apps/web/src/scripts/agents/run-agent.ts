import { z } from 'zod';
import {
  daysAgo,
  getBooleanArg,
  getOptionalStringArg,
  getPositiveIntArg,
  getRequiredStringArg,
  isWalletAddress,
  loadEnvForScripts,
  logJsonSummary,
  parseCliArgs,
  parseUsdcToBaseUnits,
  resolveOwnerUser,
} from './shared';
import { getClubAgentConfig, type AgentProvider, type ClubAgentConfig } from './club-agent-config';

const conditionIdPattern = /^0x[a-fA-F0-9]{64}$/;

type MarketCandidate = {
  conditionId: string;
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  outcomes: string[];
  outcomePrices: string[];
  clobTokenIds: string[];
  volume: number;
  liquidity: number;
  query: string;
};

type AgentRunResult = {
  iteration: number;
  query?: string;
  marketConditionId?: string;
  marketSlug?: string;
  targetOutcome?: string;
  targetTokenId?: string;
  predictionRoundId?: string;
  reasoning?: string;
  success: boolean;
  skippedReason?: string;
  error?: string;
};

type RuntimeGenerateObject = (
  options: Record<string, unknown>
) => Promise<{ object: unknown }>;

type RuntimeProviderFactory = (model: string) => unknown;

type RuntimeAiSdk = {
  generateObject: RuntimeGenerateObject;
  providerFactories: Record<AgentProvider, RuntimeProviderFactory>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asIdString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

function normalizeConditionId(value: string | null) {
  if (!value || !conditionIdPattern.test(value)) return null;
  return value.toLowerCase();
}

function inferMarketTitle(record: Record<string, unknown>, fallback = 'Untitled market') {
  return (
    asString(record.question) ||
    asString(record.title) ||
    asString(record.subtitle) ||
    asString(record.slug) ||
    fallback
  );
}

function normalizeProvider(value: string | null): AgentProvider | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'anthropic') return 'anthropic';
  if (normalized === 'google' || normalized === 'gemini') return 'google';
  return null;
}

function assertProviderEnv(provider: AgentProvider) {
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for provider=openai');
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for provider=anthropic');
  }
  if (provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required for provider=google');
  }
}

async function importModuleDynamically(specifier: string): Promise<unknown> {
  return import(specifier);
}

async function loadAiSdkRuntime(): Promise<RuntimeAiSdk> {
  try {
    const [aiModuleRaw, openaiModuleRaw, anthropicModuleRaw, googleModuleRaw] = await Promise.all([
      importModuleDynamically('ai'),
      importModuleDynamically('@ai-sdk/openai'),
      importModuleDynamically('@ai-sdk/anthropic'),
      importModuleDynamically('@ai-sdk/google'),
    ]);
    const aiModule = aiModuleRaw as Record<string, unknown>;
    const openaiModule = openaiModuleRaw as Record<string, unknown>;
    const anthropicModule = anthropicModuleRaw as Record<string, unknown>;
    const googleModule = googleModuleRaw as Record<string, unknown>;

    return {
      generateObject: aiModule.generateObject as RuntimeGenerateObject,
      providerFactories: {
        openai: openaiModule.openai as RuntimeProviderFactory,
        anthropic: anthropicModule.anthropic as RuntimeProviderFactory,
        google: googleModule.google as RuntimeProviderFactory,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `AI SDK packages are required for run-agent. Install in web workspace: yarn workspace @prediction-club/web add ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google. Root cause: ${message}`
    );
  }
}

function resolveModel(input: {
  provider: AgentProvider;
  model: string;
  providerFactories: Record<AgentProvider, (model: string) => unknown>;
}) {
  if (input.provider === 'openai') return input.providerFactories.openai(input.model);
  if (input.provider === 'anthropic') return input.providerFactories.anthropic(input.model);
  return input.providerFactories.google(input.model);
}

function pickQuery(queryPool: string[], baseOffset: number, iteration: number, attempt: number) {
  const index = (baseOffset + iteration + attempt) % queryPool.length;
  return queryPool[index] ?? queryPool[0];
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getOutcomeIndex(candidate: MarketCandidate, outcome: string) {
  const normalized = outcome.trim().toLowerCase();
  return candidate.outcomes.findIndex((entry) => entry.trim().toLowerCase() === normalized);
}

function formatCandidateForPrompt(candidate: MarketCandidate, rank: number) {
  const outcomes = candidate.outcomes.map((outcome, idx) => {
    const price = candidate.outcomePrices[idx] ?? 'n/a';
    return `${outcome} (${price})`;
  });

  return {
    rank,
    conditionId: candidate.conditionId,
    marketId: candidate.marketId,
    marketSlug: candidate.marketSlug,
    marketTitle: candidate.marketTitle,
    volume: candidate.volume,
    liquidity: candidate.liquidity,
    outcomes,
  };
}

function extractMarketCandidatesFromSearchResponse(input: {
  query: string;
  response: unknown;
  maxMarkets: number;
}): MarketCandidate[] {
  const responseObject = asObject(input.response);
  const events = asArray(responseObject?.events);
  const flattened: MarketCandidate[] = [];

  for (const eventValue of events) {
    const event = asObject(eventValue);
    if (!event) continue;
    const markets = asArray(event.markets);
    const eventTitle = inferMarketTitle(event, 'Untitled event');

    for (const marketValue of markets) {
      const market = asObject(marketValue);
      if (!market) continue;

      const conditionId =
        normalizeConditionId(
          asString(market.conditionId) ||
            asString(market.condition_id) ||
            asString(market.conditionID)
        ) ?? null;
      if (!conditionId) continue;

      const marketId = asIdString(market.id) || asIdString(market.marketId) || asIdString(market.eventId);
      const marketSlug = asString(market.slug);
      if (!marketId || !marketSlug) continue;

      const outcomes = parseStringArray(market.outcomes);
      const outcomePrices = parseStringArray(market.outcomePrices);
      const clobTokenIds = parseStringArray(market.clobTokenIds || market.clob_token_ids);

      if (outcomes.length === 0 || clobTokenIds.length === 0 || outcomes.length !== clobTokenIds.length) {
        continue;
      }

      const marketTitle = inferMarketTitle(market, eventTitle);
      const volume = asNumber(market.volume24h) || asNumber(market.volume) || 0;
      const liquidity = asNumber(market.liquidity) || 0;
      const active = market.active !== false;
      const closed = market.closed === true;
      if (!active || closed) continue;

      flattened.push({
        conditionId,
        marketId,
        marketSlug,
        marketTitle,
        outcomes,
        outcomePrices,
        clobTokenIds,
        volume,
        liquidity,
        query: input.query,
      });
    }
  }

  const deduped = new Map<string, MarketCandidate>();
  for (const candidate of flattened) {
    if (!deduped.has(candidate.conditionId)) {
      deduped.set(candidate.conditionId, candidate);
    }
  }

  const sorted = Array.from(deduped.values()).sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return b.liquidity - a.liquidity;
  });

  return sorted.slice(0, input.maxMarkets);
}

async function chooseMarketAndOutcomeWithLlm(input: {
  config: ClubAgentConfig;
  clubSlug: string;
  iteration: number;
  candidates: MarketCandidate[];
  aiSdk: RuntimeAiSdk;
}) {
  const schema = z.object({
    conditionId: z.string(),
    marketId: z.string(),
    marketSlug: z.string(),
    targetOutcome: z.string(),
    reasoning: z.string().min(1).max(280),
  });

  const model = resolveModel({
    provider: input.config.provider,
    model: input.config.model,
    providerFactories: input.aiSdk.providerFactories,
  });
  const candidatePayload = input.candidates
    .slice(0, 100)
    .map((entry, idx) => formatCandidateForPrompt(entry, idx + 1));

  const result = await input.aiSdk.generateObject({
    model,
    schema,
    temperature: input.config.temperature,
    system: [
      'You are selecting one prediction market trade candidate.',
      'Choose exactly one market from the provided list and one valid outcome from that market.',
      'Output JSON only matching the schema.',
      'Do not invent IDs or outcomes.',
      `Persona: ${input.config.persona}`,
    ].join('\n'),
    prompt: [
      `Club: ${input.clubSlug}`,
      `Iteration: ${input.iteration + 1}`,
      'Candidate markets:',
      JSON.stringify(candidatePayload),
      'Choose one market/outcome you think has the best expected risk-adjusted edge.',
    ].join('\n'),
  });

  const pick = schema.parse(result.object);
  const candidate =
    input.candidates.find(
      (entry) => entry.conditionId.toLowerCase() === pick.conditionId.trim().toLowerCase()
    ) ??
    input.candidates.find(
      (entry) =>
        entry.marketId === pick.marketId.trim() &&
        entry.marketSlug.toLowerCase() === pick.marketSlug.trim().toLowerCase()
    ) ??
    null;

  if (!candidate) {
    throw new Error('LLM selected a market outside the candidate set');
  }

  const outcomeIndex = getOutcomeIndex(candidate, pick.targetOutcome);
  if (outcomeIndex < 0) {
    throw new Error('LLM selected an invalid outcome for the chosen market');
  }

  const targetOutcome = candidate.outcomes[outcomeIndex];
  const targetTokenId = candidate.clobTokenIds[outcomeIndex];
  if (!targetTokenId) {
    throw new Error('Missing token id for selected outcome');
  }

  return {
    candidate,
    targetOutcome,
    targetTokenId,
    reasoning: pick.reasoning.trim(),
  };
}

async function main() {
  loadEnvForScripts();
  const args = parseCliArgs();
  const clubSlug = getRequiredStringArg(args, 'club');
  const ownerArg = getRequiredStringArg(args, 'owner');
  const count = getPositiveIntArg(args, 'count', 1, { min: 1, max: 100 });
  const amountUsdc = getOptionalStringArg(args, 'amount-usdc') ?? '1.00';
  const dryRun = getBooleanArg(args, 'dry-run', false);

  const providerArg = normalizeProvider(getOptionalStringArg(args, 'provider'));
  const modelArg = getOptionalStringArg(args, 'model');
  const personaArg = getOptionalStringArg(args, 'persona');

  const commitAmount = parseUsdcToBaseUnits(amountUsdc).toString();

  const [{ prisma }, { ClubController, ClubWalletController, PredictionRoundController, GammaController }] =
    await Promise.all([import('@prediction-club/db'), import('../../controllers')]);

  const owner = await resolveOwnerUser(prisma, ownerArg);
  const club = await ClubController.getBySlug(clubSlug);
  const isAdmin = club.members.some(
    (member: { userId: string; role: string; status: string }) =>
      member.userId === owner.id && member.role === 'ADMIN' && member.status === 'ACTIVE'
  );
  if (!isAdmin) {
    throw new Error(`Owner ${ownerArg} is not an active admin for club ${clubSlug}`);
  }

  const wallet = await ClubWalletController.ensureClubWallet({
    userId: owner.id,
    clubId: club.id,
  });
  if (
    wallet.provisioningStatus !== 'READY' ||
    !wallet.polymarketSafeAddress ||
    !isWalletAddress(wallet.polymarketSafeAddress)
  ) {
    throw new Error(
      `Club wallet is not ready. status=${wallet.provisioningStatus} error=${wallet.provisioningError ?? 'none'}`
    );
  }

  const config = getClubAgentConfig(club.slug, {
    provider: providerArg ?? undefined,
    model: modelArg ?? undefined,
    persona: personaArg ?? undefined,
  });
  assertProviderEnv(config.provider);
  const aiSdk = await loadAiSdkRuntime();

  const sevenDaysAgo = daysAgo(7);
  const [recentRounds, activeRounds, existingRoundCount] = await Promise.all([
    prisma.predictionRound.findMany({
      where: {
        clubId: club.id,
        createdAt: { gte: sevenDaysAgo },
      },
      select: { conditionId: true },
    }),
    prisma.predictionRound.findMany({
      where: {
        clubId: club.id,
        status: { in: ['PENDING', 'COMMITTED'] },
      },
      select: { conditionId: true },
    }),
    prisma.predictionRound.count({
      where: { clubId: club.id },
    }),
  ]);

  const recentConditionIds = new Set(
    recentRounds.map((round) => round.conditionId.toLowerCase())
  );
  const activeConditionIds = new Set(
    activeRounds.map((round) => round.conditionId.toLowerCase())
  );

  const queryPool = config.queryPool;
  if (queryPool.length === 0) {
    throw new Error('queryPool cannot be empty');
  }
  const baseQueryOffset = (existingRoundCount + hashString(club.slug)) % queryPool.length;

  const results: AgentRunResult[] = [];

  for (let iteration = 0; iteration < count; iteration += 1) {
    let selectedQuery = '';
    let selectedCandidates: MarketCandidate[] = [];

    for (let attempt = 0; attempt < queryPool.length; attempt += 1) {
      const query = pickQuery(queryPool, baseQueryOffset, iteration, attempt);
      const searchResponse = await GammaController.publicSearch({
        q: query,
        page: 1,
        limitPerType: config.maxMarketsPerQuery,
        keepClosedMarkets: 0,
      });

      const candidates = extractMarketCandidatesFromSearchResponse({
        query,
        response: searchResponse,
        maxMarkets: config.maxMarketsPerQuery,
      }).filter((candidate) => {
        const normalizedConditionId = candidate.conditionId.toLowerCase();
        if (recentConditionIds.has(normalizedConditionId)) return false;
        if (activeConditionIds.has(normalizedConditionId)) return false;
        return true;
      });

      if (candidates.length > 0) {
        selectedQuery = query;
        selectedCandidates = candidates;
        break;
      }
    }

    if (selectedCandidates.length === 0) {
      results.push({
        iteration,
        success: false,
        skippedReason: 'NO_CANDIDATES',
      });
      continue;
    }

    try {
      const pick = await chooseMarketAndOutcomeWithLlm({
        config,
        clubSlug: club.slug,
        iteration,
        candidates: selectedCandidates,
        aiSdk,
      });

      if (dryRun) {
        results.push({
          iteration,
          query: selectedQuery,
          marketConditionId: pick.candidate.conditionId,
          marketSlug: pick.candidate.marketSlug,
          targetOutcome: pick.targetOutcome,
          targetTokenId: pick.targetTokenId,
          reasoning: pick.reasoning,
          success: true,
        });
        recentConditionIds.add(pick.candidate.conditionId.toLowerCase());
        activeConditionIds.add(pick.candidate.conditionId.toLowerCase());
        continue;
      }

      const round = await PredictionRoundController.createPredictionRound({
        clubSlug: club.slug,
        conditionId: pick.candidate.conditionId,
        marketId: pick.candidate.marketId,
        marketSlug: pick.candidate.marketSlug,
        marketTitle: pick.candidate.marketTitle,
        commitAmount,
        targetTokenId: pick.targetTokenId,
        targetOutcome: pick.targetOutcome,
        adminUserId: owner.id,
      });

      results.push({
        iteration,
        query: selectedQuery,
        marketConditionId: pick.candidate.conditionId,
        marketSlug: pick.candidate.marketSlug,
        targetOutcome: pick.targetOutcome,
        targetTokenId: pick.targetTokenId,
        predictionRoundId: round.id,
        reasoning: pick.reasoning,
        success: true,
      });
      recentConditionIds.add(pick.candidate.conditionId.toLowerCase());
      activeConditionIds.add(pick.candidate.conditionId.toLowerCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        iteration,
        query: selectedQuery,
        success: false,
        skippedReason: 'LLM_OR_CREATE_FAILED',
        error: message,
      });
    }
  }

  const successCount = results.filter((entry) => entry.success).length;
  const skippedCount = results.length - successCount;

  console.log(
    `[run-agent] Completed club=${club.slug} count=${count} success=${successCount} skipped=${skippedCount} dryRun=${dryRun}`
  );
  for (const entry of results) {
    if (entry.success) {
      console.log(
        `[run-agent] OK iteration=${entry.iteration + 1} query=${entry.query} market=${entry.marketSlug} outcome=${entry.targetOutcome} round=${entry.predictionRoundId ?? 'dry-run'}`
      );
    } else {
      console.log(
        `[run-agent] SKIP iteration=${entry.iteration + 1} reason=${entry.skippedReason ?? 'UNKNOWN'} error=${entry.error ?? ''}`
      );
    }
  }

  logJsonSummary('[run-agent] Summary', {
    club: {
      id: club.id,
      slug: club.slug,
      name: club.name,
    },
    owner: {
      id: owner.id,
      email: owner.email,
      walletAddress: owner.walletAddress,
    },
    config,
    count,
    amountUsdc,
    commitAmount,
    dryRun,
    successCount,
    skippedCount,
    results,
  });

  await prisma.$disconnect();

  if (successCount === 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error('[run-agent] Fatal error:', error);
  process.exitCode = 1;
});
