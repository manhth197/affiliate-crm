import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL from here instead of schema.prisma.
// `process.env` (not `env()`) so that `prisma generate` also works without a DATABASE_URL,
// e.g. during `npm ci` in CI or Docker builds.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
