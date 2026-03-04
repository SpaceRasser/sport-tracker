import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskInput from "react-native-mask-input";

import { useAuth } from "../auth/AuthContext";
import { authSmsRequest } from "../api/authApi";

type Step = "phone" | "code";

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

// RU normalize: "+7 (999) 123-45-67" -> "+79991234567"
function normalizeRuPhone(input: string): string | null {
  const d = onlyDigits(input);

  if (!d) return null;

  // если пользователь ввел 11 цифр с 8/7
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+7${d.slice(1)}`;

  // если ввели 10 цифр (обычно 9XXXXXXXXX)
  if (d.length === 10) return `+7${d}`;

  return null;
}

function formatPhonePretty(phone: string) {
  // "+79991234567" -> "+7 999 123-45-67"
  const d = onlyDigits(phone);
  const core = d.length === 11 && d.startsWith("7") ? d.slice(1) : d;
  const p = core.padEnd(10, " ");
  return `+7 ${p.slice(0, 3)} ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`.trim();
}

function makePalette(isDark: boolean) {
  return {
    bg1: isDark ? "#070A12" : "#F2F6FF",
    bg2: isDark ? "#0B1020" : "#EEF2FF",
    card: isDark ? "rgba(18,22,37,0.82)" : "rgba(255,255,255,0.86)",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)",
    text: isDark ? "#EAF0FF" : "#0B1220",
    sub: isDark ? "#AAB4D6" : "#51607A",
    primary: "#2D6BFF",
    shadow: isDark ? "rgba(0,0,0,0.35)" : "rgba(16,24,40,0.12)",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  };
}

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const { signInSms, isLoading } = useAuth() as any;

  // если хочешь тёмную тему — замени на useColorScheme()
  const isDark = false;
  const palette = useMemo(() => makePalette(isDark), [isDark]);

  const [step, setStep] = useState<Step>("phone");

  // PHONE UI: храним маскированную строку (MaskInput ее сам держит)
  const [phoneMasked, setPhoneMasked] = useState<string>("+7 ");

  // CODE UI
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  // resend timer
  const [resendLeft, setResendLeft] = useState<number>(0);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);

  // focus refs
  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

  // anti double-submit
  const verifyInFlightRef = useRef(false);

  const canResend = resendLeft <= 0;

  useEffect(() => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    if (resendLeft <= 0) return;

    resendTimerRef.current = setInterval(() => {
      setResendLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [resendLeft]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === "phone") phoneInputRef.current?.focus();
      if (step === "code") codeInputRef.current?.focus();
    }, 250);
    return () => clearTimeout(t);
  }, [step]);

  const requestSms = useCallback(async () => {
    const normalized = normalizeRuPhone(phoneMasked);
    if (!normalized) {
      Alert.alert("Ошибка", "Введите номер РФ в формате +7 (999) 123-45-67");
      return;
    }

    try {
      const res = await authSmsRequest({ phone: normalized });

      // у тебя в env SMS_CODE_RESEND_SECONDS=60, ставим так же
      setResendLeft(60);

      setSentTo(normalized);
      setStep("code");

      // (опционально) автоподстановка тест-кода
      if (res?.testCode) setCode(String(res.testCode));
      else setCode("");

      // сброс защиты от дабл сабмита
      verifyInFlightRef.current = false;
    } catch (e: any) {
      Alert.alert("Ошибка", e?.response?.data?.message ?? e?.message ?? "Не удалось отправить SMS");
    }
  }, [phoneMasked]);

  const verifyCode = useCallback(async () => {
    if (verifyInFlightRef.current) return;
    if (isLoading) return;

    const normalized = sentTo ?? normalizeRuPhone(phoneMasked);
    if (!normalized) {
      Alert.alert("Ошибка", "Сначала укажите телефон");
      setStep("phone");
      return;
    }

    const c = onlyDigits(code);
    if (c.length !== 6) {
      Alert.alert("Ошибка", "Код должен состоять из 6 цифр");
      return;
    }

    try {
      verifyInFlightRef.current = true;
      await signInSms({ phone: normalized, code: c });
    } catch (e: any) {
      verifyInFlightRef.current = false;
      Alert.alert("Ошибка", e?.response?.data?.message ?? e?.message ?? "Неверный код");
    }
  }, [code, sentTo, phoneMasked, signInSms, isLoading]);

  // ✅ (1) Авто-вход при 6 цифрах
  useEffect(() => {
    if (step !== "code") return;
    const c = onlyDigits(code);
    if (c.length === 6) {
      // маленькая задержка, чтобы UI успел обновиться
      const t = setTimeout(() => {
        verifyCode();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [code, step, verifyCode]);

  const title = step === "phone" ? "Вход по SMS" : "Подтверждение";
  const subtitle =
    step === "phone"
      ? "Мы отправим одноразовый код подтверждения."
      : `Код отправлен на ${formatPhonePretty(sentTo ?? normalizeRuPhone(phoneMasked) ?? "+7")}`;

  return (
    <LinearGradient
      colors={[palette.bg1, palette.bg2]}
      style={[styles.screen, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }]}
    >
      <View pointerEvents="none" style={[styles.glow1, { backgroundColor: "rgba(45,107,255,0.18)" }]} />
      <View pointerEvents="none" style={[styles.glow2, { backgroundColor: "rgba(45,107,255,0.10)" }]} />

      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow },
          ]}
        >
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <View style={[styles.logo, { borderColor: palette.border, backgroundColor: "rgba(45,107,255,0.12)" }]}>
              <Text style={[styles.logoText, { color: palette.primary }]}>ST</Text>
            </View>

            <Text style={[styles.h1, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.h2, { color: palette.sub }]}>{subtitle}</Text>
          </View>

          {step === "phone" ? (
            <>
              <Text style={[styles.label, { color: palette.sub }]}>Телефон</Text>

              <View style={[styles.inputWrap, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <MaskInput
                  ref={phoneInputRef as any}
                  value={phoneMasked}
                  onChangeText={(masked) => setPhoneMasked(masked)}
                  mask={["+", "7", " ", "(", /\d/, /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, "-", /\d/, /\d/, "-", /\d/, /\d/]}
                  keyboardType="phone-pad"
                  placeholder="+7 (999) 123-45-67"
                  placeholderTextColor={palette.sub}
                  style={[styles.input, { color: palette.text }]}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={requestSms}
                />
              </View>

              <Pressable
                onPress={requestSms}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: palette.primary, opacity: isLoading ? 0.6 : pressed ? 0.86 : 1 },
                ]}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Получить код</Text>}
              </Pressable>

              <Text style={[styles.small, { color: palette.sub }]}>
                Нажимая «Получить код», вы соглашаетесь на обработку номера телефона для авторизации.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: palette.sub }]}>Код из SMS</Text>

              <View style={[styles.inputWrap, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
                <TextInput
                  ref={codeInputRef}
                  value={code}
                  onChangeText={(t) => setCode(onlyDigits(t).slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={palette.sub}
                  keyboardType="number-pad"
                  style={[styles.input, { color: palette.text, letterSpacing: 6, textAlign: "center" }]}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={verifyCode}
                  maxLength={6}
                />
              </View>

              <Pressable
                onPress={verifyCode}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: palette.primary, opacity: isLoading ? 0.6 : pressed ? 0.86 : 1 },
                ]}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Войти</Text>}
              </Pressable>

              <View style={{ height: 10 }} />

              <Pressable
                onPress={() => {
                  setStep("phone");
                  setCode("");
                  setSentTo(null);
                  setResendLeft(0);
                  verifyInFlightRef.current = false;
                }}
                style={({ pressed }) => [styles.ghostBtn, { borderColor: palette.border, opacity: pressed ? 0.85 : 1 }]}
                disabled={isLoading}
              >
                <Text style={[styles.ghostBtnText, { color: palette.text }]}>Изменить номер</Text>
              </Pressable>

              <View style={{ height: 12 }} />

              <Pressable
                onPress={() => {
                  if (!canResend || isLoading) return;
                  requestSms();
                }}
                disabled={!canResend || isLoading}
                style={{ alignItems: "center", paddingVertical: 6 }}
              >
                <Text style={[styles.link, { color: canResend ? palette.primary : palette.sub }]}>
                  {canResend ? "Отправить код ещё раз" : `Повторная отправка через ${resendLeft}с`}
                </Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={[styles.footer, { color: palette.sub }]}>© {new Date().getFullYear()} SportTracker</Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  glow1: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  glow2: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    ...(Platform.OS === "ios"
      ? { shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 12 } }
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

  h1: { fontSize: 22, fontWeight: "900" },
  h2: { marginTop: 6, fontSize: 13, fontWeight: "700", textAlign: "center" },

  label: { fontSize: 12, fontWeight: "800", marginBottom: 8 },

  inputWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, fontWeight: "800" },

  primaryBtn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "900" },

  ghostBtn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ghostBtnText: { fontSize: 14.5, fontWeight: "900" },

  link: { fontSize: 13, fontWeight: "900" },

  small: { marginTop: 10, fontSize: 11.5, fontWeight: "700", textAlign: "center", opacity: 0.9 },

  footer: { marginTop: 14, fontSize: 12, fontWeight: "700", textAlign: "center", opacity: 0.8 },
});