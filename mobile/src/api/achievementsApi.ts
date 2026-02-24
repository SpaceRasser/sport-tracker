import { api } from './client';

export type AchievementItem = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  createdAt: string;
  achieved: boolean;
  achievedAt: string | null;
  meta?: any;
};

export async function getAchievements() {
  const res = await api.get('/achievements');
  return res.data as { items: AchievementItem[] };
}