FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ВАЖНО: Prisma 7 требует DATABASE_URL даже для generate, поэтому ставим dummy
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

RUN npm run prisma:generate
RUN npm run build


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ставим зависимости
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# приложение
COPY --from=builder /app/dist ./dist

# prisma assets + CONFIG !!!
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

CMD ["npm","run","railway:start"]