import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { DateTime } from 'luxon';

@Injectable()
export class NotifyService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  // ===== 1) “Время тренировки” по времени телефона =====
  @Interval(60_000)
  async workoutTimeRemindersLocal() {
    const nowUtc = DateTime.utc();

    const settings = await this.prisma.notificationSettings.findMany({
      where: {
        enabled: true,
        workoutTimeEnabled: true,
        workoutTimeLocal: { not: null },
      },
      select: {
        userId: true,
        timezone: true,
        workoutTimeLocal: true,
        workoutDaysMask: true,
        lastWorkoutTimeSentAt: true,
      },
    });

    for (const s of settings) {
      const tz = s.timezone || 'UTC';
      const localNow = nowUtc.setZone(tz);

      const hm = localNow.toFormat('HH:mm');
      if (hm !== s.workoutTimeLocal) continue;

      // Mon=1..Sun=7 -> 0..6 bit
      const dayIndex = localNow.weekday - 1; // 0..6
      const dayBit = 1 << dayIndex;
      if ((s.workoutDaysMask & dayBit) === 0) continue;

      // антиспам: максимум 1 раз в день по локальной дате
      if (s.lastWorkoutTimeSentAt) {
        const lastLocal = DateTime.fromJSDate(s.lastWorkoutTimeSentAt).setZone(tz);
        if (lastLocal.toISODate() === localNow.toISODate()) continue;
      }

      await this.push.sendToUser(s.userId, {
        title: 'Время тренировки ⏰',
        body: 'Самое время сделать тренировку. Даже 15 минут — уже победа.',
        data: { kind: 'workout_time' },
      });

      await this.prisma.notificationSettings.update({
        where: { userId: s.userId },
        data: { lastWorkoutTimeSentAt: new Date() },
      });
    }
  }

  // ===== 2) “Давно не тренировался” в 12:00 по времени телефона =====
  @Interval(60_000)
  async inactivityRemindersLocal() {
    const nowUtc = DateTime.utc();

    const settingsList = await this.prisma.notificationSettings.findMany({
      where: {
        enabled: true,
        inactivityEnabled: true,
      },
      select: {
        userId: true,
        timezone: true,
        inactivityDays: true,
        lastInactivitySentAt: true,
      },
    });

    for (const s of settingsList) {
      const tz = s.timezone || 'UTC';
      const localNow = nowUtc.setZone(tz);

      // локальное время отправки (MVP): 12:00
      if (localNow.toFormat('HH:mm') !== '12:00') continue;

      // антиспам: максимум 1 раз в день по локальной дате
      if (s.lastInactivitySentAt) {
        const lastLocal = DateTime.fromJSDate(s.lastInactivitySentAt).setZone(tz);
        if (lastLocal.toISODate() === localNow.toISODate()) continue;
      }

      // последняя тренировка
      const latest = await this.prisma.workout.findFirst({
        where: { userId: s.userId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });

      // если тренировок нет — считаем от createdAt пользователя
      let baseDate: Date;
      if (latest?.startedAt) {
        baseDate = latest.startedAt;
      } else {
        const u = await this.prisma.user.findUnique({
          where: { id: s.userId },
          select: { createdAt: true },
        });
        if (!u?.createdAt) continue;
        baseDate = u.createdAt;
      }

      const localBase = DateTime.fromJSDate(baseDate).setZone(tz);
      const gapDays = Math.floor(
        localNow.startOf('day').diff(localBase.startOf('day'), 'days').days,
      );

      const needDays = Number(s.inactivityDays ?? 3);
      if (gapDays < needDays) continue;

      await this.push.sendToUser(s.userId, {
        title: 'Давно не тренировался 💪',
        body: latest
          ? `Последняя тренировка была ${gapDays} дн. назад. Сделаем сегодня короткую?`
          : 'Ты ещё не добавлял тренировки. Начнём сегодня?',
        data: { kind: 'inactivity', gapDays },
      });

      await this.prisma.notificationSettings.update({
        where: { userId: s.userId },
        data: { lastInactivitySentAt: new Date() },
      });
    }
  }
}