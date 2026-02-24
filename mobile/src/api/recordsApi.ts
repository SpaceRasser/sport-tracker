import { api } from './client';

export async function getRecords() {
  const res = await api.get('/records');
  return res.data as { items: any[] };
}