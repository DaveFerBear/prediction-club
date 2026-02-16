import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { createPrivateKey, createSign } from 'crypto';
import { utils } from 'ethers';
import type {
  RoundMember,
  MemberPayout,
  MemberOrder,
  MarketResolution as SettledMarketResolution,
} from '../types/chainworker-db';

const POLYMARKET_CLOB_URL = process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com';
const POLYMARKET_CHAIN_ID = Number(process.env.POLYMARKET_CHAIN_ID ?? 137);
const TURNKEY_BASE_URL = process.env.TURNKEY_API_BASE_URL || 'https://api.turnkey.com';
const TURNKEY_API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY;
const TURNKEY_API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY;
const POLY_BUILDER_API_KEY = process.env.POLY_BUILDER_API_KEY || '';
const POLY_BUILDER_SECRET = process.env.POLY_BUILDER_SECRET || '';
const POLY_BUILDER_PASSPHRASE = process.env.POLY_BUILDER_PASSPHRASE || '';
const DEBUG_TURNKEY = process.env.CHAINWORKER_DEBUG_TURNKEY === 'true';
const TURNKEY_SIGN_ACTIVITY_TYPE = 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2';
const POLYMARKET_SAFE_SIGNATURE_TYPE = 2; // SignatureType.POLY_GNOSIS_SAFE

type UserCreds = {
  key: string;
  secret: string;
  passphrase: string;
};

type TypedDataDomain = {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: string;
};

const P256_MODULUS = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const P256_A = P256_MODULUS - 3n;
const P256_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');

function redact(value: string, keep = 4) {
  if (!value) return '<empty>';
  if (value.length <= keep * 2) return `${'*'.repeat(value.length)}`;
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function describeCreds(creds: UserCreds) {
  return {
    key: redact(creds.key),
    secret: redact(creds.secret),
    passphrase: redact(creds.passphrase),
    keyLength: creds.key.length,
    secretLength: creds.secret.length,
    passphraseLength: creds.passphrase.length,
  };
}

export type MarketResolution = { isResolved: boolean } & SettledMarketResolution;

const CONDITION_ID_PATTERN = /0x[a-fA-F0-9]{64}/;
const privateKeyIdByWalletKey = new Map<string, Promise<string>>();

function bufferToBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(value: string): string {
  return bufferToBase64Url(Buffer.from(value, 'utf8'));
}

function hexToBuffer(value: string): Buffer {
  const sanitized = value.startsWith('0x') ? value.slice(2) : value;
  if (sanitized.length === 0 || sanitized.length % 2 !== 0 || /[^a-fA-F0-9]/u.test(sanitized)) {
    throw new Error('Invalid hex value');
  }
  return Buffer.from(sanitized, 'hex');
}

function bigintTo32Bytes(value: bigint): Buffer {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let current = base % modulus;
  let exp = exponent;

  while (exp > 0n) {
    if ((exp & 1n) === 1n) {
      result = (result * current) % modulus;
    }
    current = (current * current) % modulus;
    exp >>= 1n;
  }

  return result;
}

function modSqrt(value: bigint, modulus: bigint): bigint {
  const q = (modulus + 1n) >> 2n;
  const root = modPow(value % modulus, q, modulus);
  if ((root * root) % modulus !== value % modulus) {
    throw new Error('Failed to compute modular square root');
  }
  return root;
}

function decodeCompressedP256PublicKey(compressedPublicKeyHex: string): { x: Buffer; y: Buffer } {
  const point = hexToBuffer(compressedPublicKeyHex);
  if (point.length !== 33) {
    throw new Error('Expected compressed P-256 public key');
  }

  const prefix = point[0];
  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error('Invalid compressed public key prefix');
  }

  const x = BigInt(`0x${point.subarray(1).toString('hex')}`);
  const rhs = ((x * x + P256_A) * x + P256_B) % P256_MODULUS;
  let y = modSqrt(rhs, P256_MODULUS);
  const shouldBeOdd = prefix === 0x03;
  const isOdd = (y & 1n) === 1n;
  if (isOdd !== shouldBeOdd) {
    y = (P256_MODULUS - y) % P256_MODULUS;
  }

  return {
    x: bigintTo32Bytes(x),
    y: bigintTo32Bytes(y),
  };
}

