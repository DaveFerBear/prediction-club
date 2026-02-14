export type AgentProvider = 'openai' | 'anthropic' | 'google';

export interface ClubAgentConfig {
  provider: AgentProvider;
  model: string;
  persona: string;
  queryPool: string[];
  maxMarketsPerQuery: number;
  temperature: number;
}

export const DEFAULT_QUERY_POOL = [
  'bitcoin',
  'ethereum',
  'election',
  'macro',
  'fed',
  'stocks',
  'sports',
  'technology',
  'geopolitics',
  'ai',
];

const DEFAULT_CLUB_AGENT_CONFIG: ClubAgentConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  persona:
    'You are a pragmatic prediction market analyst. Pick one market and one outcome with clear, risk-aware reasoning.',
  queryPool: DEFAULT_QUERY_POOL,
  maxMarketsPerQuery: 100,
  temperature: 0.2,
};

const CLUB_AGENT_CONFIG_OVERRIDES: Record<string, Partial<ClubAgentConfig>> = {
  // Example:
  // 'my-openai-club': { provider: 'openai', model: 'gpt-4o-mini' },
  // 'my-anthropic-club': { provider: 'anthropic', model: 'claude-3-5-sonnet-latest' },
  // 'my-gemini-club': { provider: 'google', model: 'gemini-1.5-pro' },
};

export function getClubAgentConfig(
  clubSlug: string,
  overrides: Partial<ClubAgentConfig> = {}
): ClubAgentConfig {
  const clubOverrides = CLUB_AGENT_CONFIG_OVERRIDES[clubSlug] ?? {};
  return {
    ...DEFAULT_CLUB_AGENT_CONFIG,
    ...clubOverrides,
    ...overrides,
    queryPool:
      overrides.queryPool ??
      clubOverrides.queryPool ??
      DEFAULT_CLUB_AGENT_CONFIG.queryPool,
  };
}
