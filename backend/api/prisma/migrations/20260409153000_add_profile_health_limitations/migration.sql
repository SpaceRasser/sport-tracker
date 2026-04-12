ALTER TABLE "profiles"
ADD COLUMN "health_limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