function getTurnkeySigningKey() {
  if (!TURNKEY_API_PRIVATE_KEY || !TURNKEY_API_PUBLIC_KEY) {
    throw new Error('TURNKEY_API_PUBLIC_KEY and TURNKEY_API_PRIVATE_KEY are required');
  }

  if (TURNKEY_API_PRIVATE_KEY.includes('BEGIN')) {
    return createPrivateKey(TURNKEY_API_PRIVATE_KEY);
  }

  const privateKey = hexToBuffer(TURNKEY_API_PRIVATE_KEY);
  const { x, y } = decodeCompressedP256PublicKey(TURNKEY_API_PUBLIC_KEY);
  const jwk: import('crypto').JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bufferToBase64Url(x),
    y: bufferToBase64Url(y),
    d: bufferToBase64Url(privateKey),
    ext: true,
    key_ops: ['sign'],
  };
  return createPrivateKey({ format: 'jwk', key: jwk });
}

function createTurnkeyStamp(payload: string): string {
  if (!TURNKEY_API_PUBLIC_KEY) {
    throw new Error('TURNKEY_API_PUBLIC_KEY is not configured');
  }

  const signer = createSign('sha256');
  signer.update(payload);
  signer.end();
  const signature = signer
    .sign({ key: getTurnkeySigningKey(), dsaEncoding: 'der' })
    .toString('hex');
  return stringToBase64Url(
    JSON.stringify({
      publicKey: TURNKEY_API_PUBLIC_KEY,
      scheme: 'SIGNATURE_SCHEME_TK_API_P256',
      signature,
    })
  );
}

function getErrorMessage(responseBody: unknown): string {
  if (!responseBody || typeof responseBody !== 'object') {
    return 'Unknown Turnkey error';
  }

  const candidate = responseBody as Record<string, unknown>;
  if (typeof candidate.error === 'string') return candidate.error;
  if (typeof candidate.message === 'string') return candidate.message;
  if (candidate.error && typeof candidate.error === 'object') {
    const nested = candidate.error as Record<string, unknown>;
    if (typeof nested.message === 'string') return nested.message;
  }
  return 'Unknown Turnkey error';
}

