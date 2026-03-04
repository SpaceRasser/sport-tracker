import * as Localization from 'expo-localization';
import { api } from '../api/client';

export async function syncTimezone(): Promise<void> {
  const tz = Localization.timezone; // например "Europe/Amsterdam"
  if (!tz) return;

  await api.patch('/notify/settings', { timezone: tz });
}