import { api } from './client';

export async function getProgress(params: { activityTypeId: string; metricKey: string; days?: 7 | 30 | 90 }) {
  const res = await api.get('/analytics/progress', { params: { ...params, days: String(params.days ?? 30) } });
  return res.data as {
    unit: string | null;
    points: { date: string; value: number }[];
    summary: { min: number | null; max: number | null; last: number | null };
  };
}

export type AnalyticsSummary = {
  workoutsLast7: number;
  workoutsTotal: number;
  prCount: number;
  achievementsEarned: number;
  achievementsTotal: number;
};

export async function getAnalyticsSummary() {
  const res = await api.get('/analytics/summary');
  return res.data as AnalyticsSummary;
}