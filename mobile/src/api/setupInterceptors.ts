import { api } from './client';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../auth/tokenStorage';
import { authRefresh } from './authApi';

let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

export function setupInterceptors() {
  api.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      if (error.response?.status !== 401 || original._retry) throw error;

      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push((token) => {
            if (!token) return reject(error);
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw error;

        const { accessToken } = await authRefresh(refreshToken);
        await setTokens(accessToken, refreshToken);

        queue.forEach((cb) => cb(accessToken));
        queue = [];

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (e) {
        queue.forEach((cb) => cb(null));
        queue = [];
        await clearTokens();
        throw e;
      } finally {
        isRefreshing = false;
      }
    },
  );
}
