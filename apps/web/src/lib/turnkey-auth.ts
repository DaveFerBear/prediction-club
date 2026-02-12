import { createHash } from 'crypto';
import { z } from 'zod';

const hexAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const turnkeyDirectLoginSchema = z.object({
  turnkeySubOrgId: z.string().min(1),
  turnkeyEndUserId: z.string().min(1),
  walletAddress: z.string().regex(hexAddressPattern).optional(),
  email: z.string().email().optional(),
});

const turnkeyOidcLoginSchema = z.object({
  oidcToken: z.string().min(1),
  providerName: z.literal('Google').default('Google'),
});

export type TurnkeyIdentity = z.infer<typeof turnkeyDirectLoginSchema>;
export type TurnkeyLoginInput =
  | { mode: 'direct'; identity: TurnkeyIdentity }
  | { mode: 'oidc'; oidcToken: string; providerName: 'Google' };

export function parseTurnkeyLoginInput(payload: unknown): TurnkeyLoginInput {
  const oidcParsed = turnkeyOidcLoginSchema.safeParse(payload);
  if (oidcParsed.success) {
    return {
      mode: 'oidc',
      oidcToken: oidcParsed.data.oidcToken.trim(),
      providerName: oidcParsed.data.providerName,
    };
  }

  const parsed = turnkeyDirectLoginSchema.parse(payload);
  return {
    mode: 'direct',
    identity: {
      ...parsed,
      turnkeySubOrgId: parsed.turnkeySubOrgId.trim(),
      turnkeyEndUserId: parsed.turnkeyEndUserId.trim(),
      walletAddress: parsed.walletAddress?.toLowerCase(),
      email: parsed.email?.trim().toLowerCase(),
    },
  };
}

/**
 * Compatibility fallback while legacy code still expects a walletAddress.
 * Deterministically derives a pseudo EVM address from Turnkey identity.
 */
export function deriveCompatibilityWalletAddress(input: {
  turnkeySubOrgId: string;
  turnkeyEndUserId: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.turnkeySubOrgId}:${input.turnkeyEndUserId}`)
    .digest('hex');
  return `0x${digest.slice(0, 40)}`;
}
