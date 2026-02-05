FROM node:20-alpine AS deps

RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile --filter api...

FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=deps /app/package.json /app/package.json
COPY --from=deps /app/apps/api/package.json /app/apps/api/package.json
COPY apps/api apps/api

RUN pnpm --filter api build

FROM node:20-alpine AS runner

ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile --prod --filter api...

COPY --from=builder /app/apps/api/dist /app/apps/api/dist

CMD ["node", "apps/api/dist/main.js"]
