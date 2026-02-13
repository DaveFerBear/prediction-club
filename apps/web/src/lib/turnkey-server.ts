import { createPrivateKey, createSign } from 'crypto';

const TURNKEY_BASE_URL = process.env.TURNKEY_API_BASE_URL || 'https://api.turnkey.com';
const TURNKEY_ORGANIZATION_ID = process.env.TURNKEY_ORGANIZATION_ID;
const TURNKEY_API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY;
const TURNKEY_API_PRIVATE_KEY = process.env.TURNKEY_API_PRIVATE_KEY;

const P256_MODULUS = BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff');
const P256_A = P256_MODULUS - 3n;
const P256_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');

type TurnkeyUser = {
  userId: string;
  userName?: string;
  userEmail?: string;
};

type TurnkeyWalletAccount = {
  walletAccountId: string;
  walletId: string;
  address: string;
};

type OidcIdentity = {
  turnkeySubOrgId: string;
  turnkeyEndUserId: string;
  walletAddress?: string;
  email?: string;
};

const TURNKEY_SIGN_ACTIVITY_TYPE = 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2';

class TurnkeyRequestError extends Error {
  constructor(
    message: string,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'TurnkeyRequestError';
  }
}

function assertTurnkeyConfig() {
  if (!TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID is required');
  }
  if (!TURNKEY_API_PUBLIC_KEY) {
    throw new Error('TURNKEY_API_PUBLIC_KEY is required');
  }
  if (!TURNKEY_API_PRIVATE_KEY) {
    throw new Error('TURNKEY_API_PRIVATE_KEY is required');
  }
}

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

function getSigningKey() {
  if (!TURNKEY_API_PRIVATE_KEY || !TURNKEY_API_PUBLIC_KEY) {
    throw new Error('Turnkey API keys are not configured');
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

function createStamp(payload: string): string {
  if (!TURNKEY_API_PUBLIC_KEY) {
    throw new Error('TURNKEY_API_PUBLIC_KEY is not configured');
  }

  const signer = createSign('sha256');
  signer.update(payload);
  signer.end();
  const signature = signer.sign({ key: getSigningKey(), dsaEncoding: 'der' }).toString('hex');
  const stamp = {
    publicKey: TURNKEY_API_PUBLIC_KEY,
    scheme: 'SIGNATURE_SCHEME_TK_API_P256',
    signature,
  };
  return stringToBase64Url(JSON.stringify(stamp));
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

function extractOrganizationMismatch(message: string): { target?: string; voters?: string } | null {
  const match = message.match(
    /request is targeting organization \(([^)]+)\), but voters are in organization \(([^)]+)\)/i
  );
  if (!match) return null;
  return {
    target: match[1],
    voters: match[2],
  };
}

function isOrganizationMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /organization mismatch/i.test(error.message);
}

