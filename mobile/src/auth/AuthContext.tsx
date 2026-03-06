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

import { vkIdNativeLogin } from '../integrations/vkidNative';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signInDemo: () => Promise<void>;

  demoCheckPhone: (phone: string) => Promise<{ exists: boolean }>;
  signInDemoRegister: (payload: DemoRegisterPayload) => Promise<void>;
  signInDemoLogin: (payload: DemoLoginPayload) => Promise<void>;

  signInVk: (payload: VkIdLoginPayload) => Promise<void>;
  signInVkNative: () => Promise<void>;

  signInSms: (payload: SmsVerifyPayload) => Promise<void>;

  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistTokens(accessToken: string, refreshToken: string | null | undefined) {
  await setTokens(accessToken, refreshToken ?? '');
}

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

        setState({
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          isLoading: false,
        });
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

    signInDemo: async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemo();
        await persistTokens(data.accessToken, data.refreshToken);
        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    demoCheckPhone: async (phone: string) => {
      return authDemoCheckPhone(phone);
    },

    signInDemoRegister: async (payload: DemoRegisterPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemoRegister(payload);
        await persistTokens(data.accessToken, data.refreshToken);
        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signInDemoLogin: async (payload: DemoLoginPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authDemoLogin(payload);
        await persistTokens(data.accessToken, data.refreshToken);
        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signInVk: async (payload: VkIdLoginPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authVkId(payload);
        await persistTokens(data.accessToken, data.refreshToken ?? null);
        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signInVkNative: async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await vkIdNativeLogin();

        await persistTokens(data.accessToken, data.refreshToken ?? null);

        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });

        console.log('VKID native result:', data.vkid);
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signInSms: async (payload: SmsVerifyPayload) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const data = await authSmsVerify(payload);
        await persistTokens(data.accessToken, data.refreshToken);
        setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          isLoading: false,
        });
      } catch (e) {
        await clearTokens();
        setState({ accessToken: null, refreshToken: null, isLoading: false });
        throw e;
      }
    },

    signOut: async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const refresh = await getRefreshToken();
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