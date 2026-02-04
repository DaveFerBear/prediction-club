const fs = require('fs');
const path = require('path');
const { Wallet } = require('ethers');

const cwd = process.cwd();
const forceRotate = process.argv.includes('--force');

const chainworkerEnvPath = path.resolve(cwd, '.env');
const rootEnvPath = path.resolve(cwd, '../../.env');

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
    'CHAINWORKER_SIGNER_PRIVATE_KEY',
    'CHAINWORKER_SIGNER_ADDRESS',
    'CHAINWORKER_SIGNER_GENERATED_AT',
    'CHAINWORKER_POLL_INTERVAL_MS',
    'CHAINWORKER_BATCH_SIZE',
    'POLYMARKET_CLOB_URL',
    'POLYMARKET_CHAIN_ID',
    'CHAINWORKER_ALLOW_ZERO_PAYOUTS',
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

function main() {
  const chainworkerEnv = readEnv(chainworkerEnvPath);
  const rootEnv = readEnv(rootEnvPath);

  if (!chainworkerEnv.has('DATABASE_URL') && rootEnv.has('DATABASE_URL')) {
    chainworkerEnv.set('DATABASE_URL', rootEnv.get('DATABASE_URL') || '');
  }

  const existingKey = chainworkerEnv.get('CHAINWORKER_SIGNER_PRIVATE_KEY');
  const wallet =
    existingKey && !forceRotate
      ? new Wallet(existingKey)
      : Wallet.createRandom();
  const nowIso = new Date().toISOString();

  chainworkerEnv.set('CHAINWORKER_SIGNER_PRIVATE_KEY', wallet.privateKey);
  chainworkerEnv.set('CHAINWORKER_SIGNER_ADDRESS', wallet.address);
  if (!existingKey || forceRotate || !chainworkerEnv.get('CHAINWORKER_SIGNER_GENERATED_AT')) {
    chainworkerEnv.set('CHAINWORKER_SIGNER_GENERATED_AT', nowIso);
  }

  if (!chainworkerEnv.has('CHAINWORKER_POLL_INTERVAL_MS')) {
    chainworkerEnv.set('CHAINWORKER_POLL_INTERVAL_MS', '30000');
  }
  if (!chainworkerEnv.has('CHAINWORKER_BATCH_SIZE')) {
    chainworkerEnv.set('CHAINWORKER_BATCH_SIZE', '25');
  }
  if (!chainworkerEnv.has('POLYMARKET_CLOB_URL')) {
    chainworkerEnv.set('POLYMARKET_CLOB_URL', 'https://clob.polymarket.com');
  }
  if (!chainworkerEnv.has('POLYMARKET_CHAIN_ID')) {
    chainworkerEnv.set('POLYMARKET_CHAIN_ID', '137');
  }
  if (!chainworkerEnv.has('CHAINWORKER_ALLOW_ZERO_PAYOUTS')) {
    chainworkerEnv.set('CHAINWORKER_ALLOW_ZERO_PAYOUTS', 'false');
  }

  writeEnv(chainworkerEnvPath, chainworkerEnv);

  const action = existingKey && !forceRotate ? 'Kept existing' : 'Generated new';
  console.log(`${action} chainworker signer key.`);
  console.log(`Signer address: ${wallet.address}`);
  console.log(`Signer generated at: ${chainworkerEnv.get('CHAINWORKER_SIGNER_GENERATED_AT')}`);
  console.log(`Wrote: ${chainworkerEnvPath}`);
  if (existingKey && !forceRotate) {
    console.log('Use --force to rotate the signer private key.');
  }
}

main();
