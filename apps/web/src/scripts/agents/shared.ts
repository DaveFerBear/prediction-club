import fs from 'fs';
import path from 'path';
import { config as loadDotEnv } from 'dotenv';
import { parseUnits } from 'viem';
import type { PrismaClient } from '@prediction-club/db';

const walletAddressPattern = /^0x[a-fA-F0-9]{40}$/;

export type CliArgs = Record<string, string | boolean>;

export type ScriptUser = {
  id: string;
  email: string | null;
  walletAddress: string;
  turnkeySubOrgId: string | null;
};

export const AGENT_OWNER_EMAIL = 'predictionclubagent@gmail.com';

export function loadEnvForScripts() {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '../.env'),
    path.resolve(cwd, '../../.env'),
    path.resolve(cwd, 'apps/web/.env'),
    path.resolve(cwd, '../web/.env'),
  ];

  const loaded = new Set<string>();
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (loaded.has(candidate)) continue;
    loadDotEnv({ path: candidate });
    loaded.add(candidate);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
}

export function parseCliArgs(argv = process.argv.slice(2)): CliArgs {
  const args: CliArgs = {};

  for (const rawArg of argv) {
    if (!rawArg.startsWith('--')) continue;
    const body = rawArg.slice(2);
    const equalsIdx = body.indexOf('=');
    if (equalsIdx < 0) {
      args[body] = true;
      continue;
    }
    const key = body.slice(0, equalsIdx);
    const value = body.slice(equalsIdx + 1);
    args[key] = value;
  }

  return args;
}

export function getRequiredStringArg(args: CliArgs, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required argument --${key}=...`);
  }
  return value.trim();
}

export function getOptionalStringArg(args: CliArgs, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getBooleanArg(args: CliArgs, key: string, fallback: boolean): boolean {
  const value = args[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

export function getPositiveIntArg(
  args: CliArgs,
  key: string,
  fallback: number,
  opts: { min?: number; max?: number } = {}
) {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid integer argument --${key}`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Argument --${key} must be a positive integer`);
  }
  if (opts.min !== undefined && parsed < opts.min) {
    throw new Error(`Argument --${key} must be >= ${opts.min}`);
  }
  if (opts.max !== undefined && parsed > opts.max) {
    throw new Error(`Argument --${key} must be <= ${opts.max}`);
  }
  return parsed;
}

export function parseUsdcToBaseUnits(amount: string, minBaseUnits = 1_000_000n) {
  let parsed: bigint;
  try {
    parsed = parseUnits(amount.trim(), 6);
  } catch {
    throw new Error(`Invalid USDC amount: ${amount}`);
  }

  if (parsed < minBaseUnits) {
    throw new Error('Amount must be at least 1.00 USDC');
  }

  return parsed;
}

export function isWalletAddress(value: string) {
  return walletAddressPattern.test(value);
}

export async function resolveOwnerUser(prisma: PrismaClient, ownerArg: string): Promise<ScriptUser> {
  const trimmed = ownerArg.trim();
  const lower = trimmed.toLowerCase();

  const user = trimmed.includes('@')
    ? await prisma.user.findFirst({
        where: {
          email: {
            equals: lower,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          email: true,
          walletAddress: true,
          turnkeySubOrgId: true,
        },
      })
    : isWalletAddress(trimmed)
      ? await prisma.user.findUnique({
          where: { walletAddress: lower },
          select: {
            id: true,
            email: true,
            walletAddress: true,
            turnkeySubOrgId: true,
          },
        })
      : null;

  if (!user) {
    throw new Error(`Could not find user for owner "${ownerArg}"`);
  }

  return user;
}

export function logJsonSummary(label: string, payload: unknown) {
  console.log(`${label}:`);
  console.log(JSON.stringify(payload, null, 2));
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
