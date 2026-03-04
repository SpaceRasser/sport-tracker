// mobile/src/integrations/healthConnect.ts
import {
  initialize,
  requestPermission,
  readRecords,
  ExerciseType,
} from 'react-native-health-connect';

type Iso = string;

export type HCExerciseSession = {
  uuid: string;
  startTime: Iso;
  endTime: Iso;
  exerciseType: number;
  title?: string;
  notes?: string;
};

export type HCSummary = {
  distanceKm?: number;
  steps?: number;
  caloriesKcal?: number;
};

export async function hcInit() {
  // В большинстве случаев просто initialize() достаточно
  await initialize();
}

export async function hcRequestPermissions() {
  // Запрашиваем минимально нужное (чтение)
  // recordType строки — как в библиотеке: ExerciseSession, Distance, Steps, ActiveCaloriesBurned :contentReference[oaicite:1]{index=1}
  return requestPermission([
    { accessType: 'read', recordType: 'ExerciseSession' },
    { accessType: 'read', recordType: 'Distance' },
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  ]);
}

export async function hcReadExerciseSessions(fromIso: string, toIso: string): Promise<HCExerciseSession[]> {
  const res: any = await readRecords('ExerciseSession', {
    timeRangeFilter: {
      operator: 'between',
      startTime: fromIso,
      endTime: toIso,
    },
    // сортировка/лимит в разных версиях может отличаться — поэтому просто читаем диапазон
  });

  const records: any[] = res?.records ?? res ?? [];
  return records.map((r) => ({
    uuid: r.metadata?.id ?? r.uuid ?? r.metadata?.uuid ?? r.id,
    startTime: r.startTime,
    endTime: r.endTime,
    exerciseType: r.exerciseType,
    title: r.title,
    notes: r.notes,
  }));
}

function sumDistanceKm(distanceRecords: any[]): number | undefined {
  // DistanceRecord.distance обычно объект Length с unit/values, в либе часто приходит { inMeters: number } или { meters: number }
  let meters = 0;
  for (const r of distanceRecords) {
    const d = r.distance;
    if (!d) continue;
    if (typeof d.inMeters === 'number') meters += d.inMeters;
    else if (typeof d.meters === 'number') meters += d.meters;
    else if (typeof d.value === 'number' && (d.unit === 'm' || d.unit === 'meter')) meters += d.value;
  }
  if (meters <= 0) return undefined;
  return Math.round((meters / 1000) * 100) / 100;
}

function sumSteps(stepRecords: any[]): number | undefined {
  let steps = 0;
  for (const r of stepRecords) {
    const c = r.count;
    if (typeof c === 'number') steps += c;
  }
  return steps > 0 ? steps : undefined;
}

function sumCaloriesKcal(calRecords: any[]): number | undefined {
  // ActiveCaloriesBurnedRecord.energy часто приходит как { inKilocalories: number } :contentReference[oaicite:2]{index=2}
  let kcal = 0;
  for (const r of calRecords) {
    const e = r.energy;
    if (!e) continue;
    if (typeof e.inKilocalories === 'number') kcal += e.inKilocalories;
    else if (typeof e.kilocalories === 'number') kcal += e.kilocalories;
  }
  if (kcal <= 0) return undefined;
  return Math.round(kcal);
}

export async function hcReadSummaryForRange(fromIso: string, toIso: string): Promise<HCSummary> {
  const [distRes, stepsRes, calRes] = await Promise.allSettled([
    readRecords('Distance', {
      timeRangeFilter: { operator: 'between', startTime: fromIso, endTime: toIso },
    }),
    readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: fromIso, endTime: toIso },
    }),
    readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: { operator: 'between', startTime: fromIso, endTime: toIso },
    }),
  ]);

  const dist = distRes.status === 'fulfilled' ? (distRes.value as any) : null;
  const steps = stepsRes.status === 'fulfilled' ? (stepsRes.value as any) : null;
  const cal = calRes.status === 'fulfilled' ? (calRes.value as any) : null;

  const distRecords: any[] = dist?.records ?? dist ?? [];
  const stepsRecords: any[] = steps?.records ?? steps ?? [];
  const calRecords: any[] = cal?.records ?? cal ?? [];

  return {
    distanceKm: sumDistanceKm(distRecords),
    steps: sumSteps(stepsRecords),
    caloriesKcal: sumCaloriesKcal(calRecords),
  };
}

// Маппинг ExerciseType -> твой activity code (из seed)
export function hcMapToActivityCode(exerciseType: number): 'RUN' | 'WALK' | 'BIKE' | 'SWIM' | 'GYM' | 'HIIT' | 'YOGA' | null {
  // ExerciseType берём из либы (там много значений) :contentReference[oaicite:3]{index=3}
  if (exerciseType === ExerciseType.RUNNING || exerciseType === ExerciseType.RUNNING_TREADMILL) return 'RUN';
  if (exerciseType === ExerciseType.WALKING) return 'WALK';
  if (exerciseType === ExerciseType.BIKING || exerciseType === ExerciseType.BIKING_STATIONARY) return 'BIKE';
  if (exerciseType === ExerciseType.SWIMMING_OPEN_WATER || exerciseType === ExerciseType.SWIMMING_POOL) return 'SWIM';
  if (exerciseType === ExerciseType.WEIGHTLIFTING) return 'GYM';
  if (exerciseType === ExerciseType.HIGH_INTENSITY_INTERVAL_TRAINING) return 'HIIT';
  if (exerciseType === ExerciseType.YOGA || exerciseType === ExerciseType.PILATES) return 'YOGA';

  return null;
}

export function hcExerciseTypeTitle(exerciseType: number): string {
  const code = hcMapToActivityCode(exerciseType);
  if (code === 'RUN') return 'Бег';
  if (code === 'WALK') return 'Ходьба';
  if (code === 'BIKE') return 'Велосипед';
  if (code === 'SWIM') return 'Плавание';
  if (code === 'GYM') return 'Зал';
  if (code === 'HIIT') return 'HIIT';
  if (code === 'YOGA') return 'Йога';
  return 'Тренировка';
}