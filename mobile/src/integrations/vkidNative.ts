import { NativeModules, Platform } from "react-native";
import { api } from "../api/client";

const { VkIdNative } = NativeModules;

export type VkIdNativeResult = {
  vkAccessToken: string;
  vkIdToken: string | null;
  vkUserId: number | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  photo50: string | null;
  photo100: string | null;
  photo200: string | null;
  scopes: string[];
};

type BackendVkNativeLoginResponse = {
  accessToken: string;
  refreshToken?: string | null;
  user: any;
};

function normalizeNativeResult(input: any): VkIdNativeResult {
  if (typeof input === "string") {
    return {
      vkAccessToken: input,
      vkIdToken: null,
      vkUserId: null,
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      photo50: null,
      photo100: null,
      photo200: null,
      scopes: [],
    };
  }

  return {
    vkAccessToken: input?.vkAccessToken ?? "",
    vkIdToken: input?.vkIdToken ?? null,
    vkUserId:
      typeof input?.vkUserId === "number" ? input.vkUserId : null,
    firstName: input?.firstName ?? null,
    lastName: input?.lastName ?? null,
    phone: input?.phone ?? null,
    email: input?.email ?? null,
    photo50: input?.photo50 ?? null,
    photo100: input?.photo100 ?? null,
    photo200: input?.photo200 ?? null,
    scopes: Array.isArray(input?.scopes) ? input.scopes : [],
  };
}

export async function vkIdNativeLogin() {
  if (Platform.OS !== "android") {
    throw new Error("VKID native only for Android");
  }

  if (!VkIdNative?.login) {
    throw new Error("VkIdNative module not linked");
  }

  const nativeRaw = await VkIdNative.login();
  const nativeResult = normalizeNativeResult(nativeRaw);

  if (!nativeResult.vkAccessToken) {
    throw new Error("VKID native did not return access token");
  }

  const res = await api.post("/auth/vk-id/token", {
    accessToken: nativeResult.vkAccessToken,
  });

  return {
    ...(res.data as BackendVkNativeLoginResponse),
    vkid: nativeResult,
  };
}