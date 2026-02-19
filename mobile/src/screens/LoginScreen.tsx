import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../auth/AuthContext';
import { authSmsRequest } from '../api/authApi';

WebBrowser.maybeCompleteAuthSession();

const VK_AUTHORIZE_ENDPOINT = 'https://id.vk.ru/authorize';

const OWNER = 'rasser31';
const SLUG = 'sport-tracker';
const PROJECT_FULL_NAME = `@${OWNER}/${SLUG}`;

// iOS: есть Alert.prompt, Android: нет
function promptText(title: string, message: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios' && (Alert as any).prompt) {
      (Alert as any).prompt(
        title,
        message,
        [
          { text: 'Отмена', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'OK',
            onPress: (value: string) => resolve(value?.trim() ? value.trim() : null),
          },
        ],
        'plain-text',
        placeholder
      );
    } else {
      Alert.alert(
        title,
        `${message}\n\nНа Android Alert.prompt не работает. Нужно сделать отдельный экран ввода.`,
        [{ text: 'Ок', onPress: () => resolve(null) }]
      );
    }
  });
}

export default function LoginScreen() {
  const { signInVk, signInDemo, signInSms } = useAuth() as any;
  const clientId = process.env.EXPO_PUBLIC_VK_CLIENT_ID;

  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    projectNameForProxy: PROJECT_FULL_NAME,
  } as any);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? '',
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: [],
    },
    { authorizationEndpoint: VK_AUTHORIZE_ENDPOINT }
  );

  useEffect(() => {
    (async () => {
      if (!response) return;

      console.log('EXPO PROXY REDIRECT URI:', redirectUri);
      console.log('AUTH RESPONSE:', response);

      if (response.type !== 'success') return;

      const params: any = response.params || {};
      const code = params.code;
      const deviceId = params.device_id;

      if (params.error) {
        Alert.alert('VK ошибка', String(params.error_description ?? params.error));
        return;
      }

      if (!code) return Alert.alert('Ошибка', 'VK не вернул code');
      if (!deviceId) return Alert.alert('Ошибка', 'VK не вернул device_id');

      const codeVerifier = (request as any)?.codeVerifier;
      if (!codeVerifier) return Alert.alert('Ошибка', 'Нет codeVerifier (PKCE)');

      try {
        await signInVk({ code, deviceId, codeVerifier, redirectUri });
      } catch (e: any) {
        Alert.alert('Ошибка', e?.message ?? 'VK login failed');
      }
    })();
  }, [response, request, redirectUri]);

  const onVkPress = async () => {
    if (!clientId) {
      Alert.alert('Ошибка', 'Нет EXPO_PUBLIC_VK_CLIENT_ID в mobile/.env');
      return;
    }

    console.log('EXPO PROXY REDIRECT URI:', redirectUri);

    await (promptAsync as any)({
      useProxy: true,
      projectNameForProxy: PROJECT_FULL_NAME,
    });
  };

  const onSmsPress = async () => {
    try {
      const phone = await promptText(
        'Вход по SMS',
        'Введи номер телефона РФ (пример: +79991234567)',
        '+79991234567'
      );
      if (!phone) return;

      // 1) запросить отправку кода
      const req = await authSmsRequest({ phone });

      // если бэк в test режиме (SMSRU_TEST=1), придёт testCode — удобно для разработки
      const hint = req?.testCode ? `\n\nТЕСТ-КОД: ${req.testCode}` : '';

      const code = await promptText(
        'Код из SMS',
        `Введи 6 цифр из SMS.${hint}`,
        req?.testCode ?? ''
      );
      if (!code) return;

      // 2) verify + сохранение токенов в контексте
      // (signInSms внутри вызовет authSmsVerify и setTokens, как demo/vk)
      await signInSms({ phone, code });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'SMS login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SportTracker</Text>

      <Pressable style={[styles.btn, !request && { opacity: 0.5 }]} onPress={onVkPress} disabled={!request}>
        <Text style={styles.btnText}>Войти через VK</Text>
      </Pressable>

      <Pressable style={[styles.btn, { marginTop: 12, backgroundColor: '#2E7D32' }]} onPress={onSmsPress}>
        <Text style={styles.btnText}>Войти по SMS</Text>
      </Pressable>

      <Pressable style={[styles.btn, { marginTop: 12, opacity: 0.8 }]} onPress={signInDemo}>
        <Text style={styles.btnText}>Демо-вход</Text>
      </Pressable>

      {Platform.OS === 'android' ? (
        <Text style={{ marginTop: 12, opacity: 0.7, textAlign: 'center' }}>
          На Android лучше сделать отдельный экран ввода телефона/кода (Alert.prompt там нет).
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  btn: { width: '100%', padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#1976D2' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
