import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const VKID_CLIENT_ID = process.env.EXPO_PUBLIC_VKID_CLIENT_ID!;
const REDIRECT_URI = process.env.EXPO_PUBLIC_VKID_REDIRECT_URI!;

// VK ID endpoints (OAuth 2.1 + PKCE) :contentReference[oaicite:2]{index=2}
const discovery = {
  authorizationEndpoint: 'https://id.vk.ru/authorize',
  tokenEndpoint: 'https://id.vk.ru/oauth2/auth',
};

export async function startVkIdAuth() {
  if (!VKID_CLIENT_ID) throw new Error('EXPO_PUBLIC_VKID_CLIENT_ID is missing');
  if (!REDIRECT_URI) throw new Error('EXPO_PUBLIC_VKID_REDIRECT_URI is missing');

  const request = new AuthSession.AuthRequest({
    clientId: VKID_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    // scopes: required vkid.personal_info + optional email/phone :contentReference[oaicite:3]{index=3}
    scopes: ['vkid.personal_info', 'email', 'phone'],
  });

  // соберёт code_challenge/nonce/state внутри request
  await request.makeAuthUrlAsync(discovery);

  // Важно: useProxy false (Android deep link)
  const result = await request.promptAsync(discovery, { useProxy: false });

  if (result.type !== 'success') {
    return { type: result.type as 'cancel' | 'dismiss' | 'locked' };
  }

  const code = result.params?.code;
  if (!code) throw new Error('VK ID did not return code');

  // PKCE verifier нужен бэку
  const codeVerifier = request.codeVerifier;
  if (!codeVerifier) throw new Error('PKCE codeVerifier missing');

  return {
    type: 'success' as const,
    code,
    codeVerifier,
    redirectUri: REDIRECT_URI,
  };
}