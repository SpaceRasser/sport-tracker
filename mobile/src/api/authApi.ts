import { api } from './client';

export async function authDemo() {
  const res = await api.post('/auth/demo');
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

export async function authRefresh(refreshToken: string) {
  const res = await api.post('/auth/refresh', { refreshToken });
  return res.data as { accessToken: string };
}

export async function authLogout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}

// ✅ VK ID login (code + deviceId + codeVerifier + redirectUri)
export type VkIdLoginPayload = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

export async function authVkId(payload: VkIdLoginPayload) {
  const res = await api.post('/auth/vk', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ✅ SMS login (sms.ru) — request code
export type SmsRequestPayload = {
  phone: string;
};

export type SmsRequestResponse = {
  ok: true;
  phone: string;
  testCode?: string; // будет только если SMSRU_TEST=1 на бэке
};

export async function authSmsRequest(payload: SmsRequestPayload) {
  const res = await api.post('/auth/sms/request', payload);
  return res.data as SmsRequestResponse;
}

// ✅ SMS login (sms.ru) — verify code
export type SmsVerifyPayload = {
  phone: string;
  code: string;
};

export async function authSmsVerify(payload: SmsVerifyPayload) {
  const res = await api.post('/auth/sms/verify', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}
