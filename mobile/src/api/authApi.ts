import { api } from './client';

// ===========================
// VK (PKCE exchange: code -> tokens)
// ===========================
export type VkIdExchangePayload = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

export async function authVkIdExchange(payload: VkIdExchangePayload) {
  // твой VkIdController
  const res = await api.post('/auth/vk-id/exchange', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// VK (native: accessToken -> tokens)
// ===========================
export async function authVkIdToken(payload: { accessToken: string }) {
  const res = await api.post('/auth/vk-id/token', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// SMS request
// ===========================
export type SmsRequestPayload = { phone: string };
export type SmsRequestResponse = { ok: true; phone: string; testCode?: string };

export async function authSmsRequest(payload: SmsRequestPayload) {
  const res = await api.post('/auth/sms/request', payload);
  return res.data as SmsRequestResponse;
}

// ===========================
// SMS verify
// ===========================
export type SmsVerifyPayload = { phone: string; code: string };

export async function authSmsVerify(payload: SmsVerifyPayload) {
  const res = await api.post('/auth/sms/verify', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// Refresh / logout
// ===========================
export async function authRefresh(refreshToken: string) {
  const res = await api.post('/auth/refresh', { refreshToken });
  return res.data as { accessToken: string };
}

export async function authLogout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}