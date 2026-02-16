const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const chainworkerEnvPath = path.resolve(cwd, '.env');
const rootEnvPath = path.resolve(cwd, '../../.env');
const webEnvPath = path.resolve(cwd, '../web/.env');

function parseEnvFile(content) {
  const env = new Map();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env.set(key, stripWrappingQuotes(value));
  }

  return env;
}

function stripWrappingQuotes(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function readEnv(pathname) {
  if (!fs.existsSync(pathname)) return new Map();
  const content = fs.readFileSync(pathname, 'utf8');
  return parseEnvFile(content);
}

function writeEnv(pathname, env) {
  const orderedKeys = [
    'DATABASE_URL',
    'TURNKEY_API_PUBLIC_KEY',
    'TURNKEY_API_PRIVATE_KEY',
    'TURNKEY_API_BASE_URL',
    'CHAINWORKER_POLL_INTERVAL_MS',
    'CHAINWORKER_BATCH_SIZE',
    'POLYMARKET_CLOB_URL',
    'POLYMARKET_CHAIN_ID',
    'POLY_BUILDER_API_KEY',
    'POLY_BUILDER_SECRET',
    'POLY_BUILDER_PASSPHRASE',
  ];

  const keys = [
    ...orderedKeys.filter((key) => env.has(key)),
    ...Array.from(env.keys()).filter((key) => !orderedKeys.includes(key)),
  ];

  const lines = keys.map((key) => `${key}=${quote(env.get(key) || '')}`);
  fs.writeFileSync(pathname, `${lines.join('\n')}\n`, 'utf8');
}

function copyIfMissing(env, source, key) {
  if (!env.has(key) && source.has(key)) {
    env.set(key, source.get(key) || '');
  }
}

function setDefault(env, key, value) {
  if (!env.has(key)) {
    env.set(key, value);
  }
}

function main() {
  const chainworkerEnv = readEnv(chainworkerEnvPath);
  const rootEnv = readEnv(rootEnvPath);
  const webEnv = readEnv(webEnvPath);

  copyIfMissing(chainworkerEnv, rootEnv, 'DATABASE_URL');
  copyIfMissing(chainworkerEnv, rootEnv, 'TURNKEY_API_PUBLIC_KEY');
  copyIfMissing(chainworkerEnv, rootEnv, 'TURNKEY_API_PRIVATE_KEY');
  copyIfMissing(chainworkerEnv, rootEnv, 'TURNKEY_API_BASE_URL');
  copyIfMissing(chainworkerEnv, rootEnv, 'POLY_BUILDER_API_KEY');
  copyIfMissing(chainworkerEnv, rootEnv, 'POLY_BUILDER_SECRET');
  copyIfMissing(chainworkerEnv, rootEnv, 'POLY_BUILDER_PASSPHRASE');
  copyIfMissing(chainworkerEnv, webEnv, 'DATABASE_URL');
  copyIfMissing(chainworkerEnv, webEnv, 'TURNKEY_API_PUBLIC_KEY');
  copyIfMissing(chainworkerEnv, webEnv, 'TURNKEY_API_PRIVATE_KEY');
  copyIfMissing(chainworkerEnv, webEnv, 'TURNKEY_API_BASE_URL');
  copyIfMissing(chainworkerEnv, webEnv, 'POLY_BUILDER_API_KEY');
  copyIfMissing(chainworkerEnv, webEnv, 'POLY_BUILDER_SECRET');
  copyIfMissing(chainworkerEnv, webEnv, 'POLY_BUILDER_PASSPHRASE');

  setDefault(chainworkerEnv, 'TURNKEY_API_BASE_URL', 'https://api.turnkey.com');
  setDefault(chainworkerEnv, 'CHAINWORKER_POLL_INTERVAL_MS', '30000');
  setDefault(chainworkerEnv, 'CHAINWORKER_BATCH_SIZE', '25');
  setDefault(chainworkerEnv, 'POLYMARKET_CLOB_URL', 'https://clob.polymarket.com');
  setDefault(chainworkerEnv, 'POLYMARKET_CHAIN_ID', '137');

  writeEnv(chainworkerEnvPath, chainworkerEnv);
  console.log(`Wrote: ${chainworkerEnvPath}`);
  console.log('Filled missing values from root .env when available.');
}

main();
