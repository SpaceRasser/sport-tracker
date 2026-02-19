import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStorage';
import {
  authDemo,
  authLogout,
  authVkId,
  VkIdLoginPayload,
  authSmsVerify,
  SmsVerifyPayload,
} from '../api/authApi';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signInDemo: () => Promise<void>;
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
        const refresh = state.refreshToken ?? (await getRefreshToken());
        if (refresh) {
          try {
            await authLogout(refresh);
          } catch {
            // ignore
          }
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
