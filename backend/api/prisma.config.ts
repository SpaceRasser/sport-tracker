import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsc -p prisma/tsconfig.seed.json && node dist-prisma/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});