import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

type Rule =
  | { type: 'always'; cooldownDays?: number; priority?: number }
  | {
      type: 'inactivity_days_gte';
      days: number;
      cooldownDays?: number;
      priority?: number;
    }
  | {
      type: 'workouts_in_days_lt';
      days: number;
      threshold: number;
      cooldownDays?: number;
      priority?: number;
    }
  | {
      type: 'no_activity_in_days';
      activityCode: string;
      days: number;
      cooldownDays?: number;
      priority?: number;
    }
  | {
      type: 'activity_present';
      activityCode: string;
      days: number;
      cooldownDays?: number;
      priority?: number;
    }
  | {
      type: 'run_load_increase_pct_gt';
      days: number;
      pct: number;
      cooldownDays?: number;
      priority?: number;
    }
  | {
      type: 'plateau_metric';
      activityCode: string;
      metricKey: string;
      days: number;
      cooldownDays?: number;
      priority?: number;
    }
  | { type: 'bmi_gte'; bmi: number; cooldownDays?: number; priority?: number }
  | { type: 'no_streak_3'; cooldownDays?: number; priority?: number };

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysBetween(a: Date, b: Date) {
  return Math.floor(
    (dayStart(b).getTime() - dayStart(a).getTime()) / (24 * 60 * 60 * 1000),
  );
}
function renderTemplate(tpl: string, vars: Record<string, any>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`).toString());
}

@Injectable()
export class RecommendationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async getForUser(userId: string) {
    // 1) считаем фичи
    const features = await this.computeFeatures(userId);

    // 2) берём активные шаблоны
    const templates = await this.prisma.recommendationTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        rule: true,
        active: true,
        createdAt: true,
      },
    });

    // 3) существующие рекомендации (для cooldown / dedupe)
    const existing = await this.prisma.userRecommendation.findMany({
      where: { userId },
      select: {
        id: true,
        templateId: true,
        createdAt: true,
        dismissedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const lastByTemplate = new Map<string, Date>();
    for (const r of existing) {
      if (!lastByTemplate.has(r.templateId)) {
        lastByTemplate.set(r.templateId, r.createdAt);
      }
    }

    // 4) генерим новые (если rule ok и cooldown прошёл)
    const now = new Date();
    const createdIds: string[] = [];

    const scored: Array<{
      tplId: string;
      code: string;
      title: string;
      text: string;
      priority: number;
      meta: any;
      cooldownDays: number;
    }> = [];

    for (const t of templates) {
      const rule = (t.rule ?? {}) as Rule;
      const check = await this.checkRule(userId, rule, features);

      if (!check.ok) continue;

      const cooldownDays = Number((rule as any).cooldownDays ?? 7);
      const priority = Number((rule as any).priority ?? 50);

      const last = lastByTemplate.get(t.id);
      if (last) {
        const passed = daysBetween(last, now);
        if (passed < cooldownDays) continue;
      }

      const text = renderTemplate(t.description, check.vars);

      scored.push({
        tplId: t.id,
        code: t.code,
        title: t.title,
        text,
        priority,
        meta: {
          vars: check.vars,
          reason: check.reason,
          templateCode: t.code,
        },
        cooldownDays,
      });
    }

    // 5) сортируем и создаём top N (чтобы не спамить)
    scored.sort((a, b) => b.priority - a.priority);
    const toCreate = scored.slice(0, 5);

    for (const rec of toCreate) {
      const created = await this.prisma.userRecommendation.create({
        data: {
          userId,
          templateId: rec.tplId,
          meta: rec.meta,
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }

    // 5.1) пуш “Новые советы” + антиспам (раз в сутки) + настройка enabled
    if (createdIds.length > 0) {
      const s =
        (await this.prisma.notificationSettings.findUnique({
          where: { userId },
        })) ??
        (await this.prisma.notificationSettings.create({ data: { userId } }));

      if (s.enabled && s.recommendationsEnabled) {
        const now = new Date();
        const last = s.lastRecommendationsSentAt;
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (!last || now.getTime() - last.getTime() >= oneDayMs) {
          await this.push.sendToUser(userId, {
            title: 'Новые советы ✨',
            body: `Добавлено советов: ${createdIds.length}`,
            data: { kind: 'recommendations', created: createdIds.length },
          });

          await this.prisma.notificationSettings.update({
            where: { userId },
            data: { lastRecommendationsSentAt: now },
          });
        }
      }
    }

    // 6) отдаём список рекомендаций (можно и скрытые, и активные)
    const rows = await this.prisma.userRecommendation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
          },
        },
      },
    });

    const items = rows.map((r) => {
      const meta = (r.meta as any) ?? {};
      const vars = meta?.vars ?? {};
      const rawReason = meta?.reason ?? null;
      const templateCode = meta?.templateCode ?? r.template.code ?? null;

      return {
        id: r.id,
        createdAt: r.createdAt,
        dismissedAt: r.dismissedAt,
        template: {
          id: r.template.id,
          code: r.template.code,
          title: r.template.title,
        },
        text: meta?.vars
          ? renderTemplate(r.template.description, vars)
          : r.template.description,
        reason: this.humanizeReason(rawReason, vars, templateCode),
      };
    });

    return {
      items,
      created: createdIds.length,
      features,
    };
  }

  async dismiss(userId: string, id: string) {
    // защита: dismiss только свои
    const rec = await this.prisma.userRecommendation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!rec) return { ok: true };

    await this.prisma.userRecommendation.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });
    return { ok: true };
  }

  private async computeFeatures(userId: string) {
    const now = new Date();

    const [profile, lastWorkout, totalWorkouts] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { heightCm: true, weightKg: true, level: true },
      }),
      this.prisma.workout.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      this.prisma.workout.count({ where: { userId } }),
    ]);

    const heightCm = profile?.heightCm ?? null;
    const weightKg =
      profile?.weightKg != null ? Number(profile.weightKg) : null;

    const bmi =
      heightCm && weightKg
        ? round1(weightKg / Math.pow(heightCm / 100, 2))
        : null;

    const daysSinceLastWorkout = lastWorkout?.startedAt
      ? daysBetween(lastWorkout.startedAt, now)
      : 999;

    const workoutsLast7 = await this.prisma.workout.count({
      where: {
        userId,
        startedAt: { gte: new Date(now.getTime() - 7 * 86400000) },
      },
    });

    // last strength (GYM)
    const lastStrength = await this.prisma.workout.findFirst({
      where: { userId, activityType: { code: 'GYM' } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });
    const daysSinceLastStrength = lastStrength?.startedAt
      ? daysBetween(lastStrength.startedAt, now)
      : 999;

    // streak days: считаем последние 14 дней, сколько подряд с конца
    let streak = 0;
    for (let i = 0; i < 14; i++) {
      const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const d1 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i + 1,
      );
      const c = await this.prisma.workout.count({
        where: { userId, startedAt: { gte: d0, lt: d1 } },
      });
      if (c > 0) streak++;
      else break;
    }

    // run load increase % (sum distance_km last 7 vs prev 7)
    const runLoad = await this.runLoadIncreasePct(userId, 7);

    // plateau pace (avg_pace_min_km) : compare avg last 7 to avg previous 7 within last 21
    const plateau = await this.plateauMetric(
      userId,
      'RUN',
      'avg_pace_min_km',
      21,
    );

    return {
      bmi,
      heightCm,
      weightKg,
      totalWorkouts,
      workoutsLast7,
      daysSinceLastWorkout,
      daysSinceLastStrength,
      streakDays: streak,
      runLoadIncreasePct: runLoad.pct,
      runLoadLast: runLoad.last,
      runLoadPrev: runLoad.prev,
      plateauPace: plateau, // { ok, metricLabel, delta }
      targetWeekly: 3,
      metricLabel: 'темп',
    };
  }

  private async runLoadIncreasePct(userId: string, days: number) {
    const now = new Date();
    const fromLast = new Date(now.getTime() - days * 86400000);
    const fromPrev = new Date(now.getTime() - days * 2 * 86400000);

    const sumForRange = async (from: Date, to: Date) => {
      const rows = await this.prisma.workoutMetric.findMany({
        where: {
          metricKey: 'distance_km',
          workout: {
            userId,
            activityType: { code: 'RUN' },
            startedAt: { gte: from, lt: to },
          },
        },
        select: { valueNum: true },
      });
      return rows.reduce((acc, r) => acc + Number(r.valueNum), 0);
    };

    const last = await sumForRange(fromLast, now);
    const prev = await sumForRange(fromPrev, fromLast);

    const pct =
      prev > 0 ? Math.round(((last - prev) / prev) * 100) : last > 0 ? 999 : 0;
    return { last: round1(last), prev: round1(prev), pct };
  }

  private async plateauMetric(
    userId: string,
    activityCode: string,
    metricKey: string,
    days: number,
  ) {
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);
    const mid = new Date(now.getTime() - 7 * 86400000);

    const avgForRange = async (from: Date, to: Date) => {
      const rows = await this.prisma.workoutMetric.findMany({
        where: {
          metricKey,
          workout: {
            userId,
            activityType: { code: activityCode },
            startedAt: { gte: from, lt: to },
          },
        },
        select: { valueNum: true },
      });
      if (!rows.length) return null;
      const s = rows.reduce((acc, r) => acc + Number(r.valueNum), 0);
      return s / rows.length;
    };

    const recent = await avgForRange(mid, now);
    const older = await avgForRange(from, mid);

    if (recent == null || older == null) return { ok: false, delta: null };

    // для pace: меньше лучше, поэтому "плато" = улучшения нет (recent >= older - small)
    const delta = round1(recent - older);
    const ok = delta >= -0.05; // почти не улучшилось
    return { ok, delta, metricLabel: 'темп' };
  }

  private async checkRule(
    userId: string,
    rule: Rule,
    f: any,
  ): Promise<{ ok: boolean; vars: any; reason?: string }> {
    const vars: any = {
      ...f,
      bmi: f.bmi ?? '—',
      workoutsLast7: f.workoutsLast7 ?? 0,
      daysSinceLastWorkout: f.daysSinceLastWorkout ?? 0,
      daysSinceLastStrength: f.daysSinceLastStrength ?? 0,
      targetWeekly: f.targetWeekly ?? 3,
      loadIncreasePct: f.runLoadIncreasePct ?? 0,
      metricLabel: f.plateauPace?.metricLabel ?? 'метрика',
    };

    if (rule.type === 'always') return { ok: true, vars, reason: 'always' };

    if (rule.type === 'inactivity_days_gte') {
      return {
        ok: (f.daysSinceLastWorkout ?? 999) >= rule.days,
        vars,
        reason: `daysSinceLastWorkout>=${rule.days}`,
      };
    }

    if (rule.type === 'workouts_in_days_lt') {
      // сейчас считаем только last7, так проще
      const ok = (f.workoutsLast7 ?? 0) < rule.threshold;
      return { ok, vars, reason: `workoutsLast7<${rule.threshold}` };
    }

    if (rule.type === 'no_activity_in_days') {
      if (rule.activityCode === 'GYM') {
        return {
          ok: (f.daysSinceLastStrength ?? 999) >= rule.days,
          vars,
          reason: `no GYM ${rule.days}d`,
        };
      }
      // можно расширить для других типов
      return { ok: false, vars };
    }

    if (rule.type === 'activity_present') {
      // просто: если за N дней есть хотя бы 1 тренировка activity
      const now = new Date();
      const from = new Date(now.getTime() - rule.days * 86400000);
      const c = await this.prisma.workout.count({
        where: {
          userId,
          startedAt: { gte: from },
          activityType: { code: rule.activityCode },
        },
      });
      return {
        ok: c > 0,
        vars,
        reason: `has ${rule.activityCode} in ${rule.days}d`,
      };
    }

    if (rule.type === 'run_load_increase_pct_gt') {
      const ok =
        (f.runLoadIncreasePct ?? 0) > rule.pct && (f.runLoadPrev ?? 0) > 0;
      return { ok, vars, reason: `runLoadIncreasePct>${rule.pct}` };
    }

    if (rule.type === 'plateau_metric') {
      const ok = !!f.plateauPace?.ok;
      return { ok, vars, reason: `plateau ${rule.metricKey}` };
    }

    if (rule.type === 'bmi_gte') {
      const ok = f.bmi != null && f.bmi >= rule.bmi;
      return { ok, vars, reason: `bmi>=${rule.bmi}` };
    }

    if (rule.type === 'no_streak_3') {
      const ok = (f.streakDays ?? 0) < 3;
      return { ok, vars, reason: `streak<3` };
    }

    return { ok: false, vars };
  }

  private humanizeReason(
    reason?: string | null,
    vars: any = {},
    templateCode?: string | null,
  ) {
    const daysSinceLastWorkout = Number(vars?.daysSinceLastWorkout ?? 0);
    const daysSinceLastStrength = Number(vars?.daysSinceLastStrength ?? 0);
    const workoutsLast7 = Number(vars?.workoutsLast7 ?? 0);
    const targetWeekly = Number(vars?.targetWeekly ?? 3);
    const bmi = vars?.bmi ?? '—';
    const loadIncreasePct = Number(
      vars?.loadIncreasePct ?? vars?.runLoadIncreasePct ?? 0,
    );
    const metricLabel = vars?.metricLabel ?? 'метрика';

    // Сначала опираемся на templateCode — он стабильнее и понятнее
    switch (templateCode) {
      case 'REC_INACTIVE_7D':
        return `У Вас был перерыв в тренировках около ${daysSinceLastWorkout} дн.`;

      case 'REC_INACTIVE_14D':
        return `У Вас была длительная пауза в тренировках — около ${daysSinceLastWorkout} дн.`;

      case 'REC_LOW_FREQ':
        return `За последние 7 дней у Вас ${workoutsLast7} тренировка(и). Рекомендованная цель — около ${targetWeekly} тренировок в неделю.`;

      case 'REC_STREAK_PUSH':
        return 'Сейчас ещё нет серии из 3 активных дней подряд.';

      case 'REC_RUN_LOAD_10':
        return `Беговой объём вырос слишком резко — примерно на ${loadIncreasePct}%.`;

      case 'REC_RUN_PLATEAU':
        return `Прогресс по метрике «${metricLabel}» в беге замедлился.`;

      case 'REC_RUN_EASY_DAY':
        return 'В последние недели у Вас уже были беговые тренировки — можно добавить лёгкий восстановительный день.';

      case 'REC_NO_STRENGTH_14D':
        return `Силовых тренировок не было около ${daysSinceLastStrength} дн.`;

      case 'REC_GYM_VOLUME':
        return 'У Вас есть силовые тренировки — рекомендация связана с постепенным набором тренировочного объёма.';

      case 'REC_BMI_HIGH':
        return `Индекс массы тела сейчас около ${bmi}, поэтому совет сфокусирован на мягком возвращении к регулярной активности.`;

      case 'REC_BMI_OVER':
        return `Индекс массы тела сейчас около ${bmi}, поэтому рекомендован аккуратный и стабильный режим нагрузки.`;

      case 'REC_SLEEP_WATER':
        return 'Это базовая рекомендация по восстановлению и общему самочувствию.';
    }

    // Фолбэк для старых/неожиданных причин
    if (!reason) {
      return 'Рекомендация подобрана на основе Вашей активности, профиля и недавних тренировок.';
    }

    if (reason === 'always') {
      return 'Это общая рекомендация для поддержания режима и восстановления.';
    }

    if (/^daysSinceLastWorkout>=\d+$/.test(reason)) {
      return `У Вас был перерыв в тренировках около ${daysSinceLastWorkout} дн.`;
    }

    if (/^workoutsLast7<\d+$/.test(reason)) {
      return `За последние 7 дней у Вас ${workoutsLast7} тренировка(и).`;
    }

    if (/^bmi>=\d+$/.test(reason)) {
      return `Индекс массы тела сейчас около ${bmi}.`;
    }

    if (reason === 'streak<3') {
      return 'Пока нет серии из 3 активных дней подряд.';
    }

    if (/^runLoadIncreasePct>\d+$/.test(reason)) {
      return `Беговой объём вырос слишком резко — примерно на ${loadIncreasePct}%.`;
    }

    if (reason.startsWith('plateau ')) {
      return `Прогресс по метрике «${metricLabel}» временно замедлился.`;
    }

    if (/^no GYM \d+d$/.test(reason)) {
      return `Силовых тренировок не было около ${daysSinceLastStrength} дн.`;
    }

    if (/^has [A-Z_]+ in \d+d$/.test(reason)) {
      return 'Рекомендация основана на Ваших недавних тренировках этого типа.';
    }

    return 'Рекомендация подобрана на основе Вашей активности, профиля и недавних тренировок.';
  }
}
