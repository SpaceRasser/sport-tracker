import axios from "axios";

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL;

export const api = axios.create({
  baseURL, // например https://....up.railway.app
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});