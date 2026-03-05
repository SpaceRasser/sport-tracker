import axios from "axios";
import * as SecureStore from "expo-secure-store";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ключи должны совпадать с тем, как ты сохраняешь токены в AuthContext
const ACCESS_KEY = "accessToken";

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // молча, без логов
  }
  return config;
});