FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN ls -la && ls -la prisma && ls -la prisma.config.*
RUN npm ci

COPY . .

# Prisma schema точно есть тут: ./prisma/schema.prisma
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public" npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

# ВАЖНО: сначала миграции, потом старт
CMD ["sh", "-c", "npm run prisma:migrate:deploy && node dist/src/main.js"]