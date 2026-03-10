#!/usr/bin/env node

const mode = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch (error) {
  console.error(`DATABASE_URL is invalid: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const localHosts = new Set(['localhost', '127.0.0.1', '::1', 'db', 'postgres', 'host.docker.internal']);
const host = parsedUrl.hostname ?? '';
const isLocalHost = localHosts.has(host);

if (!isLocalHost) {
  console.error(
    `Refusing to run Prisma ${mode} against non-local database host "${host}". Use prisma migrate deploy for shared databases.`,
  );
  process.exit(1);
}

if (mode === 'db-push' && process.env.ALLOW_PRISMA_DB_PUSH !== '1') {
  console.error('Refusing to run prisma db push. Set ALLOW_PRISMA_DB_PUSH=1 for an explicit local-only override.');
  process.exit(1);
}
