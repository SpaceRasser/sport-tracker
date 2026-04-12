import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

type HealthLimitation =
  | 'cardiovascular'
  | 'musculoskeletal'
  | 'respiratory'
  | 'metabolic'
  | 'neurological';

type AgeGroup = 'under_18' | '18_39' | '40_59' | '60_plus';

type RuleConstraint = {
  cooldownDays?: number;
  priority?: number;
  minAge?: number;
  maxAge?: number;
  ageGroups?: AgeGroup[];
  requiredLimitations?: HealthLimitation[];
  excludedLimitations?: HealthLimitation[];
};

type Rule =
  | ({ type: 'always' } & RuleConstraint)
  | ({ type: 'inactivity_days_gte'; days: number } & RuleConstraint)
  | ({ type: 'workouts_in_days_lt'; days: number; threshold: number } & RuleConstraint)
  | ({ type: 'no_activity_in_days'; activityCode: string; days: number } & RuleConstraint)
  | ({ type: 'activity_present'; activityCode: string; days: number } & RuleConstraint)
  | ({ type: 'run_load_increase_pct_gt'; days: number; pct: number } & RuleConstraint)
  | ({
      type: 'plateau_metric';
      activityCode: string;
      metricKey: string;
      days: number;
    } & RuleConstraint)
  | ({ type: 'bmi_gte'; bmi: number } & RuleConstraint)
  | ({ type: 'no_streak_3' } & RuleConstraint);

type RecommendationFeatures = {
  age: number | null;
  ageGroup: AgeGroup | null;
  bmi: number | null;
  heightCm: number | null;
  weightKg: number | null;
  totalWorkouts: number;
  workoutsLast7: number;
  daysSinceLastWorkout: number;
  daysSinceLastStrength: number;
  streakDays: number;
  runLoadIncreasePct: number;
  runLoadLast: number;
  runLoadPrev: number;
  plateauPace: { ok: boolean; delta: number | null; metricLabel?: string };
  targetWeekly: number;
  metricLabel: string;
  healthLimitations: HealthLimitation[];
  healthLimitationsLabel: string;
};

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

