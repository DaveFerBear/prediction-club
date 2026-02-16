import { z } from 'zod';
import {
  AGENT_OWNER_EMAIL,
  daysAgo,
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
import { SHARED_AGENT_SYSTEM_PROMPT } from './agent-system-prompt';
import { getAgentById, listAgentIds, type AgentProvider } from './agent-config';

const conditionIdPattern = /^0x[a-fA-F0-9]{64}$/;

type MarketCandidate = {
  conditionId: string;
  marketId: string;
  marketSlug: string;
  marketTitle: string;
  outcomes: string[];
  outcomePrices: string[];
  clobTokenIds: string[];
  endDateIso: string | null;
  endDateMs: number | null;
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
  marketEndDate?: string;
  predictionRoundId?: string;
  reasoning?: string;
  success: boolean;
  skippedReason?: string;
  error?: string;
};

type RuntimeGenerateObject = (options: Record<string, unknown>) => Promise<{ object: unknown }>;

type RuntimeProviderFactory = (model: string) => unknown;

type RuntimeAiSdk = {
  generateObject: RuntimeGenerateObject;
  providerFactories: Record<AgentProvider, RuntimeProviderFactory>;
};

type AgentExecutionConfig = {
  provider: AgentProvider;
  model: string;
  persona: string;
  queryPool: string[];
  maxMarketsPerQuery: number;
  maxHoursToResolution: number | null;
  temperature: number;
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

function parseDateMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value <= 0) return null;
    const asMs = value < 1_000_000_000_000 ? value * 1000 : value;
    return Number.isFinite(asMs) ? asMs : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    const asMs = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    return Number.isFinite(asMs) ? asMs : null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toIsoString(valueMs: number | null): string | null {
  if (!valueMs || valueMs <= 0) return null;
  return new Date(valueMs).toISOString();
}

function parseCandidateEndDate(input: {
  market: Record<string, unknown>;
  eventEndDateMs: number | null;
}): number | null {
  return (
    parseDateMs(
      input.market.endDate ||
        input.market.end_date ||
        input.market.endTime ||
        input.market.end_time ||
        input.market.resolveBy ||
        input.market.resolve_by ||
        input.market.resolutionDate ||
        input.market.resolution_date ||
        input.market.marketEndDate ||
        input.market.market_end_date ||
        input.market.umaEndDate ||
        input.market.uma_end_date
    ) ?? input.eventEndDateMs
  );
}

function computeHoursToResolution(valueMs: number | null): number | null {
  if (!valueMs) return null;
  const deltaMs = valueMs - Date.now();
  return deltaMs / (1000 * 60 * 60);
}

function isWithinResolutionWindow(candidate: MarketCandidate, maxHours: number | null): boolean {
  if (!maxHours) return true;
  if (!candidate.endDateMs) return false;
  const hoursToResolution = computeHoursToResolution(candidate.endDateMs);
  if (hoursToResolution === null) return false;
  if (hoursToResolution <= 0) return false;
  return hoursToResolution <= maxHours;
}

async function enrichCandidateEndDates(input: {
  candidates: MarketCandidate[];
  marketEndDateCache: Map<string, number | null>;
  GammaController: {
    listMarkets: (input?: {
      limit?: number;
      offset?: number;
      active?: boolean;
      closed?: boolean;
      order?: string;
      slug?: string;
      id?: string | number;
    }) => Promise<unknown[]>;
  };
}) {
  const candidates = [...input.candidates];
  const unresolved = candidates.filter((candidate) => !candidate.endDateMs);
  if (unresolved.length === 0) {
    return candidates;
  }

  // Keep this bounded to avoid expensive per-iteration request storms.
  const lookupSlice = unresolved.slice(0, 40);

  await Promise.all(
    lookupSlice.map(async (candidate) => {
      if (input.marketEndDateCache.has(candidate.marketId)) return;

      try {
        const records = await input.GammaController.listMarkets({
          id: candidate.marketId,
          limit: 1,
        });
        const first = asObject(records[0]);
        if (!first) {
          input.marketEndDateCache.set(candidate.marketId, null);
          return;
        }
        const endDateMs = parseCandidateEndDate({
          market: first,
          eventEndDateMs: null,
        });
        input.marketEndDateCache.set(candidate.marketId, endDateMs);
      } catch {
        input.marketEndDateCache.set(candidate.marketId, null);
      }
    })
  );

  return candidates.map((candidate) => {
    if (candidate.endDateMs) return candidate;
    const fromCache = input.marketEndDateCache.get(candidate.marketId);
    if (!fromCache) return candidate;
    return {
      ...candidate,
      endDateMs: fromCache,
      endDateIso: toIsoString(fromCache),
    };
  });
}

async function fetchHorizonCandidatesForQuery(input: {
  query: string;
  maxMarkets: number;
  endDateMin: string;
  endDateMax: string;
  GammaController: {
    listMarkets: (input?: {
      limit?: number;
      offset?: number;
      active?: boolean;
      closed?: boolean;
      order?: string;
      slug?: string;
      id?: string | number;
      endDateMin?: string;
      endDateMax?: string;
    }) => Promise<unknown[]>;
  };
}): Promise<MarketCandidate[]> {
  const pageSize = Math.max(100, Math.min(200, input.maxMarkets));
  const maxPages = 12;
  const deduped = new Map<string, MarketCandidate>();

  for (let page = 0; page < maxPages; page += 1) {
    const pageResults = await input.GammaController.listMarkets({
      limit: pageSize,
      offset: page * pageSize,
      active: true,
      closed: false,
      endDateMin: input.endDateMin,
      endDateMax: input.endDateMax,
    });

    if (!Array.isArray(pageResults) || pageResults.length === 0) {
      break;
    }

    const candidates = extractMarketCandidatesFromMarketsResponse({
      query: input.query,
      response: pageResults,
      maxMarkets: input.maxMarkets,
    });

    for (const candidate of candidates) {
      if (!deduped.has(candidate.conditionId)) {
        deduped.set(candidate.conditionId, candidate);
      }
      if (deduped.size >= input.maxMarkets) {
        break;
      }
    }

    if (deduped.size >= input.maxMarkets || pageResults.length < pageSize) {
      break;
    }
  }

  return Array.from(deduped.values()).slice(0, input.maxMarkets);
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
  const normalized = normalizeOutcomeLabel(outcome);
  const normalizedWithoutPrice = normalizeOutcomeLabel(stripTrailingParenthetical(outcome));

  return candidate.outcomes.findIndex((entry) => {
    const normalizedEntry = normalizeOutcomeLabel(entry);
    return normalizedEntry === normalized || normalizedEntry === normalizedWithoutPrice;
  });
}

function formatCandidateForPrompt(candidate: MarketCandidate, rank: number) {
  const outcomeOptions = candidate.outcomes.map((outcome, idx) => ({
    label: outcome,
    price: candidate.outcomePrices[idx] ?? 'n/a',
  }));

  return {
    rank,
    conditionId: candidate.conditionId,
    marketId: candidate.marketId,
    marketSlug: candidate.marketSlug,
    marketTitle: candidate.marketTitle,
    endDateUtc: candidate.endDateIso,
    hoursToResolution: computeHoursToResolution(candidate.endDateMs),
    volume: candidate.volume,
    liquidity: candidate.liquidity,
    outcomeOptions,
  };
}

function stripTrailingParenthetical(value: string) {
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function normalizeOutcomeLabel(value: string) {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildMarketSearchText(market: Record<string, unknown>): string {
  const pieces: string[] = [];
  const add = (value: unknown) => {
    const parsed = asString(value);
    if (parsed) pieces.push(parsed.toLowerCase());
  };

  add(market.question);
  add(market.title);
  add(market.subtitle);
  add(market.description);
  add(market.slug);
  add(market.category);
  add(market.subcategory);
  add(market.groupItemTitle);
  add(market.group_item_title);

  const tags = asArray(market.tags);
  for (const tagValue of tags) {
    const tag = asObject(tagValue);
    if (!tag) continue;
    add(tag.name);
    add(tag.label);
    add(tag.slug);
  }

  return pieces.join(' ');
}

function marketMatchesQuery(market: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (q === 'sports') {
    const category = asString(market.category)?.toLowerCase();
    const subcategory = asString(market.subcategory)?.toLowerCase();
    const text = buildMarketSearchText(market);
    return (
      category === 'sports' ||
      subcategory === 'sports' ||
      text.includes('sports') ||
      text.includes('nba') ||
      text.includes('nfl') ||
      text.includes('mlb') ||
      text.includes('soccer') ||
      text.includes('fight')
    );
  }

  const text = buildMarketSearchText(market);
  if (text.includes(q)) return true;

  const tokens = q.split(/\s+/).filter((token) => token.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.some((token) => text.includes(token));
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
    const eventEndDateMs =
      parseDateMs(
        event.endDate ||
          event.end_date ||
          event.endTime ||
          event.end_time ||
          event.resolutionDate ||
          event.resolution_date
      ) ?? null;

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

      const marketId =
        asIdString(market.id) || asIdString(market.marketId) || asIdString(market.eventId);
      const marketSlug = asString(market.slug);
      if (!marketId || !marketSlug) continue;

      const outcomes = parseStringArray(market.outcomes);
      const outcomePrices = parseStringArray(market.outcomePrices);
      const clobTokenIds = parseStringArray(market.clobTokenIds || market.clob_token_ids);

      if (
        outcomes.length === 0 ||
        clobTokenIds.length === 0 ||
        outcomes.length !== clobTokenIds.length
      ) {
        continue;
      }

      const marketTitle = inferMarketTitle(market, eventTitle);
      const marketEndDateMs = parseCandidateEndDate({ market, eventEndDateMs });
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
        endDateIso: toIsoString(marketEndDateMs),
        endDateMs: marketEndDateMs,
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

function extractMarketCandidatesFromMarketsResponse(input: {
  query: string;
  response: unknown[];
  maxMarkets: number;
}): MarketCandidate[] {
  const flattened: MarketCandidate[] = [];

  for (const marketValue of input.response) {
    const market = asObject(marketValue);
    if (!market) continue;
    if (!marketMatchesQuery(market, input.query)) continue;

    const conditionId =
      normalizeConditionId(
        asString(market.conditionId) ||
          asString(market.condition_id) ||
          asString(market.conditionID)
      ) ?? null;
    if (!conditionId) continue;

    const marketId = asIdString(market.id) || asIdString(market.marketId);
    const marketSlug = asString(market.slug);
    if (!marketId || !marketSlug) continue;

    const outcomes = parseStringArray(market.outcomes);
    const outcomePrices = parseStringArray(market.outcomePrices);
    const clobTokenIds = parseStringArray(
      market.clobTokenIds || market.clob_token_ids || market.tokenIds || market.token_ids
    );
    if (
      outcomes.length === 0 ||
      clobTokenIds.length === 0 ||
      outcomes.length !== clobTokenIds.length
    ) {
      continue;
    }

    const marketTitle = inferMarketTitle(market, 'Untitled market');
    const marketEndDateMs = parseCandidateEndDate({ market, eventEndDateMs: null });
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
      endDateIso: toIsoString(marketEndDateMs),
      endDateMs: marketEndDateMs,
      volume,
      liquidity,
      query: input.query,
    });
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
  config: AgentExecutionConfig;
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
    reasoning: z.string().min(1).max(10_000),
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
    system: `${SHARED_AGENT_SYSTEM_PROMPT}\n\nPersona:\n${input.config.persona}`,
    prompt: [
      `Club: ${input.clubSlug}`,
      `Iteration: ${input.iteration + 1}`,
      'Candidate markets:',
      JSON.stringify(candidatePayload),
      'For targetOutcome, you must return the exact outcomeOptions.label text for your selected market.',
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

function parseMode(modeArg: string) {
  const normalized = modeArg.trim().toLowerCase();
  if (normalized === 'preview') return 'preview' as const;
  if (normalized === 'commit') return 'commit' as const;
  throw new Error(`Invalid mode "${modeArg}". Expected --mode=preview or --mode=commit.`);
}

async function getOrCreateClubBySlug(input: {
  ClubController: {
    getBySlug: (slug: string) => Promise<{
      id: string;
      slug: string;
      name: string;
      members: Array<{ userId: string; role: string; status: string }>;
    }>;
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
  agent: {
    id: string;
    name: string;
    clubSlug: string;
    clubName?: string;
    clubDescription?: string;
    clubIsPublic?: boolean;
  };
  ownerUserId: string;
}) {
  try {
    return await input.ClubController.getBySlug(input.agent.clubSlug);
  } catch (error) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    if (code !== 'NOT_FOUND') throw error;
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

  return input.ClubController.getBySlug(input.agent.clubSlug);
}

async function main() {
  loadEnvForScripts();
  const args = parseCliArgs();
  const agentId = getRequiredStringArg(args, 'agent');
  const mode = parseMode(getRequiredStringArg(args, 'mode'));

  if (args.club !== undefined) {
    throw new Error('Legacy flag --club is no longer supported. Use --agent=<id>.');
  }
  if (args['dry-run'] !== undefined) {
    throw new Error('Legacy flag --dry-run is no longer supported. Use --mode=preview.');
  }

  const providerArg = normalizeProvider(getOptionalStringArg(args, 'provider'));
  const modelArg = getOptionalStringArg(args, 'model');
  const personaArg = getOptionalStringArg(args, 'persona');

  const [
    { prisma },
    { ClubController, ClubWalletController, PredictionRoundController, GammaController },
  ] = await Promise.all([import('@prediction-club/db'), import('../../controllers')]);

  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Unknown agent "${agentId}". Available agents: ${listAgentIds().join(', ')}`);
  }
  if (!agent.enabled) {
    throw new Error(`Agent "${agentId}" is disabled in agents.json.`);
  }

  const count = getPositiveIntArg(args, 'count', agent.strategy.defaultCount, { min: 1, max: 100 });
  const amountUsdc = getOptionalStringArg(args, 'amount-usdc') ?? agent.strategy.defaultAmountUsdc;
  const commitAmount = parseUsdcToBaseUnits(amountUsdc).toString();

  const config: AgentExecutionConfig = {
    provider: providerArg ?? agent.provider,
    model: modelArg ?? agent.model,
    persona: personaArg ?? agent.persona,
    queryPool: agent.strategy.queryPool,
    maxMarketsPerQuery: agent.strategy.maxMarketsPerQuery,
    maxHoursToResolution: agent.strategy.maxHoursToResolution ?? null,
    temperature: agent.strategy.temperature,
  };

  const owner = await resolveOwnerUser(prisma, AGENT_OWNER_EMAIL);
  const club = await getOrCreateClubBySlug({
    ClubController,
    agent,
    ownerUserId: owner.id,
  });
  const isAdmin = club.members.some(
    (member: { userId: string; role: string; status: string }) =>
      member.userId === owner.id && member.role === 'ADMIN' && member.status === 'ACTIVE'
  );
  if (!isAdmin) {
    throw new Error(`Owner ${AGENT_OWNER_EMAIL} is not an active admin for club ${agent.clubSlug}`);
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

  const recentConditionIds = new Set(recentRounds.map((round) => round.conditionId.toLowerCase()));
  const activeConditionIds = new Set(activeRounds.map((round) => round.conditionId.toLowerCase()));

  const queryPool = config.queryPool;
  if (queryPool.length === 0) {
    throw new Error('queryPool cannot be empty');
  }
  const baseQueryOffset = (existingRoundCount + hashString(club.slug)) % queryPool.length;
  const horizonStartIso = config.maxHoursToResolution ? new Date().toISOString() : null;
  const horizonEndIso = config.maxHoursToResolution
    ? new Date(Date.now() + config.maxHoursToResolution * 60 * 60 * 1000).toISOString()
    : null;

  const results: AgentRunResult[] = [];
  const marketEndDateCache = new Map<string, number | null>();

  for (let iteration = 0; iteration < count; iteration += 1) {
    let selectedQuery = '';
    let selectedCandidates: MarketCandidate[] = [];
    let hadCandidatesBeforeHorizon = false;

    for (let attempt = 0; attempt < queryPool.length; attempt += 1) {
      const query = pickQuery(queryPool, baseQueryOffset, iteration, attempt);
      const baseCandidates = config.maxHoursToResolution
        ? await fetchHorizonCandidatesForQuery({
            query,
            maxMarkets: config.maxMarketsPerQuery,
            endDateMin: horizonStartIso ?? new Date().toISOString(),
            endDateMax:
              horizonEndIso ??
              new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            GammaController,
          })
        : extractMarketCandidatesFromSearchResponse({
            query,
            response: await GammaController.publicSearch({
              q: query,
              page: 1,
              limitPerType: config.maxMarketsPerQuery,
              keepClosedMarkets: 0,
            }),
            maxMarkets: config.maxMarketsPerQuery,
          });

      const dedupedByRoundState = baseCandidates.filter((candidate) => {
        const normalizedConditionId = candidate.conditionId.toLowerCase();
        if (recentConditionIds.has(normalizedConditionId)) return false;
        if (activeConditionIds.has(normalizedConditionId)) return false;
        return true;
      });

      hadCandidatesBeforeHorizon = hadCandidatesBeforeHorizon || dedupedByRoundState.length > 0;
      const withResolvedEndDates =
        !config.maxHoursToResolution && dedupedByRoundState.length > 0
          ? await enrichCandidateEndDates({
              candidates: dedupedByRoundState,
              marketEndDateCache,
              GammaController,
            })
          : dedupedByRoundState;
      const candidates = withResolvedEndDates.filter((candidate) =>
        isWithinResolutionWindow(candidate, config.maxHoursToResolution)
      );

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
        skippedReason: hadCandidatesBeforeHorizon
          ? 'NO_CANDIDATES_WITHIN_HORIZON'
          : 'NO_CANDIDATES',
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

      if (mode === 'preview') {
        results.push({
          iteration,
          query: selectedQuery,
          marketConditionId: pick.candidate.conditionId,
          marketSlug: pick.candidate.marketSlug,
          targetOutcome: pick.targetOutcome,
          targetTokenId: pick.targetTokenId,
          marketEndDate: pick.candidate.endDateIso ?? undefined,
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
        marketEndAt: pick.candidate.endDateIso ?? undefined,
        commentary: [
          '### Agent Commentary',
          '',
          pick.reasoning,
          '',
          `- Query: ${selectedQuery}`,
          `- Model: ${config.model}`,
        ].join('\n'),
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
        marketEndDate: pick.candidate.endDateIso ?? undefined,
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
    `[run-agent] Completed agent=${agent.id} club=${club.slug} count=${count} success=${successCount} skipped=${skippedCount} mode=${mode}`
  );
  for (const entry of results) {
    if (entry.success) {
      console.log(
        `[run-agent] OK iteration=${entry.iteration + 1} query=${entry.query} market=${entry.marketSlug} outcome=${entry.targetOutcome} round=${entry.predictionRoundId ?? 'preview'}`
      );
    } else {
      console.log(
        `[run-agent] SKIP iteration=${entry.iteration + 1} reason=${entry.skippedReason ?? 'UNKNOWN'} error=${entry.error ?? ''}`
      );
    }
  }

  logJsonSummary('[run-agent] Summary', {
    agent: {
      id: agent.id,
      name: agent.name,
      clubSlug: agent.clubSlug,
    },
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
    mode,
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
