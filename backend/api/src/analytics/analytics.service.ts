import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsProgressDto } from './dto/progress.dto';

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async progress(userId: string, q: AnalyticsProgressDto) {
    const days = Number(q.days ?? '30');
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    if (!q.metricKey?.trim()) throw new BadRequestException('metricKey is required');

    // Берём метрики + startedAt тренировки
    const rows = await this.prisma.workoutMetric.findMany({
      where: {
        metricKey: q.metricKey,
        workout: {
          userId,
          activityTypeId: q.activityTypeId,
          startedAt: { gte: from, lte: to },
        },
      },
      select: {
        valueNum: true,
        unit: true,
        workout: { select: { startedAt: true } },
      },
      orderBy: { workout: { startedAt: 'asc' } },
    });

    // Агрегация по дням: avg
    const buckets = new Map<string, { sum: number; n: number }>();
    let unit: string | null = null;

    for (const r of rows) {
      const v = Number(r.valueNum);
      if (!Number.isFinite(v)) continue;

      unit = unit ?? (r.unit ?? null);

      const k = dayKey(r.workout.startedAt);
      const b = buckets.get(k) ?? { sum: 0, n: 0 };
      b.sum += v;
      b.n += 1;
      buckets.set(k, b);
    }

    const points = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, b]) => ({ date, value: Number((b.sum / b.n).toFixed(4)) }));

    const values = points.map((p) => p.value);
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    const last = values.length ? values[values.length - 1] : null;

    return {
      unit,
      from,
      to,
      points,
      summary: { min, max, last },
    };
  }

  async summary(userId: string) {
  const now = new Date();
  const from7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    workoutsLast7,
    workoutsTotal,
    prCount,
    achievementsEarned,
    achievementsTotal,
  ] = await Promise.all([
    this.prisma.workout.count({
      where: { userId, startedAt: { gte: from7, lte: now } },
    }),
    this.prisma.workout.count({ where: { userId } }),
    this.prisma.personalRecord.count({ where: { userId } }),
    this.prisma.userAchievement.count({ where: { userId } }),
    this.prisma.achievement.count(),
  ]);

  return {
    workoutsLast7,
    workoutsTotal,
    prCount,
    achievementsEarned,
    achievementsTotal,
  };
}
}