import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage';
import {
  authDemo,
  authLogout,
  authVkId,
  VkIdLoginPayload,
  authSmsVerify,
  SmsVerifyPayload,
  authDemoCheckPhone,
  authDemoLogin,
  authDemoRegister,
  DemoLoginPayload,
  DemoRegisterPayload,
} from '../api/authApi';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  // старый быстрый демо-вход (можешь потом убрать из UI)
  signInDemo: () => Promise<void>;

  // новые demo по телефону/паролю
  demoCheckPhone: (phone: string) => Promise<{ exists: boolean }>;
  signInDemoRegister: (payload: DemoRegisterPayload) => Promise<void>;
  signInDemoLogin: (payload: DemoLoginPayload) => Promise<void>;

  signInVk: (payload: VkIdLoginPayload) => Promise<void>;
  signInSms: (payload: SmsVerifyPayload) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          getAccessToken(),
          getRefreshToken(),
        ]);

        if (!mounted) return;
        setState({ accessToken, refreshToken, isLoading: false });
      } catch {
        if (!mounted) return;
        setState({ accessToken: null, refreshToken: null, isLoading: false });
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,

    // старый “один пользователь”
    signInDemo: async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemo();
        await setTokens(data.accessToken, data.refreshToken);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    // ✅ demo check phone
    demoCheckPhone: async (phone: string) => {
      return authDemoCheckPhone(phone);
    },

    // ✅ demo register
    signInDemoRegister: async (payload: DemoRegisterPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemoRegister(payload);
        await setTokens(data.accessToken, data.refreshToken);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    // ✅ demo login
    signInDemoLogin: async (payload: DemoLoginPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemoLogin(payload);
        await setTokens(data.accessToken, data.refreshToken);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    // ✅ VK ID login
    signInVk: async (payload: VkIdLoginPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authVkId(payload);
        await setTokens(data.accessToken, data.refreshToken);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    // ✅ SMS login
    signInSms: async (payload: SmsVerifyPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authSmsVerify(payload);
        await setTokens(data.accessToken, data.refreshToken);
        setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, isLoading: false });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signOut: async () => {
  setState((s) => ({ ...s, isLoading: true }));
  try {
    const refresh = await getRefreshToken(); // всегда из стораджа — актуально
    if (refresh) {
      try {
        await authLogout(refresh);
      } catch {}
    }
  } finally {
    await clearTokens();
    setState({ accessToken: null, refreshToken: null, isLoading: false });
  }
},
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
