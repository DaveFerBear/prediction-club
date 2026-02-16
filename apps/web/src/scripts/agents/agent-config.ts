import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export type AgentProvider = 'openai' | 'anthropic' | 'google';

export type AgentDefinition = {
  id: string;
  name: string;
  enabled: boolean;
  clubSlug: string;
  clubName?: string;
  clubDescription?: string;
  clubIsPublic?: boolean;
  provider: AgentProvider;
  model: string;
  persona: string;
  strategy: {
    queryPool: string[];
    maxMarketsPerQuery: number;
    maxHoursToResolution?: number;
    temperature: number;
    defaultCount: number;
    defaultAmountUsdc: string;
  };
};

const providerSchema = z.union([z.literal('openai'), z.literal('anthropic'), z.literal('google')]);

const agentSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  enabled: z.boolean().default(true),
  clubSlug: z.string().trim().min(1),
  clubName: z.string().trim().min(1).optional(),
  clubDescription: z.string().trim().min(1).optional(),
  clubIsPublic: z.boolean().optional(),
  provider: providerSchema,
  model: z.string().trim().min(1),
  persona: z.string().trim().min(1),
  strategy: z.object({
    queryPool: z.array(z.string().trim().min(1)).min(1),
    maxMarketsPerQuery: z.number().int().min(1).max(200),
    maxHoursToResolution: z.number().int().min(1).max(24 * 365).optional(),
    temperature: z.number().min(0).max(2),
    defaultCount: z.number().int().min(1).max(100),
    defaultAmountUsdc: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,6})?$/),
  }),
});

const agentsFileSchema = z
  .object({
    version: z.literal(1),
    agents: z.array(agentSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const seenIds = new Set<string>();
    for (const agent of value.agents) {
      if (seenIds.has(agent.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agents'],
          message: `Duplicate agent id "${agent.id}"`,
        });
      }
      seenIds.add(agent.id);
    }
  });

function findAgentsConfigPath() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'apps/web/src/scripts/agents/agents.json'),
    path.resolve(cwd, 'src/scripts/agents/agents.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not find agents.json. Checked: ${candidates.join(', ')}`);
}

export function loadAgentsConfig(): { version: 1; agents: AgentDefinition[] } {
  const configPath = findAgentsConfigPath();
  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const result = agentsFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid agent config at ${configPath}: ${JSON.stringify(result.error.format(), null, 2)}`
    );
  }

  return result.data as { version: 1; agents: AgentDefinition[] };
}

export function listAgentIds() {
  return loadAgentsConfig().agents.map((agent) => agent.id);
}

export function getAgentById(agentId: string): AgentDefinition | null {
  const normalized = agentId.trim();
  if (!normalized) return null;
  return loadAgentsConfig().agents.find((agent) => agent.id === normalized) ?? null;
}
