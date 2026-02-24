import { api } from './client';

export async function updateMe(payload: { name?: string; avatarUrl?: string }) {
  const res = await api.put('/auth/me', payload);
  return res.data as { user: any };
}

export async function presignAvatar(contentType: string) {
  const res = await api.post('/auth/me/avatar/presign', { contentType });
  return res.data as { uploadUrl: string; publicUrl: string; objectKey: string };
}
