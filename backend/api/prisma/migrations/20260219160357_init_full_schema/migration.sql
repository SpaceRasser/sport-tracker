-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'unknown');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "vk_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'unknown',
    "birthdate" DATE,
    "height_cm" INTEGER,
    "weight_kg" DECIMAL(6,2),
    "level" "UserLevel",
    "goals" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "activity_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields_schema" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_type_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_sec" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_metrics" (
    "id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "value_num" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,

    CONSTRAINT "workout_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_media" (
    "id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "activity_type_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "best_value_num" DECIMAL(12,4) NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL,
    "workout_id" UUID,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rule" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_recommendations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "dismissed_at" TIMESTAMP(3),

    CONSTRAINT "user_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_vk_id_key" ON "users"("vk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "idx_users_vk_id" ON "users"("vk_id");

-- CreateIndex
CREATE INDEX "idx_users_phone" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_code_key" ON "activity_types"("code");

-- CreateIndex
CREATE INDEX "idx_workouts_user_started_at" ON "workouts"("user_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "idx_workouts_activity_type" ON "workouts"("activity_type_id");

-- CreateIndex
CREATE INDEX "idx_workout_metrics_workout_metric" ON "workout_metrics"("workout_id", "metric_key");

-- CreateIndex
CREATE INDEX "idx_workout_media_workout" ON "workout_media"("workout_id");

-- CreateIndex
CREATE INDEX "idx_records_user_activity_metric" ON "personal_records"("user_id", "activity_type_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_records_user_activity_metric" ON "personal_records"("user_id", "activity_type_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "idx_user_achievements_user" ON "user_achievements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_achievements_user_achievement" ON "user_achievements"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_templates_code_key" ON "recommendation_templates"("code");

-- CreateIndex
CREATE INDEX "idx_user_recommendations_user_created" ON "user_recommendations"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_metrics" ADD CONSTRAINT "workout_metrics_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_media" ADD CONSTRAINT "workout_media_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "recommendation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