function calculateAge(birthdate?: Date | null) {
  if (!birthdate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() &&
      today.getDate() >= birthdate.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

function resolveAgeGroup(age: number | null): AgeGroup | null {
  if (age == null) return null;
  if (age < 18) return 'under_18';
  if (age < 40) return '18_39';
  if (age < 60) return '40_59';
  return '60_plus';
}

function limitationLabel(value: HealthLimitation) {
  switch (value) {
    case 'cardiovascular':
      return 'сердечно-сосудистые';
    case 'musculoskeletal':
      return 'опорно-двигательные';
    case 'respiratory':
      return 'дыхательные';
    case 'metabolic':
      return 'метаболические';
    case 'neurological':
      return 'неврологические';
  }
}

function limitationLabels(values: HealthLimitation[]) {
  if (!values.length) return 'не указаны';
  return values.map(limitationLabel).join(', ');
}

function resolveTargetWeekly(
  age: number | null,
  healthLimitations: HealthLimitation[],
) {
  let target = 3;

  if (age != null && age >= 60) {
    target = 2;
  }

  if (
    healthLimitations.some((item) =>
      ['cardiovascular', 'respiratory', 'neurological'].includes(item),
    )
  ) {
    target = Math.min(target, 2);
  }

  return target;
}

@Injectable()
export class RecommendationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async getForUser(userId: string) {
    const features = await this.computeFeatures(userId);

    const templates = await this.prisma.recommendationTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        rule: true,
      },
    });

    const existing = await this.prisma.userRecommendation.findMany({
      where: { userId },
      select: {
        id: true,
        templateId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const lastByTemplate = new Map<string, Date>();
    for (const item of existing) {
      if (!lastByTemplate.has(item.templateId)) {
        lastByTemplate.set(item.templateId, item.createdAt);
      }
    }

    const now = new Date();
    const createdIds: string[] = [];
    const scored: Array<{
      tplId: string;
      code: string;
      title: string;
      text: string;
      priority: number;
      meta: any;
    }> = [];

    for (const template of templates) {
      const rule = (template.rule ?? {}) as Rule;
      const check = await this.checkRule(userId, rule, features);
      if (!check.ok) continue;

      const cooldownDays = Number(rule.cooldownDays ?? 7);
      const priority = Number(rule.priority ?? 50);
      const last = lastByTemplate.get(template.id);

      if (last && daysBetween(last, now) < cooldownDays) {
        continue;
      }

      scored.push({
        tplId: template.id,
        code: template.code,
        title: template.title,
        text: renderTemplate(template.description, check.vars),
        priority,
        meta: {
          vars: check.vars,
          reason: check.reason,
          templateCode: template.code,
        },
      });
    }

    scored.sort((a, b) => b.priority - a.priority);

    for (const recommendation of scored.slice(0, 5)) {
      const created = await this.prisma.userRecommendation.create({
        data: {
          userId,
          templateId: recommendation.tplId,
          meta: recommendation.meta,
        },
        select: { id: true },
      });
      createdIds.push(created.id);
    }

    if (createdIds.length > 0) {
      const settings =
        (await this.prisma.notificationSettings.findUnique({
          where: { userId },
        })) ??
        (await this.prisma.notificationSettings.create({ data: { userId } }));

      if (settings.enabled && settings.recommendationsEnabled) {
        const last = settings.lastRecommendationsSentAt;
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (!last || now.getTime() - last.getTime() >= oneDayMs) {
          await this.push.sendToUser(userId, {
            title: 'Новые советы',
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

    const items = rows.map((row) => {
      const meta = (row.meta as any) ?? {};
      const vars = meta?.vars ?? {};

      return {
        id: row.id,
        createdAt: row.createdAt,
        dismissedAt: row.dismissedAt,
        template: {
          id: row.template.id,
          code: row.template.code,
          title: row.template.title,
        },
        text: meta?.vars
          ? renderTemplate(row.template.description, vars)
          : row.template.description,
        reason: this.humanizeReason(meta?.reason, vars, meta?.templateCode),
      };
    });

    return {
      items,
      created: createdIds.length,
      features,
    };
  }

  async dismiss(userId: string, id: string) {
    const recommendation = await this.prisma.userRecommendation.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!recommendation) return { ok: true };

    await this.prisma.userRecommendation.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });

    return { ok: true };
  }

  private async computeFeatures(userId: string): Promise<RecommendationFeatures> {
    const now = new Date();

    const [profile, lastWorkout, totalWorkouts] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: {
          birthdate: true,
          heightCm: true,
          weightKg: true,
          healthLimitations: true,
        },
      }),
      this.prisma.workout.findFirst({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      this.prisma.workout.count({ where: { userId } }),
    ]);

    const heightCm = profile?.heightCm ?? null;
    const weightKg = profile?.weightKg != null ? Number(profile.weightKg) : null;
    const age = calculateAge(profile?.birthdate);
    const ageGroup = resolveAgeGroup(age);
    const healthLimitations = (profile?.healthLimitations ??
      []) as HealthLimitation[];

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

    const lastStrength = await this.prisma.workout.findFirst({
      where: { userId, activityType: { code: 'GYM' } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });

    const daysSinceLastStrength = lastStrength?.startedAt
      ? daysBetween(lastStrength.startedAt, now)
      : 999;

    let streak = 0;
    for (let i = 0; i < 14; i += 1) {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const to = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i + 1,
      );

      const count = await this.prisma.workout.count({
        where: { userId, startedAt: { gte: from, lt: to } },
      });

      if (count > 0) streak += 1;
      else break;
    }

    const runLoad = await this.runLoadIncreasePct(userId, 7);
    const plateau = await this.plateauMetric(
      userId,
      'RUN',
      'avg_pace_min_km',
      21,
    );

    return {
      age,
      ageGroup,
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
      plateauPace: plateau,
      targetWeekly: resolveTargetWeekly(age, healthLimitations),
      metricLabel: 'темп',
      healthLimitations,
      healthLimitationsLabel: limitationLabels(healthLimitations),
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

      return rows.reduce((acc, row) => acc + Number(row.valueNum), 0);
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

    const avgForRange = async (start: Date, end: Date) => {
      const rows = await this.prisma.workoutMetric.findMany({
        where: {
          metricKey,
          workout: {
            userId,
            activityType: { code: activityCode },
            startedAt: { gte: start, lt: end },
          },
        },
        select: { valueNum: true },
      });

      if (!rows.length) return null;

      const sum = rows.reduce((acc, row) => acc + Number(row.valueNum), 0);
      return sum / rows.length;
    };

    const recent = await avgForRange(mid, now);
    const older = await avgForRange(from, mid);

    if (recent == null || older == null) {
      return { ok: false, delta: null };
    }

    const delta = round1(recent - older);
    return { ok: delta >= -0.05, delta, metricLabel: 'темп' };
  }

  private passesConstraints(rule: RuleConstraint, features: RecommendationFeatures) {
    if (typeof rule.minAge === 'number') {
      if (features.age == null || features.age < rule.minAge) return false;
    }

    if (typeof rule.maxAge === 'number') {
      if (features.age == null || features.age > rule.maxAge) return false;
    }

    if (rule.ageGroups?.length) {
      if (!features.ageGroup || !rule.ageGroups.includes(features.ageGroup)) {
        return false;
      }
    }

    if (rule.requiredLimitations?.length) {
      const hasRequired = rule.requiredLimitations.some((item) =>
        features.healthLimitations.includes(item),
      );

      if (!hasRequired) return false;
    }

    if (rule.excludedLimitations?.length) {
      const hasExcluded = rule.excludedLimitations.some((item) =>
        features.healthLimitations.includes(item),
      );

      if (hasExcluded) return false;
    }

    return true;
  }

  private async countWorkoutsInDays(userId: string, days: number) {
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);

    return this.prisma.workout.count({
      where: {
        userId,
        startedAt: { gte: from },
      },
    });
  }

  private async checkRule(
    userId: string,
    rule: Rule,
    features: RecommendationFeatures,
  ): Promise<{ ok: boolean; vars: any; reason?: string }> {
    const vars = {
      ...features,
      age: features.age ?? '—',
      bmi: features.bmi ?? '—',
      workoutsLast7: features.workoutsLast7 ?? 0,
      daysSinceLastWorkout: features.daysSinceLastWorkout ?? 0,
      daysSinceLastStrength: features.daysSinceLastStrength ?? 0,
      targetWeekly: features.targetWeekly ?? 3,
      loadIncreasePct: features.runLoadIncreasePct ?? 0,
      metricLabel: features.plateauPace?.metricLabel ?? 'метрика',
      healthLimitationsLabel: features.healthLimitationsLabel,
    };

    if (!this.passesConstraints(rule, features)) {
      return { ok: false, vars };
    }

    switch (rule.type) {
      case 'always':
        return { ok: true, vars, reason: 'always' };

      case 'inactivity_days_gte':
        return {
          ok: features.daysSinceLastWorkout >= rule.days,
          vars,
          reason: `daysSinceLastWorkout>=${rule.days}`,
        };

      case 'workouts_in_days_lt': {
        const count =
          rule.days === 7
            ? features.workoutsLast7
            : await this.countWorkoutsInDays(userId, rule.days);

        return {
          ok: count < rule.threshold,
          vars: { ...vars, workoutsWindow: count },
          reason: `workoutsIn${rule.days}<${rule.threshold}`,
        };
      }

      case 'no_activity_in_days':
        if (rule.activityCode === 'GYM') {
          return {
            ok: features.daysSinceLastStrength >= rule.days,
            vars,
            reason: `no ${rule.activityCode} ${rule.days}d`,
          };
        }

        return { ok: false, vars };

      case 'activity_present': {
        const now = new Date();
        const from = new Date(now.getTime() - rule.days * 86400000);
        const count = await this.prisma.workout.count({
          where: {
            userId,
            startedAt: { gte: from },
            activityType: { code: rule.activityCode },
          },
        });

        return {
          ok: count > 0,
          vars,
          reason: `has ${rule.activityCode} in ${rule.days}d`,
        };
      }

      case 'run_load_increase_pct_gt':
        return {
          ok:
            features.runLoadIncreasePct > rule.pct && features.runLoadPrev > 0,
          vars,
          reason: `runLoadIncreasePct>${rule.pct}`,
        };

      case 'plateau_metric':
        return {
          ok: !!features.plateauPace?.ok,
          vars,
          reason: `plateau ${rule.metricKey}`,
        };

      case 'bmi_gte':
        return {
          ok: features.bmi != null && features.bmi >= rule.bmi,
          vars,
          reason: `bmi>=${rule.bmi}`,
        };

      case 'no_streak_3':
        return {
          ok: features.streakDays < 3,
          vars,
          reason: 'streak<3',
        };
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
    const age = vars?.age ?? '—';
    const loadIncreasePct = Number(
      vars?.loadIncreasePct ?? vars?.runLoadIncreasePct ?? 0,
    );
    const metricLabel = vars?.metricLabel ?? 'метрика';
    const healthLimitationsLabel = vars?.healthLimitationsLabel ?? 'не указаны';

    switch (templateCode) {
      case 'REC_INACTIVE_7D':
        return `Перерыв в тренировках уже около ${daysSinceLastWorkout} дней.`;
      case 'REC_INACTIVE_14D':
        return `Пауза в тренировках уже около ${daysSinceLastWorkout} дней.`;
      case 'REC_LOW_FREQ':
        return `За последние 7 дней выполнено ${workoutsLast7} тренировок при ориентире около ${targetWeekly} в неделю.`;
      case 'REC_STREAK_PUSH':
        return 'Пока нет серии из 3 активных дней подряд.';
      case 'REC_RUN_LOAD_10':
        return `Беговой объем вырос примерно на ${loadIncreasePct}%, поэтому полезно чуть снизить темп роста.`;
      case 'REC_RUN_PLATEAU':
        return `Прогресс по метрике «${metricLabel}» в беге замедлился.`;
      case 'REC_RUN_EASY_DAY':
        return 'Недавние беговые тренировки уже есть, можно добавить легкое восстановление.';
      case 'REC_NO_STRENGTH_14D':
        return `Силовых тренировок не было около ${daysSinceLastStrength} дней.`;
      case 'REC_GYM_VOLUME':
        return 'Есть база по силовым тренировкам, поэтому можно планировать аккуратный рост нагрузки.';
      case 'REC_BMI_HIGH':
      case 'REC_BMI_OVER':
        return `Текущий индекс массы тела около ${bmi}, поэтому совет сфокусирован на умеренной и регулярной активности.`;
      case 'REC_LIMIT_CARDIO':
        return `В профиле отмечены ${healthLimitationsLabel} ограничения, поэтому приоритет отдан ровной и контролируемой нагрузке.`;
      case 'REC_LIMIT_JOINTS':
        return `В профиле отмечены ${healthLimitationsLabel} ограничения, поэтому совет опирается на низкоударные форматы активности.`;
      case 'REC_LIMIT_RESP':
        return `В профиле отмечены ${healthLimitationsLabel} ограничения, поэтому нагрузку лучше наращивать особенно постепенно.`;
      case 'REC_LIMIT_METABOLIC':
        return `В профиле отмечены ${healthLimitationsLabel} ограничения, поэтому важна стабильная регулярность без резких скачков.`;
      case 'REC_LIMIT_NEURO':
        return `В профиле отмечены ${healthLimitationsLabel} ограничения, поэтому акцент смещен на безопасный и предсказуемый формат занятий.`;
      case 'REC_AGE_40_59':
        return `Возрастная группа ${age} лет учитывается в совете через акцент на восстановление и плавный рост нагрузки.`;
      case 'REC_AGE_60_PLUS':
        return `Возраст ${age} лет учитывается в совете через умеренную интенсивность и дополнительное внимание к восстановлению.`;
      case 'REC_SLEEP_WATER':
        return 'Это базовый совет по восстановлению и общему самочувствию.';
    }

    if (!reason || reason === 'always') {
      return 'Рекомендация подобрана на основе профиля пользователя и недавней активности.';
    }

    if (/^daysSinceLastWorkout>=\d+$/.test(reason)) {
      return `Перерыв в тренировках уже около ${daysSinceLastWorkout} дней.`;
    }

    if (/^workoutsIn\d+<\d+$/.test(reason)) {
      return `За последние 7 дней выполнено ${workoutsLast7} тренировок.`;
    }

    if (/^bmi>=\d+$/.test(reason)) {
      return `Текущий индекс массы тела около ${bmi}.`;
    }

    if (reason === 'streak<3') {
      return 'Пока нет серии из 3 активных дней подряд.';
    }

    if (/^runLoadIncreasePct>\d+$/.test(reason)) {
      return `Беговой объем вырос примерно на ${loadIncreasePct}%.`;
    }

    if (reason.startsWith('plateau ')) {
      return `Прогресс по метрике «${metricLabel}» временно замедлился.`;
    }

    if (/^no GYM \d+d$/.test(reason)) {
      return `Силовых тренировок не было около ${daysSinceLastStrength} дней.`;
    }

    if (/^has [A-Z_]+ in \d+d$/.test(reason)) {
      return 'Рекомендация связана с недавними тренировками этого типа.';
    }

    return 'Рекомендация подобрана на основе профиля пользователя и недавней активности.';
  }
}
