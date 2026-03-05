import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  useColorScheme,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useNavigation } from "@react-navigation/native";

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? "#0B0D12" : "#F4F6FA",
    card: isDark ? "#121625" : "#FFFFFF",
    text: isDark ? "#E9ECF5" : "#121722",
    subtext: isDark ? "#A9B1C7" : "#5C667A",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
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
  const subColor =
    variant === "neutral" ? palette.subtext : "rgba(255,255,255,0.85)";

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
          <Text style={[styles.btnSubtitle, { color: subColor }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.btnChevron, { color: textColor }]}>{">"}</Text>
    </Pressable>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { signInVkNative } = useAuth() as any;

  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === "dark"), [scheme]);

  const onVkPress = async () => {
    if (Platform.OS !== "android") {
      Alert.alert("VK ID", "Сейчас VK ID нативно настроен только для Android.");
      return;
    }

    try {
      await signInVkNative();
    } catch (e: any) {
      Alert.alert(
        "VK ID",
        e?.response?.data?.message ??
          e?.message ??
          "VK ID native login failed"
      );
    }
  };

  const onSmsPress = () => {
    // ✅ переход на наш новый красивый экран SMS
    navigation.navigate("PhoneAuth");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
      />

      <View
        pointerEvents="none"
        style={[styles.topGlow, { backgroundColor: "rgba(45,107,255,0.18)" }]}
      />
      <View
        pointerEvents="none"
        style={[styles.topGlow2, { backgroundColor: "rgba(45,107,255,0.10)" }]}
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
            <Text style={[styles.logoText, { color: palette.primary }]}>
              ST
            </Text>
          </View>

          <Text style={[styles.title, { color: palette.text }]}>
            SportTracker
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Дневник тренировок, PR и прогресс — всё в одном месте.
          </Text>
        </View>

        <Button
          title="Войти через VK ID"
          subtitle="Android • через приложение VK"
          onPress={onVkPress}
          variant="primary"
          palette={palette}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
          <Text style={[styles.or, { color: palette.subtext }]}>или</Text>
          <View style={[styles.divider, { backgroundColor: palette.border }]} />
        </View>

        <Button
          title="Войти по SMS"
          subtitle="Код подтверждения на номер телефона"
          onPress={onSmsPress}
          variant="success"
          palette={palette}
        />

        <Text style={[styles.hint, { color: palette.subtext }]}>
          Продолжая, ты соглашаешься с обработкой данных для входа и ведения
          статистики.
        </Text>
      </View>

      <Text style={[styles.footer, { color: palette.subtext }]}>
        © {new Date().getFullYear()} SportTracker
      </Text>
    </KeyboardAvoidingView>
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
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

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