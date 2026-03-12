import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaskInput from "react-native-mask-input";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "../auth/AuthContext";
import { authSmsRequest } from "../api/authApi";

type Step = "phone" | "code";

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function normalizeRuPhone(input: string): string | null {
  const d = onlyDigits(input);

  if (!d) return null;
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  if (d.length === 11 && d.startsWith("7")) return `+7${d.slice(1)}`;
  if (d.length === 10) return `+7${d}`;

  return null;
}

function formatPhonePretty(phone: string) {
  const d = onlyDigits(phone);
  const core = d.length === 11 && d.startsWith("7") ? d.slice(1) : d;
  const p = core.padEnd(10, " ");
  return `+7 ${p.slice(0, 3)} ${p.slice(3, 6)}-${p.slice(6, 8)}-${p.slice(8, 10)}`.trim();
}

const palette = {
  bg: "#F5F2FF",
  bg2: "#EEE9FF",
  card: "#FFFFFF",
  cardSoft: "#F4F0FF",

  purple: "#6D4CFF",
  purpleDark: "#5137D7",

  text: "#2D244D",
  subtext: "#7D739D",
  muted: "#9D95BA",
  line: "#E6E0FA",

  cyan: "#7CE7FF",
  pink: "#FF8DD8",
  orange: "#FFB36B",
};

