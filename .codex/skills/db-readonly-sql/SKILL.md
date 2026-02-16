---
name: db-readonly-sql
description: Read-only PostgreSQL lookup skill for this repository using DATABASE_URL and direct psql execution. Use when the user asks to inspect data, verify records, or answer questions from the DB. Always draft SQL and command first, ask for confirmation, then run inside a READ ONLY transaction.
---

# DB Read-Only SQL

Use this skill for repository-scoped database lookups.

## Rules

- Use read-only SQL only (`SELECT` or `WITH ... SELECT`).
- Never run mutation or schema-changing SQL.
- Never run multi-statement SQL from user input.
- Confirm table and column names from `packages/db/prisma/schema.prisma` before drafting SQL.
- Draft the SQL and exact `psql` command first.
- Ask the user to confirm before executing.

## Schema Discovery

- First source of truth: `packages/db/prisma/schema.prisma`.
- If table/column names are still uncertain, draft and run an `information_schema` lookup query first, then draft the final query.

## Disallowed Keywords

Reject SQL containing these case-insensitive keywords:

- `insert`
- `update`
- `delete`
- `drop`
- `alter`
- `create`
- `truncate`
- `grant`
- `revoke`
- `copy`
- `call`
- `do`
- `vacuum`
- `analyze`

Also reject semicolon-chained statements.

## Default Query Limits

- If query is not an aggregate-only result and has no `LIMIT`, append `LIMIT 50`.
- If `LIMIT` exceeds `500`, reduce to `500`.

## Required Draft Step

Before any execution, provide:

1. Draft SQL
2. Exact command to run
3. Short expected output note

Then ask: `Run this query? (yes/no)`

Do not execute until the user confirms.

## Execution Command

Run inside a read-only transaction:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -P pager=off -c "BEGIN READ ONLY; <SQL>; ROLLBACK;"
```

## Environment Checks

Before execution:

- Confirm `DATABASE_URL` is set.
- If not set, ask user to export it.

## Output Style

- Return a concise summary first.
- Include key rows/values from the result.
- Include the SQL that was run in a code block.
