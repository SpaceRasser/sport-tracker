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
        placeholder: 'Жим лежа / Присед / Тяга…',
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
        label: 'Объем',
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
          { label: 'Легкая', value: 'easy' },
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
          { label: 'Нормально', value: 'ok' },
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
    title: 'Силовой объем 5000 кг',
    description: 'Сделать тренировочный объем ≥ 5000 кг за одну тренировку.',
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
      'Ты не тренировался уже {daysSinceLastWorkout} дней. Начни с легкой активности на 20-30 минут и спокойно вернись в ритм.',
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
      'Пауза уже {daysSinceLastWorkout} дней. На этой неделе лучше ограничиться 2 легкими тренировками и повышать нагрузку постепенно.',
    rule: {
      type: 'inactivity_days_gte',
      days: 14,
      cooldownDays: 7,
      priority: 98,
    },
  },
  {
    code: 'REC_LOW_FREQ',
    title: 'Частота важнее рывков',
    descriptionTemplate:
      'За последние 7 дней у тебя {workoutsLast7} тренировок. Попробуй выйти на ориентир около {targetWeekly} занятий в неделю без резких скачков.',
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
      'Попробуй собрать 3 активных дня подряд по 15-25 минут. Такой формат помогает закрепить привычку без перегруза.',
    rule: { type: 'no_streak_3', cooldownDays: 7, priority: 55 },
  },
  {
    code: 'REC_RUN_LOAD_10',
    title: 'Не повышай объем резко',
    descriptionTemplate:
      'Рост бегового объема за неделю составил {loadIncreasePct}%. Сейчас полезнее немного снизить темп роста и добавить восстановление.',
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
      'Похоже, прогресс по метрике {metricLabel} замедлился. Если самочувствие позволяет и нет ограничений, можно добавить одну вариативную беговую тренировку.',
    rule: {
      type: 'plateau_metric',
      activityCode: 'RUN',
      metricKey: 'avg_pace_min_km',
      days: 21,
      cooldownDays: 7,
      priority: 75,
      maxAge: 59,
      excludedLimitations: [
        'cardiovascular',
        'musculoskeletal',
        'respiratory',
        'neurological',
      ],
    },
  },
  {
    code: 'REC_RUN_EASY_DAY',
    title: 'Легкий день тоже полезен',
    descriptionTemplate:
      'В последние недели у тебя уже были беговые тренировки. Добавь легкую пробежку или быструю ходьбу в комфортном темпе для восстановления.',
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
    title: 'Добавь силовую базу',
    descriptionTemplate:
      'Силовой активности не было {daysSinceLastStrength} дней. Одна мягкая силовая тренировка в неделю помогает держать мышечный тонус и стабильность.',
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
    title: 'План по силовой нагрузке',
    descriptionTemplate:
      'Если работаешь в зале, повышай объем постепенно: 3-5 упражнений по 2-3 подхода уже дают хороший эффект без лишнего перегруза.',
    rule: {
      type: 'activity_present',
      activityCode: 'GYM',
      days: 30,
      cooldownDays: 14,
      priority: 40,
      maxAge: 59,
      excludedLimitations: ['musculoskeletal', 'neurological'],
    },
  },
  {
    code: 'REC_BMI_HIGH',
    title: 'Фокус на привычке',
    descriptionTemplate:
      'Текущий BMI около {bmi}. Сейчас лучше опираться на ходьбу, умеренное кардио и регулярность 3-4 раза в неделю, а не на высокую интенсивность.',
    rule: { type: 'bmi_gte', bmi: 30, cooldownDays: 14, priority: 85 },
  },
  {
    code: 'REC_BMI_OVER',
    title: 'Баланс нагрузки',
    descriptionTemplate:
      'BMI около {bmi}. Для прогресса сейчас полезнее стабильный режим и плавное увеличение нагрузки без резких пиков.',
    rule: { type: 'bmi_gte', bmi: 25, cooldownDays: 14, priority: 60 },
  },
  {
    code: 'REC_LIMIT_CARDIO',
    title: 'Ровный темп и контроль самочувствия',
    descriptionTemplate:
      'С учетом сердечно-сосудистых ограничений делай ставку на умеренную нагрузку, длинную разминку и плавное восстановление после занятий.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 96,
      requiredLimitations: ['cardiovascular'],
    },
  },
  {
    code: 'REC_LIMIT_JOINTS',
    title: 'Низкоударная активность',
    descriptionTemplate:
      'При ограничениях опорно-двигательной системы лучше выбирать ходьбу, йогу, плавание или мягкие упражнения на мобильность без резких ударных нагрузок.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 94,
      requiredLimitations: ['musculoskeletal'],
    },
  },
  {
    code: 'REC_LIMIT_RESP',
    title: 'Постепенное наращивание дыхательной нагрузки',
    descriptionTemplate:
      'При дыхательных ограничениях полезнее короткие и ровные тренировки с комфортным темпом, чем резкие ускорения и интервалы.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 93,
      requiredLimitations: ['respiratory'],
    },
  },
  {
    code: 'REC_LIMIT_METABOLIC',
    title: 'Регулярность важнее максимума',
    descriptionTemplate:
      'При метаболических ограничениях обычно лучше работает стабильная схема: умеренная активность несколько раз в неделю и ежедневная ходьба.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 88,
      requiredLimitations: ['metabolic'],
    },
  },
  {
    code: 'REC_LIMIT_NEURO',
    title: 'Безопасный и предсказуемый режим',
    descriptionTemplate:
      'При неврологических ограничениях лучше выбирать понятные, устойчивые по темпу тренировки и избегать сложных или резко интенсивных сценариев.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 92,
      requiredLimitations: ['neurological'],
    },
  },
  {
    code: 'REC_AGE_40_59',
    title: 'Восстановление тоже часть прогресса',
    descriptionTemplate:
      'В возрасте {age} лет результат лучше растет на сочетании регулярности, умеренной интенсивности и полноценного восстановления между нагрузками.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 72,
      minAge: 40,
      maxAge: 59,
    },
  },
  {
    code: 'REC_AGE_60_PLUS',
    title: 'Умеренная нагрузка с запасом',
    descriptionTemplate:
      'В возрасте {age} лет делай ставку на умеренную активность 2-4 раза в неделю, больше времени на разминку и аккуратное восстановление.',
    rule: {
      type: 'always',
      cooldownDays: 14,
      priority: 91,
      minAge: 60,
    },
  },
  {
    code: 'REC_SLEEP_WATER',
    title: 'База восстановления',
    descriptionTemplate:
      'Совет дня: сон 7-9 часов, вода и спокойное восстановление после нагрузки. Без этой базы прогресс обычно идет медленнее.',
    rule: { type: 'always', cooldownDays: 3, priority: 10 },
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in backend/api/.env');
  }

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  const sqlActivities = `
    INSERT INTO "activity_types" ("id","code","name","fields_schema","created_at","updated_at")
    VALUES (gen_random_uuid(), $1, $2, $3::jsonb, now(), now())
    ON CONFLICT ("code")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "fields_schema" = EXCLUDED."fields_schema",
      "updated_at" = now();
  `;

  for (const activity of activities) {
    await client.query(sqlActivities, [
      activity.code,
      activity.name,
      JSON.stringify({ fields: activity.fields }),
    ]);
  }

  const sqlAchievements = `
    INSERT INTO "achievements" ("id","code","title","description","rule","created_at")
    VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, now())
    ON CONFLICT ("code")
    DO UPDATE SET
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "rule" = EXCLUDED."rule";
  `;

  for (const achievement of achievements) {
    await client.query(sqlAchievements, [
      achievement.code,
      achievement.title,
      achievement.description,
      JSON.stringify(achievement.rule),
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

  for (const recommendation of recommendations) {
    await client.query(sqlRecs, [
      recommendation.code,
      recommendation.title,
      recommendation.descriptionTemplate,
      JSON.stringify(recommendation.rule),
    ]);
  }

  await client.end();

  console.log(`Seeded activity_types: ${activities.length}`);
  console.log(`Seeded achievements: ${achievements.length}`);
  console.log(`Seeded recommendation_templates: ${recommendations.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
