import { api } from './client';

// refresh / logout
export async function authRefresh(refreshToken: string) {
  const res = await api.post('/auth/refresh', { refreshToken });
  return res.data as { accessToken: string };
}

export async function authLogout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}

// ===========================
// VK ID PKCE (Expo / WebBrowser flow)
// ===========================
export type VkIdLoginPayload = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

export async function authVkIdExchange(payload: VkIdLoginPayload) {
  const res = await api.post('/auth/vk-id/exchange', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// VK ID Native (SDK returns accessToken)
// ===========================
export async function authVkIdToken(accessToken: string) {
  const res = await api.post('/auth/vk-id/token', { accessToken });
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// SMS
// ===========================
export type SmsRequestPayload = { phone: string };
export type SmsRequestResponse = { ok: true; phone: string; testCode?: string };

export async function authSmsRequest(payload: SmsRequestPayload) {
  const res = await api.post('/auth/sms/request', payload);
  return res.data as SmsRequestResponse;
}

export type SmsVerifyPayload = { phone: string; code: string };

export async function authSmsVerify(payload: SmsVerifyPayload) {
  const res = await api.post('/auth/sms/verify', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}