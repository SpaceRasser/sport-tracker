import 'dotenv/config';
import { Client } from 'pg';

type Field = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  min?: number;
  max?: number;
  unit?: string;
  step?: number;
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
};

type ActivitySeed = {
  code: string;
  name: string;
  fields: Field[];
};

type AchievementSeed = {
  code: string;
  title: string;
  description: string;
  rule: any;
};

const activities: ActivitySeed[] = [
  {
    code: 'RUN',
    name: 'Бег',
    fields: [
      {
        key: 'distance_km',
        label: 'Дистанция',
        type: 'number',
        min: 0,
        step: 0.01,
        unit: 'км',
        required: true,
      },
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
        required: true,
      },
      {
        key: 'avg_pace_min_km',
        label: 'Темп',
        type: 'number',
        min: 0,
        step: 0.01,
        unit: 'мин/км',
      },
      {
        key: 'calories',
        label: 'Калории',
        type: 'number',
        min: 0,
        unit: 'ккал',
      },
    ],
  },
  {
    code: 'WALK',
    name: 'Ходьба',
    fields: [
      { key: 'steps', label: 'Шаги', type: 'number', min: 0, unit: 'шаг' },
      {
        key: 'distance_km',
        label: 'Дистанция',
        type: 'number',
        min: 0,
        step: 0.01,
        unit: 'км',
      },
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
      },
      {
        key: 'calories',
        label: 'Калории',
        type: 'number',
        min: 0,
        unit: 'ккал',
      },
    ],
  },
  {
    code: 'BIKE',
    name: 'Велосипед',
    fields: [
      {
        key: 'distance_km',
        label: 'Дистанция',
        type: 'number',
        min: 0,
        step: 0.01,
        unit: 'км',
        required: true,
      },
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
        required: true,
      },
      {
        key: 'avg_speed_kmh',
        label: 'Средняя скорость',
        type: 'number',
        min: 0,
        step: 0.1,
        unit: 'км/ч',
      },
      {
        key: 'elevation_m',
        label: 'Набор высоты',
        type: 'number',
        min: 0,
        unit: 'м',
      },
    ],
  },
  {
    code: 'SWIM',
    name: 'Плавание',
    fields: [
      {
        key: 'distance_m',
        label: 'Дистанция',
        type: 'number',
        min: 0,
        unit: 'м',
        required: true,
      },
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
        required: true,
      },
      {
        key: 'pool_length_m',
        label: 'Длина бассейна',
        type: 'select',
        options: [
          { label: '25 м', value: '25' },
          { label: '50 м', value: '50' },
          { label: 'Другое', value: 'custom' },
        ],
      },
    ],
  },
  {
    code: 'GYM',
    name: 'Зал (силовая)',
    fields: [
      {
        key: 'exercise',
        label: 'Упражнение',
        type: 'text',
        placeholder: 'Жим лёжа / Присед / Тяга…',
      },
      { key: 'sets', label: 'Подходы', type: 'number', min: 0, unit: 'шт' },
      { key: 'reps', label: 'Повторы', type: 'number', min: 0, unit: 'шт' },
      {
        key: 'weight_kg',
        label: 'Вес',
        type: 'number',
        min: 0,
        step: 0.5,
        unit: 'кг',
      },
      {
        key: 'volume_kg',
        label: 'Объём',
        type: 'number',
        min: 0,
        step: 0.5,
        unit: 'кг',
      },
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
      },
    ],
  },
  {
    code: 'HIIT',
    name: 'Интервальная (HIIT)',
    fields: [
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
        required: true,
      },
      { key: 'rounds', label: 'Раунды', type: 'number', min: 0, unit: 'шт' },
      { key: 'work_sec', label: 'Работа', type: 'number', min: 0, unit: 'сек' },
      { key: 'rest_sec', label: 'Отдых', type: 'number', min: 0, unit: 'сек' },
      {
        key: 'calories',
        label: 'Калории',
        type: 'number',
        min: 0,
        unit: 'ккал',
      },
    ],
  },
  {
    code: 'YOGA',
    name: 'Йога / Растяжка',
    fields: [
      {
        key: 'duration_sec',
        label: 'Длительность',
        type: 'number',
        min: 0,
        unit: 'сек',
        required: true,
      },
      {
        key: 'intensity',
        label: 'Интенсивность',
        type: 'select',
        options: [
          { label: 'Лёгкая', value: 'easy' },
          { label: 'Средняя', value: 'medium' },
          { label: 'Высокая', value: 'hard' },
        ],
      },
      {
        key: 'mood',
        label: 'Самочувствие',
        type: 'select',
        options: [
          { label: 'Плохо', value: 'bad' },
          { label: 'Норм', value: 'ok' },
          { label: 'Отлично', value: 'great' },
        ],
      },
    ],
  },
];

