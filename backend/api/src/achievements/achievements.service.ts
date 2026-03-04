import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Rule =
  | { type: 'first_workout'; activityCode: string }
  | { type: 'metric_gte'; activityCode: string; metricKey: string; threshold: number }
  | { type: 'count_in_days_gte'; activityCode: string; days: number; threshold: number }
  | { type: 'total_workouts_gte'; threshold: number }
  | { type: 'daily_streak_gte'; days: number };

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  async evaluateAfterWorkout(userId: string, workoutId: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: {
        activityType: { select: { code: true } },
        metrics: true,
      },
    });
    if (!workout) return { granted: [] as string[] };

    const activityCode = workout.activityType.code;

    const defs = await this.prisma.achievement.findMany({
      select: { id: true, code: true, title: true, rule: true },
    });

    const granted: string[] = [];

    for (const def of defs) {
      const rule = def.rule as unknown as Rule;

      const already = await this.prisma.userAchievement.findFirst({
        where: { userId, achievementId: def.id },
        select: { id: true },
      });
      if (already) continue;

      const ok = await this.checkRule(userId, workout, rule);
      if (!ok) continue;

      await this.prisma.userAchievement.create({
        data: {
          userId,
          achievementId: def.id,
          meta: { workoutId: workout.id, at: new Date().toISOString() },
        },
      });

      granted.push(def.code);
    }

    return { granted };
  }

  private async checkRule(userId: string, workout: any, rule: Rule): Promise<boolean> {
    if (rule.type === 'first_workout') {
      if (workout.activityType.code !== rule.activityCode) return false;

      const count = await this.prisma.workout.count({
        where: {
          userId,
          activityType: { code: rule.activityCode },
        },
      });
      return count === 1; // текущая — первая
    }

    if (rule.type === 'metric_gte') {
      if (workout.activityType.code !== rule.activityCode) return false;

      const metric = (workout.metrics ?? []).find((m: any) => m.metricKey === rule.metricKey);
      if (!metric) return false;

      return Number(metric.valueNum) >= rule.threshold;
    }

    if (rule.type === 'count_in_days_gte') {
      if (workout.activityType.code !== rule.activityCode) return false;

      const to = new Date();
      const from = new Date(to.getTime() - rule.days * 24 * 60 * 60 * 1000);

      const count = await this.prisma.workout.count({
        where: {
          userId,
          startedAt: { gte: from, lte: to },
          activityType: { code: rule.activityCode },
        },
      });
      return count >= rule.threshold;
    }

    if (rule.type === 'total_workouts_gte') {
      const count = await this.prisma.workout.count({ where: { userId } });
      return count >= rule.threshold;
    }

    if (rule.type === 'daily_streak_gte') {
      // простой вариант: проверяем последние N дней, что в каждый день есть >=1 тренировка
      const days = rule.days;
      const to = new Date();

      for (let i = 0; i < days; i++) {
        const d0 = new Date(to.getFullYear(), to.getMonth(), to.getDate() - i);
        const d1 = new Date(to.getFullYear(), to.getMonth(), to.getDate() - i + 1);

        const c = await this.prisma.workout.count({
          where: { userId, startedAt: { gte: d0, lt: d1 } },
        });
        if (c === 0) return false;
      }
      return true;
    }

    return false;
  }

  async listForUser(userId: string) {
    const defs = await this.prisma.achievement.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, title: true, description: true, createdAt: true },
    });

    const got = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, achievedAt: true, meta: true },
    });

    const gotMap = new Map(got.map((g) => [g.achievementId, g]));

    const items = defs.map((d) => {
      const g = gotMap.get(d.id);
      return {
        ...d,
        achieved: !!g,
        achievedAt: g?.achievedAt ?? null,
        meta: g?.meta ?? null,
      };
    });

    return { items };
  }
}