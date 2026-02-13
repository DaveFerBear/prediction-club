import { z } from 'zod';

/**
 * Shared environment schema for all apps
 */
export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
});

/**
 * Web app environment schema
 */
export const webEnvSchema = sharedEnvSchema.extend({
  // App session
  APP_SESSION_SECRET: z.string().min(32),
  TURNKEY_ORGANIZATION_ID: z.string().optional(),
  TURNKEY_API_PUBLIC_KEY: z.string().optional(),
  TURNKEY_API_PRIVATE_KEY: z.string().optional(),
  TURNKEY_API_BASE_URL: z.string().url().optional(),

  // Chain config
  NEXT_PUBLIC_DEFAULT_CHAIN_ID: z.coerce.number().default(80002),
  NEXT_PUBLIC_POLYGON_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_AMOY_RPC_URL: z.string().url().optional(),

  // WalletConnect
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),

  // Public URLs
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Validate environment variables
 */
export function validateEnv<T extends z.ZodSchema>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid environment variables');
  }

  return result.data;
}
