import axios from "axios";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL, // например https://...up.railway.app
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ключи должны совпадать с тем, как ты сохраняешь токены в AuthContext
const ACCESS_KEY = "accessToken";

// Автоматически добавляем Authorization ко всем запросам
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // молча — не ломаем запрос
  }
  return config;
});