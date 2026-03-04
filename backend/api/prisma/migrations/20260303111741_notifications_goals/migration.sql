-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('workouts_per_week');

-- CreateTable
CREATE TABLE "notification_settings" (
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inactivity_enabled" BOOLEAN NOT NULL DEFAULT true,
    "inactivity_days" INTEGER NOT NULL DEFAULT 3,
    "last_inactivity_sent_at" TIMESTAMP(3),
    "workout_time_enabled" BOOLEAN NOT NULL DEFAULT false,
    "workout_time_local" TEXT,
    "workout_days_mask" INTEGER NOT NULL DEFAULT 127,
    "last_workout_time_sent_at" TIMESTAMP(3),
    "recommendations_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_recommendations_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "GoalType" NOT NULL,
    "target" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "achieved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_goals_user_active" ON "goals"("user_id", "active");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
