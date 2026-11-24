# syntax=docker/dockerfile:1
# Multi-stage build for the Affiliate CRM API.
#   docker build --target runtime -t affiliate-crm-api apps/api   # the API
#   docker build --target migrate -t affiliate-crm-migrate apps/api # migrations + seed
ARG NODE_IMAGE=node:26-alpine

# 1. All dependencies (incl. dev) + generated Prisma client.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate` into src/generated.
RUN npm ci --no-audit --no-fund

# 2. Compile TypeScript (nest build also runs the Swagger CLI plugin).
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# 3. Production dependencies only. Scripts are skipped: the Prisma client is
#    already compiled into dist/, and argon2 loads its prebuilt binary.
#    The Prisma CLI and TypeScript are optional peers of @prisma/client
#    ("devOptional" in the lockfile), so npm leaves them out only with
#    --omit=optional too. Prisma ships a query compiler per database; only
#    PostgreSQL's is kept. Source maps are not needed at runtime.
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --omit=peer --ignore-scripts --no-audit --no-fund \
 && find node_modules/@prisma/client/runtime -name 'query_compiler_*' ! -name '*postgresql*' -delete \
 && find node_modules -name '*.map' -delete

# 4. One-off job image: `prisma migrate deploy` (and `prisma db seed` on demand).
#    Kept separate so the runtime image does not ship the Prisma CLI.
FROM deps AS migrate
COPY tsconfig.json ./
COPY src ./src
CMD ["npx", "prisma", "migrate", "deploy"]

# 5. Runtime: compiled JS + production node_modules, non-root user.
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health > /dev/null || exit 1
CMD ["node", "dist/main"]