const achievements: AchievementSeed[] = [
  {
    code: 'RUN_FIRST',
    title: 'Первая пробежка',
    description: 'Ты добавил первую тренировку бега.',
    rule: { type: 'first_workout', activityCode: 'RUN' },
  },
  {
    code: 'RUN_5K',
    title: '5 км за тренировку',
    description: 'Пробежать 5 км за одну тренировку.',
    rule: {
      type: 'metric_gte',
      activityCode: 'RUN',
      metricKey: 'distance_km',
      threshold: 5,
    },
  },
  {
    code: 'RUN_10K',
    title: '10 км за тренировку',
    description: 'Пробежать 10 км за одну тренировку.',
    rule: {
      type: 'metric_gte',
      activityCode: 'RUN',
      metricKey: 'distance_km',
      threshold: 10,
    },
  },
  {
    code: 'RUN_3_IN_WEEK',
    title: 'Три пробежки за неделю',
    description: 'Сделать 3 беговые тренировки за последние 7 дней.',
    rule: {
      type: 'count_in_days_gte',
      activityCode: 'RUN',
      days: 7,
      threshold: 3,
    },
  },
  {
    code: 'GYM_FIRST',
    title: 'Первый зал',
    description: 'Ты добавил первую силовую тренировку.',
    rule: { type: 'first_workout', activityCode: 'GYM' },
  },
  {
    code: 'GYM_VOLUME_5000',
    title: 'Силовой объём 5000 кг',
    description: 'Сделать тренировочный объём ≥ 5000 кг за одну тренировку.',
    rule: {
      type: 'metric_gte',
      activityCode: 'GYM',
      metricKey: 'volume_kg',
      threshold: 5000,
    },
  },
  {
    code: 'WORKOUTS_10',
    title: '10 тренировок',
    description: 'Добавить 10 тренировок всего.',
    rule: { type: 'total_workouts_gte', threshold: 10 },
  },
  {
    code: 'STREAK_7D',
    title: 'Стрик 7 дней',
    description: '7 дней подряд — минимум 1 тренировка в день.',
    rule: { type: 'daily_streak_gte', days: 7 },
  },
];