function StepChip({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <View
      style={[
        styles.stepChip,
        active ? styles.stepChipActive : styles.stepChipInactive,
      ]}
    >
      <Text
        style={[
          styles.stepChipText,
          { color: active ? "#FFFFFF" : palette.purple },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.infoBadge}>
      {icon}
      <Text style={styles.infoBadgeText}>{label}</Text>
    </View>
  );
}

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { signInSms, isLoading } = useAuth() as any;

  const [step, setStep] = useState<Step>("phone");
  const [phoneMasked, setPhoneMasked] = useState<string>("+7 ");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [resendLeft, setResendLeft] = useState<number>(0);
  const resendTimerRef = useRef<NodeJS.Timeout | null>(null);

  const phoneInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [phoneFieldY, setPhoneFieldY] = useState(0);
  const [codeFieldY, setCodeFieldY] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const verifyInFlightRef = useRef(false);
  const canResend = resendLeft <= 0;

  const scrollToField = useCallback((y: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - 24),
        animated: true,
      });
    }, Platform.OS === "android" ? 120 : 40);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      if (step === "phone") {
        phoneInputRef.current?.focus();
        scrollToField(phoneFieldY);
      } else {
        codeInputRef.current?.focus();
        scrollToField(codeFieldY);
      }
    }, 220);

    return () => clearTimeout(t);
  }, [step, phoneFieldY, codeFieldY, scrollToField]);

  const requestSms = useCallback(async () => {
    const normalized = normalizeRuPhone(phoneMasked);

    if (!normalized) {
      Alert.alert("Ошибка", "Введите номер РФ в формате +7 (999) 123-45-67");
      return;
    }

    try {
      const res = await authSmsRequest({ phone: normalized });

      setResendLeft(60);
      setSentTo(normalized);
      setStep("code");

      if (res?.testCode) setCode(String(res.testCode));
      else setCode("");

      verifyInFlightRef.current = false;
    } catch (e: any) {
      Alert.alert(
        "Ошибка",
        e?.response?.data?.message ?? e?.message ?? "Не удалось отправить SMS"
      );
    }
  }, [phoneMasked]);

  const verifyCode = useCallback(async () => {
    if (verifyInFlightRef.current) return;
    if (isLoading) return;

    const normalized = sentTo ?? normalizeRuPhone(phoneMasked);
    if (!normalized) {
      Alert.alert("Ошибка", "Сначала укажите номер телефона");
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
      Alert.alert(
        "Ошибка",
        e?.response?.data?.message ?? e?.message ?? "Неверный код"
      );
    }
  }, [code, sentTo, phoneMasked, signInSms, isLoading]);

  useEffect(() => {
    if (step !== "code") return;

    const c = onlyDigits(code);
    if (c.length === 6) {
      const t = setTimeout(() => {
        verifyCode();
      }, 80);

      return () => clearTimeout(t);
    }
  }, [code, step, verifyCode]);

  const title = step === "phone" ? "Вход по SMS" : "Подтверждение";
  const subtitle = useMemo(() => {
    if (step === "phone") {
      return "Введите номер телефона, и мы отправим одноразовый код подтверждения.";
    }

    return `Код отправлен на ${formatPhonePretty(
      sentTo ?? normalizeRuPhone(phoneMasked) ?? "+7"
    )}`;
  }, [step, sentTo, phoneMasked]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />

      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            {
              minHeight: height,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24,
              justifyContent: "flex-start",
            },
          ]}
        >
          <View style={styles.mainCard}>
            <View style={styles.stepRow}>
              <StepChip label="Номер" active={step === "phone"} />
              <StepChip label="Код" active={step === "code"} />
            </View>

            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>

            <View style={styles.badgesRow}>
              <InfoBadge
                icon={<Ionicons name="flash" size={14} color={palette.purple} />}
                label="Быстро"
              />
              <InfoBadge
                icon={<Ionicons name="lock-closed" size={14} color={palette.purple} />}
                label="Безопасно"
              />
              <InfoBadge
                icon={
                  <MaterialCommunityIcons
                    name="cellphone-message"
                    size={14}
                    color={palette.purple}
                  />
                }
                label="Удобно"
              />
            </View>

            {step === "phone" ? (
              <>
                <Text style={styles.label}>Телефон</Text>

                <View
                  style={styles.inputShell}
                  onLayout={(e) => setPhoneFieldY(e.nativeEvent.layout.y)}
                >
                  <View style={styles.leadingIcon}>
                    <Ionicons name="call" size={18} color={palette.purple} />
                  </View>

                  <MaskInput
                    ref={phoneInputRef as any}
                    value={phoneMasked}
                    onChangeText={(masked) => setPhoneMasked(masked)}
                    mask={[
                      "+",
                      "7",
                      " ",
                      "(",
                      /\d/,
                      /\d/,
                      /\d/,
                      ")",
                      " ",
                      /\d/,
                      /\d/,
                      /\d/,
                      "-",
                      /\d/,
                      /\d/,
                      "-",
                      /\d/,
                      /\d/,
                    ]}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    autoCorrect={false}
                    placeholder="+7 (999) 123-45-67"
                    placeholderTextColor={palette.muted}
                    style={styles.input}
                    editable={!isLoading}
                    returnKeyType="done"
                    onFocus={() => scrollToField(phoneFieldY)}
                    onSubmitEditing={requestSms}
                    selectionColor={palette.purple}
                  />
                </View>

                <Pressable
                  onPress={requestSms}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { opacity: isLoading ? 0.65 : pressed ? 0.92 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={[palette.purple, palette.purpleDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButtonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <View style={styles.primaryButtonIcon}>
                          <Ionicons
                            name="paper-plane"
                            size={18}
                            color={palette.purpleDark}
                          />
                        </View>
                        <Text style={styles.primaryButtonText}>Получить код</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.smallText}>
                  Нажимая «Получить код», Вы соглашаетесь на обработку номера
                  телефона для авторизации.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.label}>Код из SMS</Text>

                <View
                  style={styles.codeShell}
                  onLayout={(e) => setCodeFieldY(e.nativeEvent.layout.y)}
                >
                  <TextInput
                    ref={codeInputRef}
                    value={code}
                    onChangeText={(t) => setCode(onlyDigits(t).slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={palette.muted}
                    keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                    autoComplete={Platform.select({
                      ios: "one-time-code",
                      android: "sms-otp",
                      default: "off",
                    })}
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                    style={styles.codeInput}
                    editable={!isLoading}
                    returnKeyType="done"
                    onFocus={() => scrollToField(codeFieldY)}
                    onSubmitEditing={verifyCode}
                    maxLength={6}
                    selectionColor={palette.purple}
                  />
                </View>

                <Pressable
                  onPress={verifyCode}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { opacity: isLoading ? 0.65 : pressed ? 0.92 : 1 },
                  ]}
                >
                  <LinearGradient
                    colors={[palette.purple, palette.purpleDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryButtonGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <View style={styles.primaryButtonIcon}>
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={palette.purpleDark}
                          />
                        </View>
                        <Text style={styles.primaryButtonText}>Войти</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <View style={styles.secondaryActions}>
                  <Pressable
                    onPress={() => {
                      setStep("phone");
                      setCode("");
                      setSentTo(null);
                      setResendLeft(0);
                      verifyInFlightRef.current = false;
                    }}
                    disabled={isLoading}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { opacity: pressed ? 0.9 : 1 },
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Изменить номер</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (!canResend || isLoading) return;
                      requestSms();
                    }}
                    disabled={!canResend || isLoading}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      {
                        opacity:
                          !canResend || isLoading ? 0.55 : pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {canResend ? "Отправить ещё раз" : `Через ${resendLeft}с`}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  scrollContent: {
    paddingHorizontal: 16,
  },

  blobTopRight: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 140,
    height: 100,
    backgroundColor: "rgba(109,76,255,0.14)",
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 12,
  },

  blobLeft: {
    position: "absolute",
    left: -28,
    top: 240,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(184,168,255,0.16)",
  },

  blobBottom: {
    position: "absolute",
    right: -20,
    bottom: 150,
    width: 120,
    height: 76,
    backgroundColor: "rgba(124,231,255,0.16)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  mainCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },

  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },

  stepChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  stepChipActive: {
    backgroundColor: palette.purple,
  },

  stepChipInactive: {
    backgroundColor: palette.cardSoft,
  },

  stepChipText: {
    fontSize: 12.5,
    fontWeight: "800",
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900",
    marginBottom: 8,
  },

  sectionSubtitle: {
    color: palette.subtext,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "600",
    marginBottom: 14,
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  infoBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  label: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 8,
  },

  inputShell: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  leadingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },

  codeShell: {
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 14,
  },

  codeInput: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 8,
  },

  primaryButton: {
    borderRadius: 22,
    overflow: "hidden",
  },

  primaryButtonGradient: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  smallText: {
    marginTop: 12,
    color: palette.muted,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },

  secondaryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  secondaryButtonText: {
    color: palette.purple,
    fontSize: 13.5,
    fontWeight: "900",
    textAlign: "center",
  },
});