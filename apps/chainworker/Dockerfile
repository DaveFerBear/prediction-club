FROM node:22-bookworm-slim

WORKDIR /app

# Copy only manifests needed for the chainworker workspace.
COPY package.json yarn.lock tsconfig.json ./
COPY apps/chainworker/package.json apps/chainworker/package.json
COPY packages/db/package.json packages/db/package.json

# Chainworker runs via tsx, so keep dev dependencies.
RUN yarn install --frozen-lockfile --production=false

COPY apps/chainworker apps/chainworker
COPY packages/db packages/db

# Ensure Prisma client is generated for @prediction-club/db.
RUN yarn workspace @prediction-club/db generate

CMD ["yarn", "workspace", "@prediction-club/chainworker", "start"]
