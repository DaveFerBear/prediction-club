import 'dotenv/config';
import { defineConfig } from 'prisma/config';

console.log('DATABASE_URL', process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Prisma datasource config');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
