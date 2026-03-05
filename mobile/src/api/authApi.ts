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

// ===========================
// ✅ VK ID login (Android, PKCE)
// ===========================
// Теперь: code + codeVerifier + redirectUri
export type VkIdLoginPayload = {
  code: string;
  deviceId: string;
  codeVerifier: string;
  redirectUri: string;
};

export async function authVkId(payload: VkIdLoginPayload) {
  // ✅ твой бэк: @Post('vk') => POST /auth/vk
  const res = await api.post("/auth/vk", payload);
  return res.data as { user: any; accessToken: string; refreshToken?: string | null };
}

// ===========================
// ✅ SMS login (sms.ru) — request code
// ===========================
export type SmsRequestPayload = {
  phone: string;
};

export type SmsRequestResponse = {
  ok: true;
  phone: string;
  testCode?: string; // будет только если SMSRU_TEST=1 на бэке
};

export async function authSmsRequest(payload: SmsRequestPayload) {
  // ✅ твой бэк: @Post('sms/request') => POST /auth/sms/request
  const res = await api.post("/auth/sms/request", payload);
  return res.data as SmsRequestResponse;
}

// ===========================
// ✅ SMS login (sms.ru) — verify code
// ===========================
export type SmsVerifyPayload = {
  phone: string;
  code: string;
};

export async function authSmsVerify(payload: SmsVerifyPayload) {
  // ✅ твой бэк: @Post('sms/verify') => POST /auth/sms/verify
  const res = await api.post("/auth/sms/verify", payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

// ===========================
// ✅ Demo auth (phone + password)
// ===========================

export async function authDemoCheckPhone(phone: string) {
  const res = await api.post('/auth/demo/check-phone', { phone });
  return res.data as { exists: boolean };
}

export type DemoRegisterPayload = {
  phone: string;
  password: string;
  name?: string;
};

export async function authDemoRegister(payload: DemoRegisterPayload) {
  const res = await api.post('/auth/demo/register', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}

export type DemoLoginPayload = {
  phone: string;
  password: string;
};

export async function authDemoLogin(payload: DemoLoginPayload) {
  const res = await api.post('/auth/demo/login', payload);
  return res.data as { user: any; accessToken: string; refreshToken: string };
}