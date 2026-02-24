import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  useColorScheme,
  StatusBar,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useAuth } from "../auth/AuthContext";
import { authSmsRequest } from "../api/authApi";
import { useNavigation } from "@react-navigation/native";

WebBrowser.maybeCompleteAuthSession();

const VK_AUTHORIZE_ENDPOINT = "https://id.vk.ru/authorize";

const OWNER = "rasser31";
const SLUG = "sport-tracker";
const PROJECT_FULL_NAME = `@${OWNER}/${SLUG}`;

// iOS: есть Alert.prompt, Android: нет
function promptText(
  title: string,
  message: string,
  placeholder: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        title,
        message,
        [
          { text: "Отмена", style: "cancel", onPress: () => resolve(null) },
          {
            text: "OK",
            onPress: (value: string) =>
              resolve(value?.trim() ? value.trim() : null),
          },
        ],
        "plain-text",
        placeholder,
      );
    } else {
      Alert.alert(
        title,
        `${message}\n\nНа Android Alert.prompt не работает — используй “Войти по телефону”.`,
        [{ text: "Ок", onPress: () => resolve(null) }],
      );
    }
  });
}

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)",
    primary: "#2D6BFF",
    success: "#2E7D32",
    neutral: isDark ? "rgba(255,255,255,0.06)" : "#EEF2F6",
    shadow: isDark ? "rgba(0,0,0,0.30)" : "rgba(16,24,40,0.10)",
  };
}

function Button({
  title,
  subtitle,
  onPress,
  disabled,
  variant,
  palette,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "success" | "neutral";
  palette: ReturnType<typeof makePalette>;
}) {
  const bg =
    variant === "primary"
      ? palette.primary
      : variant === "success"
        ? palette.success
        : palette.neutral;

  const textColor = variant === "neutral" ? palette.text : "#fff";
  const subColor = variant === "neutral" ? palette.subtext : "rgba(255,255,255,0.85)";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: variant === "neutral" ? palette.border : "transparent",
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.btnTitle, { color: textColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.btnSubtitle, { color: subColor }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={[styles.btnChevron, { color: textColor }]}>{">"}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { signInVk, signInSms } = useAuth() as any;
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const clientId = process.env.EXPO_PUBLIC_VK_CLIENT_ID;

  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    projectNameForProxy: PROJECT_FULL_NAME,
  } as any);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? "",
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      scopes: [],
    },
    { authorizationEndpoint: VK_AUTHORIZE_ENDPOINT },
  );

  useEffect(() => {
    (async () => {
      if (!response) return;

      if (response.type !== "success") return;

      const params: any = response.params || {};
      const code = params.code;
      const deviceId = params.device_id;

      if (params.error) {
        Alert.alert("VK ошибка", String(params.error_description ?? params.error));
        return;
      }

      if (!code) return Alert.alert("Ошибка", "VK не вернул code");
      if (!deviceId) return Alert.alert("Ошибка", "VK не вернул device_id");

      const codeVerifier = (request as any)?.codeVerifier;
      if (!codeVerifier) return Alert.alert("Ошибка", "Нет codeVerifier (PKCE)");

      try {
        await signInVk({ code, deviceId, codeVerifier, redirectUri });
      } catch (e: any) {
        Alert.alert("Ошибка", e?.message ?? "VK login failed");
      }
    })();
  }, [response, request, redirectUri]);

  const onVkPress = async () => {
    if (!clientId) {
      Alert.alert("Ошибка", "Нет EXPO_PUBLIC_VK_CLIENT_ID в mobile/.env");
      return;
    }

    await (promptAsync as any)({
      useProxy: true,
      projectNameForProxy: PROJECT_FULL_NAME,
    });
  };

  const onSmsPress = async () => {
    try {
      const phone = await promptText(
        "Вход по SMS",
        "Введи номер телефона РФ (пример: +79991234567)",
        "+79991234567",
      );
      if (!phone) return;

      const req = await authSmsRequest({ phone });
      const hint = req?.testCode ? `\n\nТЕСТ-КОД: ${req.testCode}` : "";

      const code = await promptText(
        "Код из SMS",
        `Введи 6 цифр из SMS.${hint}`,
        req?.testCode ?? "",
      );
      if (!code) return;

      await signInSms({ phone, code });
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "SMS login failed");
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />

      {/* верхняя “аура” */}
      <View
        pointerEvents="none"
        style={[
          styles.topGlow,
          {
            backgroundColor: "rgba(45,107,255,0.18)",
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.topGlow2,
          {
            backgroundColor: "rgba(45,107,255,0.10)",
          },
        ]}
      />

      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <View style={{ alignItems: "center", marginBottom: 14 }}>
          <View
            style={[
              styles.logo,
              {
                borderColor: palette.border,
                backgroundColor: "rgba(45,107,255,0.12)",
              },
            ]}
          >
            <Text style={[styles.logoText, { color: palette.primary }]}>ST</Text>
          </View>

          <Text style={[styles.title, { color: palette.text }]}>SportTracker</Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Дневник тренировок, PR и прогресс — всё в одном месте.
          </Text>
        </View>

        <Button
          title="Войти через VK"
          subtitle="Рекомендуемый способ"
          onPress={onVkPress}
          disabled={!request}
          variant="primary"
          palette={palette}
        />

        <View style={{ height: 10 }} />

        <Button
          title="Войти по SMS"
          subtitle={Platform.OS === "android" ? "На Android лучше через “по телефону”" : "Быстро и удобно"}
          onPress={onSmsPress}
          variant="success"
          palette={palette}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <Text style={[styles.or, { color: palette.subtext }]}>или</Text>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
        </View>

        <Button
          title="Войти по телефону"
          subtitle="Экран ввода телефона и кода"
          onPress={() => navigation.navigate("PhoneAuth")}
          variant="neutral"
          palette={palette}
        />

        <Text style={[styles.hint, { color: palette.subtext }]}>
          Продолжая, ты соглашаешься с обработкой данных для входа и ведения статистики.
        </Text>
      </View>

      <Text style={[styles.footer, { color: palette.subtext }]}>
        © {new Date().getFullYear()} SportTracker • Demo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },

  topGlow: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  topGlow2: {
    position: "absolute",
    top: -160,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },

  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    ...(Platform.OS === "ios"
      ? {
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 2 }),
  },

  logo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoText: { fontSize: 18, fontWeight: "900" },

  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 6, fontSize: 13, fontWeight: "700", textAlign: "center" },

  btn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  btnTitle: { fontSize: 15.5, fontWeight: "900" },
  btnSubtitle: { marginTop: 2, fontSize: 12.5, fontWeight: "700" },
  btnChevron: { marginLeft: 10, fontSize: 18, fontWeight: "900" },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 10,
  },
  divider: { height: 1, flex: 1, borderRadius: 999 },
  or: { fontSize: 12, fontWeight: "800" },

  hint: {
    marginTop: 14,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
    opacity: 0.9,
  },
  footer: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    opacity: 0.75,
  },
});