async function turnkeyPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  assertTurnkeyConfig();
  const payload = JSON.stringify(body);
  const response = await fetch(`${TURNKEY_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Stamp': createStamp(payload),
    },
    body: payload,
  });

  const json = (await response.json()) as unknown;
  if (!response.ok) {
    const message = getErrorMessage(json);
    const mismatch = extractOrganizationMismatch(message);
    if (mismatch) {
      throw new TurnkeyRequestError(
        `${message}. Check TURNKEY_ORGANIZATION_ID and TURNKEY_API_* key pair alignment.`,
        json
      );
    }
    throw new TurnkeyRequestError(message, json);
  }
  return json as T;
}

function nowTimestampMs(): string {
  return Date.now().toString();
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
    if (key === keyName) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    const nested = deepFindNumericValue(value, keyName);
    if (nested !== null) return nested;
  }

  return null;
}

function deepFindStringArray(input: unknown, keyName: string): string[] {
  if (!input || typeof input !== 'object') return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => deepFindStringArray(item, keyName));
  }

  const record = input as Record<string, unknown>;
  const found: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === keyName && Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          found.push(entry);
        } else if (entry && typeof entry === 'object') {
          const nestedString = deepFindStringValue(entry, 'address');
          if (nestedString) {
            found.push(nestedString);
          }
        }
      }
    }
    found.push(...deepFindStringArray(value, keyName));
  }
  return found;
}

function normalizeHex(value: string, expectedLength?: number): `0x${string}` {
  const raw = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/u.test(raw)) {
    throw new Error('Invalid hex value in Turnkey signature');
  }
  const normalized = expectedLength ? raw.padStart(expectedLength, '0') : raw;
  return `0x${normalized.toLowerCase()}`;
}

function extractTurnkeySignature(response: unknown): `0x${string}` {
  const signRawPayloadResult = deepFindObjectValue(response, 'signRawPayloadResult');
  if (signRawPayloadResult) {
    const rRaw = deepFindStringValue(signRawPayloadResult, 'r');
    const sRaw = deepFindStringValue(signRawPayloadResult, 's');
    const vRaw = deepFindNumericValue(signRawPayloadResult, 'v');

    if (rRaw && sRaw && vRaw !== null) {
      const r = normalizeHex(rRaw, 64);
      const s = normalizeHex(sRaw, 64);
      const v = vRaw >= 27 ? vRaw : vRaw + 27;
      const vHex = normalizeHex(v.toString(16), 2).slice(2);
      return `${r}${s.slice(2)}${vHex}` as `0x${string}`;
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
  const vHex = normalizeHex(v.toString(16), 2).slice(2);
  return `${r}${s.slice(2)}${vHex}` as `0x${string}`;
}

export async function signDigestWithTurnkey(input: {
  organizationId: string;
  signWithCandidates: string[];
  digestHex: string;
}): Promise<`0x${string}`> {
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
        const response = await turnkeyPost<Record<string, unknown>>('/public/v1/submit/sign_raw_payload', {
          type: TURNKEY_SIGN_ACTIVITY_TYPE,
          timestampMs: nowTimestampMs(),
          organizationId: input.organizationId,
          parameters,
        });
        return extractTurnkeySignature(response);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error('Turnkey sign_raw_payload failed');
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) {
    return {};
  }

  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSubOrgName(input: { name?: string; email?: string }): string {
  const fallback = 'Prediction Club User Sub-Org';
  const rawName = input.name?.trim();
  const emailLocal = input.email?.trim().toLowerCase().split('@')[0];

  if (rawName && emailLocal) {
    return `${rawName} (${emailLocal}) Sub-Org`;
  }
  if (rawName) {
    return `${rawName} Sub-Org`;
  }
  if (emailLocal) {
    return `${emailLocal} Sub-Org`;
  }
  return fallback;
}

async function listSubOrgIdsByOidcToken(oidcToken: string): Promise<string[]> {
  const response = await turnkeyPost<{ organizationIds?: string[] }>(
    '/public/v1/query/list_suborgs',
    {
      organizationId: TURNKEY_ORGANIZATION_ID,
      filterType: 'OIDC_TOKEN',
      filterValue: oidcToken,
    }
  );
  return response.organizationIds ?? [];
}

async function isOrganizationAccessible(organizationId: string): Promise<boolean> {
  try {
    await turnkeyPost('/public/v1/query/list_users', {
      organizationId,
    });
    return true;
  } catch (error) {
    if (isOrganizationMismatchError(error)) {
      return false;
    }
    throw error;
  }
}

async function createSubOrganizationWithGoogle(oidcToken: string): Promise<string> {
  const tokenPayload = parseJwtPayload(oidcToken);
  const email = typeof tokenPayload.email === 'string' ? tokenPayload.email : undefined;
  const name =
    typeof tokenPayload.name === 'string'
      ? tokenPayload.name
      : typeof tokenPayload.email === 'string'
        ? tokenPayload.email
        : 'Prediction Club User';
  const subOrgName = buildSubOrgName({ name, email });

  const response = await turnkeyPost<Record<string, unknown>>(
    '/public/v1/submit/create_sub_organization',
    {
      type: 'ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7',
      timestampMs: nowTimestampMs(),
      organizationId: TURNKEY_ORGANIZATION_ID,
      parameters: {
        subOrganizationName: subOrgName,
        rootUsers: [
          {
            userName: name,
            ...(email ? { userEmail: email } : {}),
            apiKeys: TURNKEY_API_PUBLIC_KEY
              ? [
                  {
                    apiKeyName: 'prediction-club-backend',
                    publicKey: TURNKEY_API_PUBLIC_KEY,
                    curveType: 'API_KEY_CURVE_P256',
                  },
                ]
              : [],
            authenticators: [],
            oauthProviders: [
              {
                providerName: 'Google',
                oidcToken,
              },
            ],
          },
        ],
        rootQuorumThreshold: 1,
        wallet: {
          walletName: 'Default Wallet',
          accounts: [
            {
              curve: 'CURVE_SECP256K1',
              pathFormat: 'PATH_FORMAT_BIP32',
              path: "m/44'/60'/0'/0/0",
              addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
            },
          ],
          mnemonicLength: 12,
        },
      },
    }
  );

  const subOrgId = deepFindStringValue(response, 'subOrganizationId');
  if (!subOrgId) {
    throw new Error('Turnkey did not return a sub-organization id');
  }
  return subOrgId;
}

async function listUsers(organizationId: string): Promise<TurnkeyUser[]> {
  const response = await turnkeyPost<{ users?: TurnkeyUser[] }>('/public/v1/query/list_users', {
    organizationId,
  });
  return response.users ?? [];
}

function selectEndUser(users: TurnkeyUser[], email?: string): TurnkeyUser | null {
  if (users.length === 0) return null;

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const emailMatch = users.find(
      (user) => user.userEmail?.trim().toLowerCase() === normalizedEmail
    );
    if (emailMatch) return emailMatch;
  }

  const emailBackedUser = users.find((user) => typeof user.userEmail === 'string');
  if (emailBackedUser) return emailBackedUser;

  return users[0];
}

async function listWalletAccounts(organizationId: string): Promise<TurnkeyWalletAccount[]> {
  const response = await turnkeyPost<{ accounts?: TurnkeyWalletAccount[] }>(
    '/public/v1/query/list_wallet_accounts',
    {
      organizationId,
    }
  );
  return response.accounts ?? [];
}

async function createWallet(organizationId: string, walletName: string) {
  const response = await turnkeyPost<Record<string, unknown>>('/public/v1/submit/create_wallet', {
    type: 'ACTIVITY_TYPE_CREATE_WALLET',
    timestampMs: nowTimestampMs(),
    organizationId,
    parameters: {
      walletName,
      accounts: [
        {
          curve: 'CURVE_SECP256K1',
          pathFormat: 'PATH_FORMAT_BIP32',
          path: "m/44'/60'/0'/0/0",
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
        },
      ],
      mnemonicLength: 12,
    },
  });

  const walletId = deepFindStringValue(response, 'walletId');
  const addresses = deepFindStringArray(response, 'addresses');
  const walletAddress = addresses[0];
  if (!walletId) {
    throw new Error('Turnkey create_wallet response missing wallet id');
  }
  if (!walletAddress) {
    throw new Error('Turnkey create_wallet response missing wallet address');
  }

  return { walletId, walletAddress };
}

export async function resolveTurnkeyIdentityFromOidcToken(
  oidcToken: string
): Promise<OidcIdentity> {
  const tokenPayload = parseJwtPayload(oidcToken);
  const email = typeof tokenPayload.email === 'string' ? tokenPayload.email : undefined;

  const existingSubOrgs = await listSubOrgIdsByOidcToken(oidcToken);
  let turnkeySubOrgId: string | null = null;
  for (const orgId of existingSubOrgs) {
    const accessible = await isOrganizationAccessible(orgId);
    if (accessible) {
      turnkeySubOrgId = orgId;
      break;
    }
  }

  if (!turnkeySubOrgId) {
    turnkeySubOrgId = await createSubOrganizationWithGoogle(oidcToken);
  }

  const users = await listUsers(turnkeySubOrgId);
  const selectedUser = selectEndUser(users, email);
  const turnkeyEndUserId = selectedUser?.userId;
  if (!turnkeyEndUserId) {
    throw new Error('Turnkey sub-organization does not contain a user');
  }

  let accounts = await listWalletAccounts(turnkeySubOrgId);
  if (accounts.length === 0) {
    await createWallet(turnkeySubOrgId, 'Default Wallet');
    accounts = await listWalletAccounts(turnkeySubOrgId);
  }
  const walletAddress = accounts[0]?.address;

  return {
    turnkeySubOrgId,
    turnkeyEndUserId,
    walletAddress,
    email,
  };
}

export async function createClubWalletForSubOrganization(input: {
  subOrganizationId: string;
  clubId: string;
}): Promise<{
  walletAddress: string;
  walletAccountId: string;
  walletId: string;
}> {
  const walletName = `Club ${input.clubId.slice(0, 8)} Wallet`;
  const { walletId, walletAddress } = await createWallet(input.subOrganizationId, walletName);
  const accounts = await listWalletAccounts(input.subOrganizationId);
  const walletAccount =
    accounts.find(
      (account) => account.walletId === walletId && account.address === walletAddress
    ) ??
    accounts.find((account) => account.walletId === walletId) ??
    null;

  if (!walletAccount) {
    throw new Error('Unable to find newly created wallet account');
  }

  return {
    walletAddress: walletAccount.address,
    walletAccountId: walletAccount.walletAccountId,
    walletId,
  };
}