const recommendations = [
  {
    code: 'REC_INACTIVE_7D',
    title: 'Вернись в режим',
    descriptionTemplate:
      'Ты не тренировался уже {daysSinceLastWorkout} дней. Начни с лёгкой тренировки на 20–30 минут.',
    rule: {
      type: 'inactivity_days_gte',
      days: 7,
      cooldownDays: 3,
      priority: 95,
    },
  },
  {
    code: 'REC_INACTIVE_14D',
    title: 'Мягкий возврат',
    descriptionTemplate:
      'Пауза {daysSinceLastWorkout} дней — начни с 2 лёгких тренировок на этой неделе и постепенно увеличивай нагрузку.',
    rule: {
      type: 'inactivity_days_gte',
      days: 14,
      cooldownDays: 7,
      priority: 98,
    },
  },
  {
    code: 'REC_LOW_FREQ',
    title: 'Частота — ключ',
    descriptionTemplate:
      'За последние 7 дней у тебя {workoutsLast7} тренировок. Попробуй цель: {targetWeekly} тренировки в неделю.',
    rule: {
      type: 'workouts_in_days_lt',
      days: 7,
      threshold: 2,
      cooldownDays: 5,
      priority: 80,
    },
  },
  {
    code: 'REC_STREAK_PUSH',
    title: 'Сделай серию',
    descriptionTemplate:
      'Попробуй сделать стрик 3 дня: 3 дня подряд по 15–25 минут активности. Это повышает регулярность.',
    rule: { type: 'no_streak_3', cooldownDays: 7, priority: 55 },
  },
  {
    code: 'REC_RUN_LOAD_10',
    title: 'Не повышай объём резко',
    descriptionTemplate:
      'Рост бегового объёма за неделю {loadIncreasePct}% (норма ≤ 10%). Снизь объём или добавь восстановление.',
    rule: {
      type: 'run_load_increase_pct_gt',
      days: 7,
      pct: 10,
      cooldownDays: 7,
      priority: 90,
    },
  },
  {
    code: 'REC_RUN_PLATEAU',
    title: 'Стагнация в беге',
    descriptionTemplate:
      'Похоже, прогресс по {metricLabel} застопорился. Попробуй 1 интервальную тренировку на этой неделе.',
    rule: {
      type: 'plateau_metric',
      activityCode: 'RUN',
      metricKey: 'avg_pace_min_km',
      days: 21,
      cooldownDays: 7,
      priority: 75,
    },
  },
  {
    code: 'REC_RUN_EASY_DAY',
    title: 'Лёгкий день — тоже тренировка',
    descriptionTemplate:
      'Добавь лёгкую пробежку 20–30 минут в зоне комфорта — это улучшает восстановление и базу.',
    rule: {
      type: 'activity_present',
      activityCode: 'RUN',
      days: 14,
      cooldownDays: 10,
      priority: 45,
    },
  },
  {
    code: 'REC_NO_STRENGTH_14D',
    title: 'Добавь силовую',
    descriptionTemplate:
      'Силовой не было {daysSinceLastStrength} дней. 1 силовая в неделю поможет прогрессу и снизит риск травм.',
    rule: {
      type: 'no_activity_in_days',
      activityCode: 'GYM',
      days: 14,
      cooldownDays: 7,
      priority: 70,
    },
  },
  {
    code: 'REC_GYM_VOLUME',
    title: 'План по объёму',
    descriptionTemplate:
      'Для силы и формы попробуй 3–5 упражнений по 3 подхода. Следи за техникой и постепенным ростом объёма.',
    rule: {
      type: 'activity_present',
      activityCode: 'GYM',
      days: 30,
      cooldownDays: 14,
      priority: 40,
    },
  },
  {
    code: 'REC_BMI_HIGH',
    title: 'Фокус на привычки',
    descriptionTemplate:
      'Твой BMI примерно {bmi}. Начни с ходьбы/лёгкого кардио 3 раза в неделю + контроль калорий и белка.',
    rule: { type: 'bmi_gte', bmi: 30, cooldownDays: 14, priority: 85 },
  },
  {
    code: 'REC_BMI_OVER',
    title: 'Баланс нагрузки',
    descriptionTemplate:
      'BMI около {bmi}. Старайся держать регулярность и не повышать нагрузку резко — лучше стабильность.',
    rule: { type: 'bmi_gte', bmi: 25, cooldownDays: 14, priority: 60 },
  },
  {
    code: 'REC_SLEEP_WATER',
    title: 'База восстановления',
    descriptionTemplate:
      'Совет дня: сон 7–9 часов и вода. Восстановление = прогресс. Особенно после тяжёлых тренировок.',
    rule: { type: 'always', cooldownDays: 3, priority: 10 },
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is not set in backend/api/.env');

  const client = new Client({ connectionString });
  await client.connect();

  // UUID helper: pgcrypto for gen_random_uuid()
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // --- activity_types upsert ---
  const sqlActivities = `
    INSERT INTO "activity_types" ("id","code","name","fields_schema","created_at","updated_at")
    VALUES (gen_random_uuid(), $1, $2, $3::jsonb, now(), now())
    ON CONFLICT ("code")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "fields_schema" = EXCLUDED."fields_schema",
      "updated_at" = now();
  `;

  for (const a of activities) {
    const fieldsSchema = JSON.stringify({ fields: a.fields });
    await client.query(sqlActivities, [a.code, a.name, fieldsSchema]);
  }

  // --- achievements upsert ---
  const sqlAchievements = `
    INSERT INTO "achievements" ("id","code","title","description","rule","created_at")
    VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, now())
    ON CONFLICT ("code")
    DO UPDATE SET
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "rule" = EXCLUDED."rule";
  `;

  for (const a of achievements) {
    await client.query(sqlAchievements, [
      a.code,
      a.title,
      a.description,
      JSON.stringify(a.rule),
    ]);
  }

  const sqlRecs = `
  INSERT INTO "recommendation_templates" ("id","code","title","description","rule","active","created_at")
  VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, true, now())
  ON CONFLICT ("code")
  DO UPDATE SET
    "title" = EXCLUDED."title",
    "description" = EXCLUDED."description",
    "rule" = EXCLUDED."rule",
    "active" = true;
`;

  for (const r of recommendations) {
    await client.query(sqlRecs, [
      r.code,
      r.title,
      r.descriptionTemplate,
      JSON.stringify(r.rule),
    ]);
  }

  await client.end();

  console.log(`Seeded activity_types: ${activities.length}`);
  console.log(`Seeded achievements: ${achievements.length}`);
  console.log(`Seeded recommendation_templates: ${recommendations.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
