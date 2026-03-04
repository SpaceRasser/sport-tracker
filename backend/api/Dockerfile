# backend/api/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# если у тебя Prisma:
# RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# если Prisma и нужен клиент в рантайме:
# COPY --from=build /app/prisma ./prisma
# RUN npx prisma generate

EXPOSE 3000
CMD ["node", "dist/main.js"]