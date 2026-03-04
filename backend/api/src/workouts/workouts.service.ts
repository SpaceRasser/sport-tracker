import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ListWorkoutsDto } from './dto/list-workouts.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { PushService } from '../push/push.service';

type RecordUpdate = {
  metricKey: string;
  prevValue: number | null;
  nextValue: number;
  unit: string | null;
};

@Injectable()
export class WorkoutsService {
  constructor(
    private prisma: PrismaService,
    private achievements: AchievementsService,
    private push: PushService,
  ) {}

  async create(userId: string, dto: CreateWorkoutDto) {
    const activity = await this.prisma.activityType.findUnique({
      where: { id: dto.activityTypeId },
      select: { id: true },
    });
    if (!activity) throw new BadRequestException('activityTypeId not found');

    const metrics = (dto.metrics ?? [])
      .filter((m) => m && typeof m.key === 'string')
      .map((m) => ({
        metricKey: m.key.trim(),
        valueNum: m.value,
        unit: m.unit?.trim() || null,
      }))
      .filter((m) => m.metricKey.length > 0 && Number.isFinite(Number(m.valueNum)));

    const startedAt = new Date(dto.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      throw new BadRequestException('startedAt invalid');
    }

    const workout = await this.prisma.workout.create({
      data: {
        userId,
        activityTypeId: dto.activityTypeId,
        startedAt,
        durationSec: dto.durationSec ?? null,
        notes: dto.notes?.trim() || null,
        metrics: metrics.length
          ? {
              create: metrics.map((m) => ({
                metricKey: m.metricKey,
                valueNum: m.valueNum,
                unit: m.unit,
              })),
            }
          : undefined,
      },
      include: {
        metrics: true,
        activityType: { select: { id: true, code: true, name: true } },
      },
    });

    // 1) PR (личные рекорды)
    const recordUpdates = await this.recomputeRecordsForWorkout(
      workout.userId,
      workout.activityTypeId,
      workout.id,
    );

    // 2) Achievements (бейджи)
    const ach = await this.achievements.evaluateAfterWorkout(userId, workout.id);

    // 3) Push notification (если есть что сообщить)
    await this.maybeSendWorkoutPush(userId, workout, recordUpdates, ach.granted);

    return { workout, grantedAchievements: ach.granted };
  }

