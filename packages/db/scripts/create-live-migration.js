#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rawName = process.argv[2];

if (!rawName) {
  console.error('Usage: yarn db:migration:create <migration_name>');
  process.exit(1);
}

const migrationName = rawName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

if (!migrationName) {
  console.error('Migration name must contain at least one alphanumeric character.');
  process.exit(1);
}

const now = new Date();
const timestamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0'),
].join('');

const dbPackageDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(dbPackageDir, 'prisma', 'migrations');
const dirName = `${timestamp}_${migrationName}`;
const targetDir = path.join(migrationsDir, dirName);
const targetFile = path.join(targetDir, 'migration.sql');
const prismaBin = path.resolve(dbPackageDir, '..', '..', 'node_modules', '.bin', 'prisma');

fs.mkdirSync(targetDir, { recursive: true });

const result = spawnSync(
  prismaBin,
  ['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'],
  {
    cwd: dbPackageDir,
    encoding: 'utf8',
    env: process.env,
  },
);

if (result.status !== 0) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  process.stderr.write(result.stderr || result.stdout || 'Failed to generate migration diff.\n');
  process.exit(result.status ?? 1);
}

const sql = result.stdout.trim();
if (!sql || sql === '-- This is an empty migration.') {
  fs.rmSync(targetDir, { recursive: true, force: true });
  console.error('No schema changes detected.');
  process.exit(1);
}

fs.writeFileSync(targetFile, `${sql}\n`);
console.log(path.relative(process.cwd(), targetFile));
