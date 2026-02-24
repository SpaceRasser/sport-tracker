import { api } from './client';

export async function getLatestWorkout() {
  const res = await api.get('/workouts/latest');
  return res.data as { workout: any | null };
}