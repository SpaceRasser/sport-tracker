import { api } from './client';

export type RecommendationItem = {
  id: string;
  createdAt: string;
  template: { id: string; code: string; title: string };
  text: string;
  reason?: string | null;
};

export async function getRecommendations() {
  const res = await api.get('/recommendations');
  return res.data as { items: RecommendationItem[] };
}

export async function dismissRecommendation(id: string) {
  const res = await api.post(`/recommendations/${id}/dismiss`);
  return res.data as { ok: boolean };
}