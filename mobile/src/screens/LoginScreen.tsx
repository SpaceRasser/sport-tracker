import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";

const { width } = Dimensions.get("window");
const HERO_WIDTH = Math.min(width - 32, 360);

const palette = {
  bg: "#F5F2FF",
  bg2: "#EEE9FF",
  card: "#FFFFFF",
  cardSoft: "#F4F0FF",

  purple: "#6D4CFF",
  purpleDark: "#5137D7",
  purpleSoft: "#B8A8FF",
  purpleSoft2: "#D8CFFF",

  text: "#2D244D",
  subtext: "#7D739D",
  muted: "#9D95BA",
  line: "#E6E0FA",

  cyan: "#7CE7FF",
  pink: "#FF8DD8",
  lime: "#D9F36A",
  orange: "#FFB36B",
};

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.featureChip}>
      {icon}
      <Text style={styles.featureChipText}>{label}</Text>
    </View>
  );
}

function MetricCard({
  value,
  label,
  icon,
  tint,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PrimaryButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <LinearGradient
        colors={[palette.purple, palette.purpleDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <View style={styles.primaryButtonIcon}>
          <Ionicons name="shield-checkmark" size={20} color={palette.purpleDark} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.primaryButtonTitle}>{title}</Text>
          <Text style={styles.primaryButtonSubtitle}>{subtitle}</Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
      <View style={styles.secondaryButton}>
        <View style={styles.secondaryButtonIcon}>
          <Ionicons name="chatbubble-ellipses" size={20} color={palette.purple} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.secondaryButtonTitle}>{title}</Text>
          <Text style={styles.secondaryButtonSubtitle}>{subtitle}</Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color={palette.purple} />
      </View>
    </Pressable>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { signInVkNative } = useAuth() as any;

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
          "Не удалось выполнить вход через VK ID"
      );
    }
  };

  const onSmsPress = () => {
    navigation.navigate("PhoneAuth");
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />

      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.topBar}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>ST</Text>
              </View>

              <View style={styles.topBarRight}>
                <Ionicons name="sparkles" size={18} color={palette.purple} />
              </View>
            </View>

            <LinearGradient
              colors={[palette.purple, "#5D42F2", "#7B61FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroBlobTop} />
              <View style={styles.heroBlobBottomLeft} />
              <View style={styles.heroBlobBottomRight} />

              <Text style={styles.heroKicker}>SPORTTRACKER</Text>
              <Text style={styles.heroTitle}>
                Добро пожаловать{"\n"}в SportTracker
              </Text>
              <Text style={styles.heroSubtitle}>
                Отслеживайте тренировки, прогресс и личные рекорды в одном месте.
              </Text>

              <View style={styles.heroPlayWrap}>
                <Pressable onPress={onVkPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
                  <View style={styles.heroPlayButton}>
                    <Ionicons name="play" size={28} color={palette.purple} style={{ marginLeft: 3 }} />
                  </View>
                </Pressable>
              </View>

              <Text style={styles.heroHint}>Быстрый вход через VK ID</Text>
            </LinearGradient>

            <View style={styles.metricsRow}>
              <MetricCard
                value="7"
                label="тренировок"
                tint="rgba(124, 231, 255, 0.28)"
                icon={<Ionicons name="barbell" size={18} color={palette.purple} />}
              />
              <MetricCard
                value="1666"
                label="ккал"
                tint="rgba(255, 179, 107, 0.28)"
                icon={<MaterialCommunityIcons name="fire" size={18} color={palette.purple} />}
              />
              <MetricCard
                value="+12%"
                label="прогресс"
                tint="rgba(255, 141, 216, 0.28)"
                icon={<Ionicons name="trending-up" size={18} color={palette.purple} />}
              />
            </View>

            <View style={styles.mainCard}>
              <Text style={styles.sectionKicker}>ВХОД</Text>
              <Text style={styles.sectionTitle}>Выберите способ входа</Text>
              <Text style={styles.sectionDescription}>
                Войдите через VK ID или получите код подтверждения по SMS.
              </Text>

              <View style={styles.featureRow}>
                <FeatureChip
                  icon={<Ionicons name="flash" size={14} color={palette.purple} />}
                  label="Быстро"
                />
                <FeatureChip
                  icon={<Ionicons name="trophy-outline" size={14} color={palette.purple} />}
                  label="Рекорды"
                />
                <FeatureChip
                  icon={<Ionicons name="stats-chart" size={14} color={palette.purple} />}
                  label="Прогресс"
                />
              </View>

              <View style={styles.actions}>
                <PrimaryButton
                  title="Войти через VK ID"
                  subtitle="Android • через приложение VK"
                  onPress={onVkPress}
                />

                <View style={{ height: 12 }} />

                <SecondaryButton
                  title="Войти по SMS"
                  subtitle="Код подтверждения на номер телефона"
                  onPress={onSmsPress}
                />
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCard}>
                <View style={[styles.infoIcon, { backgroundColor: "#ECE7FF" }]}>
                  <Ionicons name="lock-closed" size={18} color={palette.purple} />
                </View>
                <Text style={styles.infoTitle}>Безопасный вход</Text>
                <Text style={styles.infoText}>
                  Ваши данные используются только для авторизации и работы приложения.
                </Text>
              </View>

              <View style={styles.infoCard}>
                <View style={[styles.infoIcon, { backgroundColor: "#EEF9FF" }]}>
                  <Ionicons name="fitness" size={18} color={palette.purple} />
                </View>
                <Text style={styles.infoTitle}>Ваш прогресс</Text>
                <Text style={styles.infoText}>
                  Следите за тренировками, калориями и личными достижениями.
                </Text>
              </View>
            </View>

            <Text style={styles.legal}>
              Продолжая, Вы соглашаетесь с обработкой данных для входа и ведения статистики тренировок.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingTop: 8,
    paddingBottom: 24,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.purple,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6D4CFF",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  topBarRight: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    width: HERO_WIDTH,
    alignSelf: "center",
    minHeight: 320,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: "hidden",
    marginBottom: 18,
    shadowColor: "#6D4CFF",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },

  heroBlobTop: {
    position: "absolute",
    top: -26,
    right: -18,
    width: 150,
    height: 110,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderBottomLeftRadius: 64,
    borderBottomRightRadius: 32,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 18,
  },

  heroBlobBottomLeft: {
    position: "absolute",
    bottom: -18,
    left: -8,
    width: 130,
    height: 70,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 90,
    borderBottomRightRadius: 40,
  },

  heroBlobBottomRight: {
    position: "absolute",
    bottom: -12,
    right: 20,
    width: 120,
    height: 64,
    backgroundColor: "rgba(124, 231, 255, 0.22)",
    borderTopLeftRadius: 50,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 80,
  },

  heroKicker: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 10,
    maxWidth: "86%",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    maxWidth: "88%",
    marginBottom: 26,
  },

  heroPlayWrap: {
    alignItems: "center",
    marginTop: 6,
    marginBottom: 14,
  },

  heroPlayButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2D244D",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },

  heroHint: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },

  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },

  metricCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.line,
  },

  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  metricValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
  },

  metricLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  mainCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },

  sectionKicker: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: "900",
    marginBottom: 8,
  },

  sectionDescription: {
    color: palette.subtext,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 16,
  },

  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },

  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  featureChipText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: "800",
    marginLeft: 6,
  },

  actions: {
    marginTop: 2,
  },

  primaryButton: {
    minHeight: 68,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  primaryButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  primaryButtonTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  primaryButtonSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 3,
  },

  secondaryButton: {
    minHeight: 68,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },

  secondaryButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  secondaryButtonTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },

  secondaryButtonSubtitle: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 3,
  },

  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  infoCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },

  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  infoTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },

  infoText: {
    color: palette.subtext,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  legal: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    paddingHorizontal: 6,
  },
});