async function turnkeyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const payload = JSON.stringify(body);
  const response = await fetch(`${TURNKEY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Stamp': createTurnkeyStamp(payload),
    },
    body: payload,
  });

  const json = (await response.json()) as unknown;
  if (!response.ok) {
    const message = getErrorMessage(json);
    const details = (() => {
      try {
        return JSON.stringify(json);
      } catch {
        return '[unserializable-response]';
      }
    })();
    throw new Error(`Turnkey request failed: ${message} :: ${details}`);
  }
  return json as T;
}

function deepFindStringValue(input: unknown, keyName: string): string | null {
  if (!input || typeof input !== 'object') return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = deepFindStringValue(item, keyName);
      if (found) return found;
    }
    return null;
  }

  const record = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === keyName && typeof value === 'string' && value.length > 0) {
      return value;
    }
    const nested = deepFindStringValue(value, keyName);
    if (nested) return nested;
  }

  return null;
}

function deepFindObjectValue(input: unknown, keyName: string): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = deepFindObjectValue(item, keyName);
      if (found) return found;
    }
    return null;
  }

  const record = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === keyName && value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    const nested = deepFindObjectValue(value, keyName);
    if (nested) return nested;
  }

  return null;
}

function deepFindNumericValue(input: unknown, keyName: string): number | null {
  if (!input || typeof input !== 'object') return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = deepFindNumericValue(item, keyName);
      if (found !== null) return found;
    }
    return null;
  }

  const record = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key === keyName && typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (key === keyName && typeof value === 'string' && value.length > 0) {
      const parsed =
        value.startsWith('0x') || value.startsWith('0X') ? parseInt(value, 16) : Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    const nested = deepFindNumericValue(value, keyName);
    if (nested !== null) return nested;
  }

  return null;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function collectObjects(input: unknown): Record<string, unknown>[] {
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => collectObjects(item));
  }

  const record = input as Record<string, unknown>;
  const nested = Object.values(record).flatMap((value) => collectObjects(value));
  return [record, ...nested];
}

function collectAddresses(input: unknown): string[] {
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => collectAddresses(item));
  }

  const record = input as Record<string, unknown>;
  const found: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key === 'address' && typeof value === 'string') {
      found.push(normalizeAddress(value));
      continue;
    }
    if (key === 'addresses') {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string') {
            found.push(normalizeAddress(entry));
          } else if (entry && typeof entry === 'object') {
            const nestedAddress = (entry as Record<string, unknown>).address;
            if (typeof nestedAddress === 'string') {
              found.push(normalizeAddress(nestedAddress));
            }
          }
        }
      }
      continue;
    }
    found.push(...collectAddresses(value));
  }

  return found;
}

function findPrivateKeyIdFromWalletAccounts(input: {
  response: unknown;
  walletAddress: string;
  walletAccountId: string;
}): string | null {
  const normalizedWalletAddress = normalizeAddress(input.walletAddress);
  for (const record of collectObjects(input.response)) {
    const privateKeyId = typeof record.privateKeyId === 'string' ? record.privateKeyId.trim() : '';
    if (!privateKeyId) continue;

    const recordWalletAccountId =
      typeof record.walletAccountId === 'string' ? record.walletAccountId.trim() : '';
    if (recordWalletAccountId && recordWalletAccountId === input.walletAccountId) {
      return privateKeyId;
    }

    const addresses = collectAddresses(record);
    if (addresses.includes(normalizedWalletAddress)) {
      return privateKeyId;
    }
  }
  return null;
}

function findPrivateKeyIdFromPrivateKeys(input: {
  response: unknown;
  walletAddress: string;
  walletAccountId: string;
}): string | null {
  const normalizedWalletAddress = normalizeAddress(input.walletAddress);
  for (const record of collectObjects(input.response)) {
    const privateKeyId = typeof record.privateKeyId === 'string' ? record.privateKeyId.trim() : '';
    if (!privateKeyId) continue;

    const recordWalletAccountId =
      typeof record.walletAccountId === 'string' ? record.walletAccountId.trim() : '';
    if (recordWalletAccountId && recordWalletAccountId === input.walletAccountId) {
      return privateKeyId;
    }

    const addresses = collectAddresses(record);
    if (addresses.includes(normalizedWalletAddress)) {
      return privateKeyId;
    }
  }
  return null;
}

async function resolvePrivateKeyId(input: {
  organizationId: string;
  walletAddress: string;
  walletAccountId: string;
}): Promise<string> {
  const cacheKey = `${input.organizationId}:${normalizeAddress(input.walletAddress)}`;
  const cached = privateKeyIdByWalletKey.get(cacheKey);
  if (cached) return cached;

  const resolver = (async () => {
    const walletAccountsResponse = await turnkeyPost<Record<string, unknown>>(
      '/public/v1/query/list_wallet_accounts',
      {
        organizationId: input.organizationId,
      }
    );
    const fromWalletAccounts = findPrivateKeyIdFromWalletAccounts({
      response: walletAccountsResponse,
      walletAddress: input.walletAddress,
      walletAccountId: input.walletAccountId,
    });
    if (fromWalletAccounts) return fromWalletAccounts;

    const privateKeysResponse = await turnkeyPost<Record<string, unknown>>(
      '/public/v1/query/list_private_keys',
      {
        organizationId: input.organizationId,
      }
    );
    const fromPrivateKeys = findPrivateKeyIdFromPrivateKeys({
      response: privateKeysResponse,
      walletAddress: input.walletAddress,
      walletAccountId: input.walletAccountId,
    });
    if (fromPrivateKeys) return fromPrivateKeys;

    if (DEBUG_TURNKEY) {
      console.error('[chainworker] Turnkey private key resolution miss', {
        organizationId: input.organizationId,
        walletAddress: input.walletAddress,
        walletAccountId: input.walletAccountId,
        walletAccountsTopLevelKeys: Object.keys(walletAccountsResponse),
        privateKeysTopLevelKeys: Object.keys(privateKeysResponse),
        walletAccountsSample: JSON.stringify(walletAccountsResponse).slice(0, 1200),
        privateKeysSample: JSON.stringify(privateKeysResponse).slice(0, 1200),
      });
    }

    throw new Error(
      `Could not resolve privateKeyId for wallet ${input.walletAddress} in organization ${input.organizationId}`
    );
  })();

  privateKeyIdByWalletKey.set(cacheKey, resolver);
  try {
    return await resolver;
  } catch (error) {
    privateKeyIdByWalletKey.delete(cacheKey);
    throw error;
  }
}

function normalizeHex(value: string, expectedLength?: number): string {
  const raw = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/u.test(raw)) {
    throw new Error('Invalid hex value in Turnkey signature');
  }
  const normalized = expectedLength ? raw.padStart(expectedLength, '0') : raw;
  return `0x${normalized.toLowerCase()}`;
}

function extractTurnkeySignature(response: unknown): string {
  const signRawPayloadResult = deepFindObjectValue(response, 'signRawPayloadResult');
  if (signRawPayloadResult) {
    const rRaw = deepFindStringValue(signRawPayloadResult, 'r');
    const sRaw = deepFindStringValue(signRawPayloadResult, 's');
    const vRaw = deepFindNumericValue(signRawPayloadResult, 'v');

    if (rRaw && sRaw && vRaw !== null) {
      const r = normalizeHex(rRaw, 64);
      const s = normalizeHex(sRaw, 64);
      const v = vRaw >= 27 ? vRaw : vRaw + 27;
      return utils.joinSignature({ r, s, v });
    }
  }

  const signature = deepFindStringValue(response, 'signature');
  if (signature && /^(0x)?[0-9a-fA-F]{130}$/u.test(signature)) {
    return normalizeHex(signature);
  }
  const rRaw = deepFindStringValue(response, 'r');
  const sRaw = deepFindStringValue(response, 's');
  const vRaw = deepFindNumericValue(response, 'v');

  if (!rRaw || !sRaw || vRaw === null) {
    throw new Error('Turnkey sign_raw_payload response missing signature fields');
  }

  const r = normalizeHex(rRaw, 64);
  const s = normalizeHex(sRaw, 64);
  const v = vRaw >= 27 ? vRaw : vRaw + 27;
  return utils.joinSignature({ r, s, v });
}

async function signDigestWithTurnkey(input: {
  organizationId: string;
  signWithCandidates: string[];
  digestHex: string;
}): Promise<string> {
  const payloadHex = input.digestHex.startsWith('0x') ? input.digestHex.slice(2) : input.digestHex;
  let lastError: unknown = null;
  for (const signWith of input.signWithCandidates) {
    const paramVariants: Array<Record<string, unknown>> = [
      {
        signWith,
        payload: payloadHex,
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: 'HASH_FUNCTION_NO_OP',
      },
      {
        signWith,
        payload: `0x${payloadHex}`,
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: 'HASH_FUNCTION_NO_OP',
      },
    ];

    for (const parameters of paramVariants) {
      try {
        const response = await turnkeyPost<Record<string, unknown>>(
          '/public/v1/submit/sign_raw_payload',
          {
            type: TURNKEY_SIGN_ACTIVITY_TYPE,
            timestampMs: Date.now().toString(),
            organizationId: input.organizationId,
            parameters,
          }
        );
        return extractTurnkeySignature(response);
      } catch (error) {
        lastError = error;
        if (DEBUG_TURNKEY) {
          console.warn('[chainworker] Turnkey sign attempt failed', {
            organizationId: input.organizationId,
            signWith,
            has0xPayload:
              typeof parameters.payload === 'string' && parameters.payload.startsWith('0x'),
            encodingField: 'encoding' in parameters ? 'encoding' : 'payloadEncoding',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  throw lastError ?? new Error('Turnkey sign_raw_payload failed');
}

class TurnkeySigner {
  constructor(
    private readonly organizationId: string,
    private readonly walletAccountId: string,
    private readonly walletAddress: string
  ) {}

  async getAddress(): Promise<string> {
    return this.walletAddress;
  }

  async _signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string> {
    const digest = utils._TypedDataEncoder.hash(domain, types, value);
    const checksummedAddress = (() => {
      try {
        return utils.getAddress(this.walletAddress);
      } catch {
        return this.walletAddress;
      }
    })();
    const signWithCandidates = Array.from(
      new Set([checksummedAddress, this.walletAddress, this.walletAccountId])
    );
    return signDigestWithTurnkey({
      organizationId: this.organizationId,
      signWithCandidates,
      digestHex: digest,
    });
  }
}

function parseResolvedAt(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getMarketTokens(market: Record<string, unknown>): Record<string, unknown>[] {
  const tokens = market.tokens;
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(
    (token): token is Record<string, unknown> =>
      token !== null && typeof token === 'object' && !Array.isArray(token)
  );
}

function getWinnerToken(market: Record<string, unknown>): Record<string, unknown> | null {
  const tokens = getMarketTokens(market);
  for (const token of tokens) {
    if (parseBoolean(token.winner) === true) return token;
  }
  return null;
}

function getResolvedOutcome(market: Record<string, unknown>): string | null {
  const winnerToken = getWinnerToken(market);
  const winnerOutcome = winnerToken?.outcome;
  if (typeof winnerOutcome === 'string' && winnerOutcome.trim().length > 0) {
    return winnerOutcome.trim();
  }

  const fallback =
    (market.outcome as string | undefined) ??
    (market.result as string | undefined) ??
    (market.winningOutcome as string | undefined) ??
    null;

  return typeof fallback === 'string' && fallback.trim().length > 0 ? fallback.trim() : null;
}

function isMarketResolved(market: Record<string, unknown>) {
  const status = typeof market.status === 'string' ? market.status.toLowerCase() : '';
  const resolvedFlag = Boolean(
    market.resolved ?? market.isResolved ?? market.settled ?? market.finalized
  );
  if (
    resolvedFlag ||
    status === 'resolved' ||
    status === 'settled' ||
    status === 'final' ||
    status === 'closed'
  ) {
    return true;
  }

  if (getWinnerToken(market)) return true;

  const closed = parseBoolean(market.closed);
  const acceptingOrders = parseBoolean(market.accepting_orders ?? market.acceptingOrders);
  if (closed === true && acceptingOrders === false) return true;

  if (closed === true) {
    const hasPriceOneToken = getMarketTokens(market).some((token) => {
      const price = parseNumber(token.price);
      return price !== null && price >= 0.999;
    });
    if (hasPriceOneToken) return true;
  }

  return false;
}

export class PolymarketController {
  static missingMemberFields(member: RoundMember): string[] {
    const missing: string[] = [];
    if (!member.clubWallet) {
      missing.push('clubWallet');
      return missing;
    }
    if (member.clubWallet.isDisabled) {
      missing.push('clubWalletDisabled');
      return missing;
    }
    if (!member.user.turnkeySubOrgId) missing.push('turnkeySubOrgId');
    if (member.clubWallet.provisioningStatus !== 'READY') {
      missing.push(`clubWalletProvisioningStatus:${member.clubWallet.provisioningStatus}`);
    }
    if (!member.clubWallet.turnkeyWalletAccountId) missing.push('turnkeyWalletAccountId');
    if (!member.clubWallet.turnkeyWalletAddress) missing.push('turnkeyWalletAddress');
    if (!member.clubWallet.polymarketSafeAddress) missing.push('polymarketSafeAddress');
    if (!member.clubWallet.polymarketApiKeyId) missing.push('polymarketApiKeyId');
    if (!member.clubWallet.polymarketApiSecret) missing.push('polymarketApiSecret');
    if (!member.clubWallet.polymarketApiPassphrase) missing.push('polymarketApiPassphrase');
    return missing;
  }

  static buildClient(params: { signer: TurnkeySigner; creds?: UserCreds; funderAddress: string }) {
    if (!POLY_BUILDER_API_KEY) throw new Error('POLY_BUILDER_API_KEY is not set.');
    if (!POLY_BUILDER_SECRET) throw new Error('POLY_BUILDER_SECRET is not set.');
    if (!POLY_BUILDER_PASSPHRASE) throw new Error('POLY_BUILDER_PASSPHRASE is not set.');

    const builderConfig = new BuilderConfig({
      localBuilderCreds: {
        key: POLY_BUILDER_API_KEY,
        secret: POLY_BUILDER_SECRET,
        passphrase: POLY_BUILDER_PASSPHRASE,
      },
    });

    return new ClobClient(
      POLYMARKET_CLOB_URL,
      POLYMARKET_CHAIN_ID,
      params.signer as never,
      params.creds,
      POLYMARKET_SAFE_SIGNATURE_TYPE,
      params.funderAddress,
      undefined,
      undefined,
      builderConfig,
      () => params.signer as never
    );
  }

  static buildTurnkeySigner(member: RoundMember): TurnkeySigner {
    const clubWallet = member.clubWallet;
    if (!clubWallet || clubWallet.isDisabled) {
      throw new Error(`Missing active club wallet for user ${member.userId}`);
    }
    if (!member.user.turnkeySubOrgId) {
      throw new Error(`Missing Turnkey sub-org for user ${member.userId}`);
    }

    return new TurnkeySigner(
      member.user.turnkeySubOrgId,
      clubWallet.turnkeyWalletAccountId,
      clubWallet.turnkeyWalletAddress
    );
  }

  static getStoredPolymarketCreds(member: RoundMember): UserCreds {
    const clubWallet = member.clubWallet;
    if (
      !clubWallet?.polymarketApiKeyId ||
      !clubWallet?.polymarketApiSecret ||
      !clubWallet?.polymarketApiPassphrase
    ) {
      throw new Error(`Missing stored Polymarket creds for user ${member.userId}`);
    }

    return {
      key: clubWallet.polymarketApiKeyId,
      secret: clubWallet.polymarketApiSecret,
      passphrase: clubWallet.polymarketApiPassphrase,
    };
  }

  static getFunderAddress(member: RoundMember): string {
    const safeAddress = member.clubWallet?.polymarketSafeAddress;
    if (!safeAddress) {
      throw new Error(`Missing Polymarket Safe address for user ${member.userId}`);
    }
    return safeAddress;
  }

  static async fetchMarketResolution(conditionId: string): Promise<MarketResolution> {
    if (!CONDITION_ID_PATTERN.test(conditionId)) {
      return { isResolved: false, outcome: null, resolvedAt: null };
    }

    const clobClient = new ClobClient(POLYMARKET_CLOB_URL, POLYMARKET_CHAIN_ID);
    const market = (await clobClient.getMarket(conditionId)) as Record<string, unknown>;
    const resolved = isMarketResolved(market);

    if (!resolved) {
      const tokens = getMarketTokens(market);
      const winnerTokenCount = tokens.filter((token) => parseBoolean(token.winner) === true).length;
      console.log('[chainworker] Market unresolved snapshot', {
        conditionId,
        status: typeof market.status === 'string' ? market.status : null,
        closed: parseBoolean(market.closed),
        acceptingOrders: parseBoolean(market.accepting_orders ?? market.acceptingOrders),
        winnerTokenCount,
        tokenCount: tokens.length,
      });
      return { isResolved: false, outcome: null, resolvedAt: null };
    }

    const outcome = getResolvedOutcome(market);
    const resolvedAt =
      parseResolvedAt(market.resolvedAt) ??
      parseResolvedAt(market.resolved_at) ??
      parseResolvedAt(market.resolutionDate) ??
      parseResolvedAt(market.end_date_iso) ??
      parseResolvedAt(market.endDateIso) ??
      parseResolvedAt(market.endDate) ??
      null;

    return {
      isResolved: true,
      outcome,
      resolvedAt,
    };
  }

  static computeMemberPayouts(members: RoundMember[]): MemberPayout[] | null {
    if (members.length === 0) return null;

    return members.map((member) => ({
      userId: member.userId,
      payoutAmount: member.payoutAmount,
      pnlAmount:
        member.pnlAmount !== '0'
          ? member.pnlAmount
          : (BigInt(member.payoutAmount) - BigInt(member.commitAmount)).toString(),
    }));
  }

  static async placeMarketOrder(params: {
    tokenId: string;
    commitAmount: string;
    member: RoundMember;
  }): Promise<MemberOrder> {
    const { tokenId, commitAmount, member } = params;
    const clubWallet = member.clubWallet;
    if (!clubWallet || clubWallet.isDisabled) {
      throw new Error(`Missing active club wallet for user ${member.userId}`);
    }
    const missing = this.missingMemberFields(member);
    if (missing.length > 0) {
      throw new Error(
        `Missing required Polymarket fields for user ${member.userId}: ${missing.join(', ')}`
      );
    }

    const amount = Number(commitAmount) / 1_000_000;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid commit amount for user ${member.userId}`);
    }

    const signer = this.buildTurnkeySigner(member);
    const creds = this.getStoredPolymarketCreds(member);
    const funderAddress = this.getFunderAddress(member);
    console.log('[chainworker] Polymarket creds snapshot', {
      userId: member.userId,
      turnkeySubOrgId: member.user.turnkeySubOrgId,
      walletAddress: clubWallet.turnkeyWalletAddress,
      safeAddress: funderAddress,
      ...describeCreds(creds),
    });
    const clobClient = this.buildClient({
      signer,
      creds,
      funderAddress,
    });
    const response = await clobClient.createAndPostMarketOrder(
      {
        tokenID: tokenId,
        side: Side.BUY,
        amount,
      },
      undefined,
      OrderType.FOK
    );

    const responseError =
      (typeof response?.error === 'string' ? response.error : null) ??
      (typeof response?.data?.error === 'string' ? response.data.error : null) ??
      null;

    const orderId = response?.orderID;
    if (!orderId) {
      if (responseError) {
        throw new Error(`Order placement rejected for user ${member.userId}: ${responseError}`);
      }
      throw new Error(
        `Missing order ID for user ${member.userId}. Response: ${JSON.stringify(response).slice(0, 500)}`
      );
    }

    let orderDetails:
      | {
          status?: string;
          side?: string;
          price?: string;
          original_size?: string;
          size_matched?: string;
          order_type?: string;
          outcome?: string;
          created_at?: number;
        }
      | undefined;

    try {
      orderDetails = await clobClient.getOrder(orderId);
    } catch (error) {
      console.warn(`[chainworker] Failed to fetch order details for ${orderId}:`, error);
    }

    return {
      orderId,
      orderStatus: orderDetails?.status ?? response?.status ?? null,
      orderSide: orderDetails?.side ?? null,
      orderPrice: orderDetails?.price ?? null,
      orderSize: orderDetails?.original_size ?? null,
      orderSizeMatched: orderDetails?.size_matched ?? null,
      orderType: orderDetails?.order_type ?? null,
      orderOutcome: orderDetails?.outcome ?? null,
      orderCreatedAt: orderDetails?.created_at ? new Date(orderDetails.created_at * 1000) : null,
      orderTxHashes: response?.transactionsHashes ?? null,
      orderMakingAmount: response?.makingAmount ?? null,
      orderTakingAmount: response?.takingAmount ?? null,
    };
  }
}