  async list(userId: string, q: ListWorkoutsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    let from = q.from ? new Date(q.from) : null;
    let to = q.to ? new Date(q.to) : null;

    if (q.period && q.period !== 'all') {
      const now = new Date();
      const days = q.period === 'week' ? 7 : 30;
      from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      to = now;
    }

    if (from && Number.isNaN(from.getTime())) throw new BadRequestException('from invalid');
    if (to && Number.isNaN(to.getTime())) throw new BadRequestException('to invalid');

    const where: any = {
      userId,
      ...(q.activityTypeId ? { activityTypeId: q.activityTypeId } : {}),
      ...(from || to
        ? {
            startedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.workout.count({ where }),
      this.prisma.workout.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          activityType: { select: { id: true, code: true, name: true } },
          metrics: true,
        },
      }),
    ]);

    const items = rows.map((w) => ({
      ...w,
      metrics: (w.metrics ?? []).map((m) => ({
        ...m,
        valueNum: Number(m.valueNum),
      })),
    }));

    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  private async recomputeRecordsForWorkout(
    userId: string,
    activityTypeId: string,
    workoutId: string,
  ): Promise<RecordUpdate[]> {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: { metrics: true },
    });
    if (!workout) return [];

    const updates: RecordUpdate[] = [];

    const isLowerBetter = (key: string) => {
      const k = key.toLowerCase();
      return k.includes('pace') || k.includes('min_') || k.includes('time_per');
    };

    for (const m of workout.metrics ?? []) {
      const metricKey = m.metricKey;
      const value = Number(m.valueNum);

      if (!metricKey || !Number.isFinite(value)) continue;

      const existing = await this.prisma.personalRecord.findFirst({
        where: { userId, activityTypeId, metricKey },
      });

      const prev = existing ? Number(existing.bestValueNum) : null;

      const better =
        !existing
          ? true
          : isLowerBetter(metricKey)
            ? value < Number(existing.bestValueNum)
            : value > Number(existing.bestValueNum);

      if (!better) continue;

      updates.push({
        metricKey,
        prevValue: prev,
        nextValue: value,
        unit: m.unit ?? null,
      });

      if (!existing) {
        await this.prisma.personalRecord.create({
          data: {
            userId,
            activityTypeId,
            metricKey,
            bestValueNum: value,
            achievedAt: workout.startedAt,
            workoutId: workout.id,
          },
        });
      } else {
        await this.prisma.personalRecord.update({
          where: { id: existing.id },
          data: {
            bestValueNum: value,
            achievedAt: workout.startedAt,
            workoutId: workout.id,
          },
        });
      }
    }

    return updates;
  }

  private fmt(n: number) {
    if (!Number.isFinite(n)) return String(n);
    const s = n.toFixed(2);
    return s.replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
  }

  private async maybeSendWorkoutPush(
    userId: string,
    workout: any,
    recordUpdates: RecordUpdate[],
    grantedAchievementCodes: string[],
  ) {
    const prCount = recordUpdates.length;
    const achCount = grantedAchievementCodes.length;

    if (!prCount && !achCount) return;

    const achTitles = achCount
      ? await this.prisma.achievement.findMany({
          where: { code: { in: grantedAchievementCodes } },
          select: { title: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const title = workout?.activityType?.name ? String(workout.activityType.name) : 'SportTracker';

    let body = '';

    if (achCount && prCount) {
      body = `Новая тренировка: +${achCount} достиж., +${prCount} рек.`;
    } else if (achCount) {
      if (achCount === 1) {
        body = `Новое достижение: ${achTitles[0]?.title ?? grantedAchievementCodes[0]}`;
      } else {
        const short = achTitles
          .slice(0, 3)
          .map((a) => a.title)
          .filter(Boolean);
        body = short.length
          ? `Новые достижения: ${short.join(', ')}${achCount > 3 ? '…' : ''}`
          : `Новые достижения: +${achCount}`;
      }
    } else {
      if (prCount === 1) {
        const r = recordUpdates[0];
        const u = r.unit ? ` ${r.unit}` : '';
        body = `Новый рекорд: ${r.metricKey} ${this.fmt(r.nextValue)}${u}`;
      } else {
        body = `Новые рекорды: +${prCount}`;
      }
    }

    await this.push.sendToUser(userId, {
      title,
      body,
      data: {
        kind: 'workout',
        workoutId: workout?.id,
        achievements: grantedAchievementCodes,
        records: recordUpdates.slice(0, 5).map((r) => ({
          metricKey: r.metricKey,
          value: r.nextValue,
          unit: r.unit,
        })),
      },
    });
  }

  async getById(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId },
      include: {
        activityType: { select: { id: true, code: true, name: true } },
        metrics: true,
        media: true,
      },
    });

    if (!workout) return null;

    return {
      workout: {
        ...workout,
        metrics: (workout.metrics ?? []).map((m) => ({
          ...m,
          valueNum: Number(m.valueNum),
        })),
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateWorkoutDto) {
    const existing = await this.prisma.workout.findFirst({
      where: { id, userId },
      select: { id: true, activityTypeId: true },
    });
    if (!existing) return { workout: null };

    if (dto.activityTypeId) {
      const act = await this.prisma.activityType.findUnique({
        where: { id: dto.activityTypeId },
        select: { id: true },
      });
      if (!act) throw new BadRequestException('activityTypeId not found');
    }

    const data: any = {};

    if (dto.startedAt) {
      const startedAt = new Date(dto.startedAt);
      if (Number.isNaN(startedAt.getTime())) throw new BadRequestException('startedAt invalid');
      data.startedAt = startedAt;
    }
    if (dto.durationSec !== undefined) data.durationSec = dto.durationSec ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.activityTypeId) data.activityTypeId = dto.activityTypeId;

    const metricsInput =
      dto.metrics?.map((m) => ({
        metricKey: m.key.trim(),
        valueNum: m.value,
        unit: m.unit?.trim() || null,
      })) ?? null;

    if (metricsInput) {
      const clean = metricsInput.filter(
        (m) => m.metricKey.length > 0 && Number.isFinite(Number(m.valueNum)),
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.workout.update({ where: { id }, data });
        await tx.workoutMetric.deleteMany({ where: { workoutId: id } });

        if (clean.length) {
          await tx.workoutMetric.createMany({
            data: clean.map((m) => ({
              workoutId: id,
              metricKey: m.metricKey,
              valueNum: m.valueNum,
              unit: m.unit,
            })),
          });
        }
      });

      const finalActivityTypeId = dto.activityTypeId ?? existing.activityTypeId;
      const recordUpdates = await this.recomputeRecordsForWorkout(userId, finalActivityTypeId, id);
      const ach = await this.achievements.evaluateAfterWorkout(userId, id);

      const full = await this.prisma.workout.findFirst({
        where: { id, userId },
        include: {
          metrics: true,
          activityType: { select: { id: true, code: true, name: true } },
        },
      });

      if (full) {
        await this.maybeSendWorkoutPush(userId, full, recordUpdates, ach.granted);
      }

      return {
        workout: full
          ? {
              ...full,
              metrics: (full.metrics ?? []).map((m) => ({ ...m, valueNum: Number(m.valueNum) })),
            }
          : null,
        grantedAchievements: ach.granted,
      };
    } else {
      const w = await this.prisma.workout.update({
        where: { id },
        data,
        include: {
          metrics: true,
          activityType: { select: { id: true, code: true, name: true } },
        },
      });

      const finalActivityTypeId = dto.activityTypeId ?? existing.activityTypeId;
      const recordUpdates = await this.recomputeRecordsForWorkout(userId, finalActivityTypeId, id);
      const ach = await this.achievements.evaluateAfterWorkout(userId, id);

      await this.maybeSendWorkoutPush(userId, w, recordUpdates, ach.granted);

      return {
        workout: {
          ...w,
          metrics: (w.metrics ?? []).map((m) => ({ ...m, valueNum: Number(m.valueNum) })),
        },
        grantedAchievements: ach.granted,
      };
    }
  }

  async remove(userId: string, id: string) {
    const exists = await this.prisma.workout.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return { ok: true };

    await this.prisma.workout.delete({ where: { id } });

    return { ok: true };
  }

  async latest(userId: string) {
    const w = await this.prisma.workout.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        activityType: { select: { id: true, code: true, name: true } },
        metrics: true,
      },
    });

    if (!w) return { workout: null };

    return {
      workout: {
        ...w,
        metrics: (w.metrics ?? []).map((m) => ({ ...m, valueNum: Number(m.valueNum) })),
      },
    };
  }
}