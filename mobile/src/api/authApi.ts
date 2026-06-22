import { api } from './client';

export type VkIdLoginPayload = VkIdExchangePayload;
export const authVkId = authVkIdExchange;

export async function authDemo() {
  const res = await api.post('/auth/demo');
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

export type DemoRegisterPayload = {
  phone: string;
  password: string;
  name?: string;
};

export type DemoLoginPayload = {
  phone: string;
  password: string;
};

export async function authDemoCheckPhone(phone: string) {
  const res = await api.post('/auth/demo/check-phone', { phone });
  return res.data as { exists: boolean };
}

export async function authDemoRegister(payload: DemoRegisterPayload) {
  const res = await api.post('/auth/demo/register', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

export async function authDemoLogin(payload: DemoLoginPayload) {
  const res = await api.post('/auth/demo/login', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

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
