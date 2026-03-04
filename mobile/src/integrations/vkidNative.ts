import { NativeModules, Platform } from "react-native";
import { api } from "../api/client";

const { VkIdNative } = NativeModules;

export async function vkIdNativeLogin() {
  if (Platform.OS !== "android") throw new Error("VKID native only for Android");
  if (!VkIdNative?.login) throw new Error("VkIdNative module not linked");

  const vkAccessToken: string = await VkIdNative.login();
  const res = await api.post("/auth/vk-id/token", { accessToken: vkAccessToken });
  return res.data as { accessToken: string; user: any };
}