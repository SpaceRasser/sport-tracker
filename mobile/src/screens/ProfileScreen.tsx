// mobile/src/screens/ProfileScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';

import { getMe, updateMyProfile } from '../api/userApi';
import { presignAvatar, updateMe } from '../api/meApi';
import { useAuth } from '../auth/AuthContext';
import { getAnalyticsSummary, AnalyticsSummary } from '../api/analyticsApi';

type Level = 'beginner' | 'intermediate' | 'advanced';
type Gender = 'male' | 'female' | 'other' | 'unknown';

const NOTIF_ENABLED_KEY = 'notif_enabled_v1';
const REMINDER_CHANNEL_ID = 'reminders';

const palette = {
  bg: '#F5F2FF',
  bg2: '#EEE9FF',
  card: '#FFFFFF',
  cardSoft: '#F4F0FF',

  purple: '#6D4CFF',
  purpleDark: '#5137D7',

  text: '#2D244D',
  subtext: '#7D739D',
  muted: '#9D95BA',
  line: '#E6E0FA',

  cyan: '#7CE7FF',
  pink: '#FF8DD8',
  orange: '#FFB36B',
  green: '#24A865',
  danger: '#E5484D',
  successSoft: 'rgba(36,168,101,0.10)',
  dangerSoft: 'rgba(229,72,77,0.10)',
};

function clampNumStr(value: string) {
  return value.replace(/[^\d.,]/g, '').replace(',', '.');
}

function formatPhone(phone?: string | null) {
  if (!phone) return '—';
  return phone;
}

function initials(name?: string | null) {
  const n = (name ?? '').trim();
  if (!n) return 'U';
  const parts = n.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function levelTitle(level: Level) {
  if (level === 'beginner') return 'Новичок';
  if (level === 'intermediate') return 'Средний';
  return 'Продвинутый';
}

function genderTitle(g: Gender) {
  if (g === 'male') return 'Мужской';
  if (g === 'female') return 'Женский';
  if (g === 'other') return 'Другое';
  return 'Не указано';
}

async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Полезные напоминания',
    description: 'Напоминания о тренировках и полезные уведомления приложения',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6D4CFF',
    sound: 'default',
    showBadge: true,
  });
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

function SummaryStat({
  value,
  label,
  tint,
  icon,
}: {
  value: string;
  label: string;
  tint: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryStatIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.mainCard}>
      <Text style={styles.sectionKicker}>{kicker}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionDescription}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.subtext}
        keyboardType={keyboardType ?? 'default'}
        editable={editable}
        style={[
          styles.input,
          {
            opacity: editable ? 1 : 0.72,
          },
        ]}
      />
    </View>
  );
}

function ChipRow<T extends string>({
  value,
  options,
  getLabel,
  onChange,
}: {
  value: T;
  options: T[];
  getLabel: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? palette.purple : palette.cardSoft,
                borderColor: active ? palette.purple : palette.line,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : palette.text }]}>
              {getLabel(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [gender, setGender] = useState<Gender>('unknown');
  const [level, setLevel] = useState<Level>('beginner');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [notifToggle, setNotifToggle] = useState(true);
  const [systemNotifGranted, setSystemNotifGranted] = useState<boolean | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMe();
      const u = data.user;

      setUserId(u.id);
      setName(u.name ?? '');
      setPhone(u.phone ?? null);
      setAvatarUrl(u.avatarUrl ?? null);

      const p = u.profile;
      setGender((p?.gender as Gender) ?? 'unknown');
      setLevel((p?.level as Level) ?? 'beginner');
      setHeightCm(p?.heightCm != null ? String(p.heightCm) : '');
      setWeightKg(p?.weightKg != null ? String(p.weightKg) : '');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await getAnalyticsSummary();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadNotifState = useCallback(async () => {
    try {
      await ensureReminderChannel();

      const saved = await SecureStore.getItemAsync(NOTIF_ENABLED_KEY);
      setNotifToggle(saved !== '0');

      const perms = await Notifications.getPermissionsAsync();
      const granted = perms?.granted || perms?.status === 'granted';
      setSystemNotifGranted(!!granted);
    } catch {
      setSystemNotifGranted(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
      loadStats().catch(() => {});
      loadNotifState().catch(() => {});
    }, [load, loadStats, loadNotifState])
  );

  const pickAndUploadAvatar = useCallback(async () => {
    try {
      setUploadingAvatar(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Доступ', 'Разрешите доступ к галерее, чтобы выбрать аватар.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const contentType = asset.mimeType ?? 'image/jpeg';

      const { uploadUrl, publicUrl } = await presignAvatar(contentType);

      const fileRes = await fetch(uri);
      const blob = await fileRes.blob();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => '');
        throw new Error(`Upload failed: ${putRes.status} ${txt}`);
      }

      await updateMe({ avatarUrl: publicUrl });
      setAvatarUrl(`${publicUrl}?v=${Date.now()}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const onSave = useCallback(async () => {
    try {
      setSaving(true);

      const trimmedName = name.trim();
      await updateMe({ name: trimmedName || undefined });

      const hStr = heightCm.trim();
      const wStr = weightKg.trim();
      const h = hStr ? Number(hStr) : undefined;
      const w = wStr ? Number(wStr) : undefined;

      if (hStr && (Number.isNaN(h) || (h as number) < 50 || (h as number) > 260)) {
        Alert.alert('Проверьте рост', 'Рост должен быть числом от 50 до 260.');
        return;
      }
      if (wStr && (Number.isNaN(w) || (w as number) < 20 || (w as number) > 400)) {
        Alert.alert('Проверьте вес', 'Вес должен быть числом от 20 до 400.');
        return;
      }

      await updateMyProfile({
        gender,
        level,
        heightCm: h,
        weightKg: w,
      });

      await load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }, [name, heightCm, weightKg, gender, level, load]);

  const onToggleNotifications = useCallback(async (next: boolean) => {
    setNotifBusy(true);

    try {
      setNotifToggle(next);
      await SecureStore.setItemAsync(NOTIF_ENABLED_KEY, next ? '1' : '0');

      if (!next) {
        return;
      }

      await ensureReminderChannel();

      const current = await Notifications.getPermissionsAsync();
      const alreadyGranted = current?.granted || current?.status === 'granted';

      if (alreadyGranted) {
        setSystemNotifGranted(true);
        return;
      }

      if (current?.canAskAgain === false) {
        setSystemNotifGranted(false);
        Alert.alert(
          'Уведомления',
          'Системное разрешение уже отклонено. Включите уведомления в настройках телефона.',
          [
            { text: 'Позже', style: 'cancel' },
            {
              text: 'Открыть настройки',
              onPress: () => Notifications.openSettings(),
            },
          ]
        );
        return;
      }

      const req = await Notifications.requestPermissionsAsync();
      const granted = req?.granted || req?.status === 'granted';
      setSystemNotifGranted(!!granted);

      if (!granted) {
        if (req?.canAskAgain === false) {
          Alert.alert(
            'Уведомления',
            'Разрешение не выдано. Откройте настройки телефона, чтобы включить уведомления.',
            [
              { text: 'Позже', style: 'cancel' },
              {
                text: 'Открыть настройки',
                onPress: () => Notifications.openSettings(),
              },
            ]
          );
        } else {
          Alert.alert(
            'Уведомления',
            'Разрешение не выдано. Вы можете включить уведомления позже.'
          );
        }
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось обновить настройки уведомлений.');
    } finally {
      setNotifBusy(false);
    }
  }, []);

  const notifStatusText = useMemo(() => {
    if (!notifToggle) return 'Выключены в приложении';
    if (systemNotifGranted === false) return 'Нужно разрешение системы';
    if (systemNotifGranted === true) return 'Включены';
    return 'Статус неизвестен';
  }, [notifToggle, systemNotifGranted]);

  const notifStatusColor = useMemo(() => {
    if (!notifToggle) return palette.subtext;
    if (systemNotifGranted === false) return palette.danger;
    if (systemNotifGranted === true) return palette.green;
    return palette.subtext;
  }, [notifToggle, systemNotifGranted]);

  const workouts7 = statsLoading ? '—' : String(stats?.workoutsLast7 ?? '—');
  const prCount = statsLoading ? '—' : String(stats?.prCount ?? '—');
  const achValue = statsLoading ? '—' : `${stats?.achievementsEarned ?? 0}/${stats?.achievementsTotal ?? 0}`;
  const totalWorkouts = statsLoading ? '—' : String(stats?.workoutsTotal ?? '—');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      <LinearGradient colors={[palette.bg, palette.bg2]} style={StyleSheet.absoluteFill} />

      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobLeft} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[palette.purple, palette.purpleDark, '#7B61FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />

          <Text style={styles.heroKicker}>SPORTTRACKER</Text>
          <Text style={styles.heroTitle}>Профиль</Text>
          <Text style={styles.heroSubtitle}>
            Управляйте личными данными, уведомлениями и основными параметрами для аналитики.
          </Text>

          <View style={styles.heroProfileRow}>
            <Pressable
              onPress={pickAndUploadAvatar}
              disabled={uploadingAvatar}
              style={({ pressed }) => [{ opacity: pressed || uploadingAvatar ? 0.88 : 1 }]}
            >
              <View style={styles.heroAvatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Text style={styles.heroAvatarText}>{initials(name)}</Text>
                )}

                <View style={styles.heroAvatarBadge}>
                  <Text style={styles.heroAvatarBadgeText}>{uploadingAvatar ? '…' : '✎'}</Text>
                </View>
              </View>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {name?.trim() ? name : 'Пользователь'}
              </Text>
              <Text style={styles.heroMeta} numberOfLines={1}>
                {formatPhone(phone)}
              </Text>

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{levelTitle(level)}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <SummaryStat
            value={workouts7}
            label="за 7 дней"
            tint="rgba(124,231,255,0.28)"
            icon={<Ionicons name="calendar-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={prCount}
            label="личных рекордов"
            tint="rgba(255,179,107,0.28)"
            icon={<Ionicons name="flash-outline" size={18} color={palette.purple} />}
          />
          <SummaryStat
            value={achValue}
            label="достижений"
            tint="rgba(255,141,216,0.28)"
            icon={<Ionicons name="trophy-outline" size={18} color={palette.purple} />}
          />
        </View>

        <SectionCard
          kicker="УВЕДОМЛЕНИЯ"
          title="Полезные напоминания"
          subtitle="Управляйте уведомлениями внутри приложения и проверяйте системный доступ."
        >
          <View style={styles.badgesRow}>
            <InfoBadge
              icon={<Ionicons name="notifications-outline" size={14} color={palette.purple} />}
              label="Напоминания"
            />
            <InfoBadge
              icon={<Ionicons name="shield-checkmark-outline" size={14} color={palette.purple} />}
              label="Контроль доступа"
            />
          </View>

          <View style={styles.notificationRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationTitle}>Получать уведомления</Text>
              <Text style={[styles.notificationSub, { color: notifStatusColor }]}>
                {notifStatusText}
              </Text>
            </View>

            <Switch
              value={notifToggle}
              onValueChange={onToggleNotifications}
              disabled={notifBusy}
              trackColor={{ false: 'rgba(0,0,0,0.18)', true: 'rgba(109,76,255,0.35)' }}
              thumbColor={notifToggle ? palette.purple : '#bbb'}
            />
          </View>

          {notifToggle && systemNotifGranted === false ? (
            <Pressable
              onPress={() => Notifications.openSettings()}
              style={({ pressed }) => [{ marginTop: 10, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.linkText}>Открыть настройки уведомлений →</Text>
            </Pressable>
          ) : null}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Мы используем уведомления для полезных напоминаний о тренировках и активности.
            </Text>
          </View>
        </SectionCard>

        <SectionCard
          kicker="АККАУНТ"
          title="Личные данные"
          subtitle="Имя, аватар и контактная информация."
        >
          <Field
            label="Имя"
            value={name}
            onChangeText={setName}
            placeholder="Как к Вам обращаться"
          />
          <Field
            label="Телефон"
            value={formatPhone(phone)}
            placeholder="—"
            editable={false}
          />

          <Text style={styles.smallMeta}>
            {userId ? `ID пользователя: ${userId.slice(0, 8)}` : 'ID недоступен'}
          </Text>
        </SectionCard>

        <SectionCard
          kicker="ПАРАМЕТРЫ"
          title="Данные для аналитики"
          subtitle="Эти значения помогают точнее считать прогресс и рекомендации."
        >
          <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>Пол</Text>
          <ChipRow
            value={gender}
            options={['unknown', 'male', 'female', 'other']}
            getLabel={(g) => genderTitle(g as Gender)}
            onChange={(g) => setGender(g as Gender)}
          />

          <Text style={[styles.fieldLabel, { marginTop: 14, marginBottom: 8 }]}>Уровень</Text>
          <ChipRow
            value={level}
            options={['beginner', 'intermediate', 'advanced']}
            getLabel={(l) => levelTitle(l as Level)}
            onChange={(l) => setLevel(l as Level)}
          />

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}>
              <Field
                label="Рост (см)"
                value={heightCm}
                onChangeText={(v) => setHeightCm(clampNumStr(v))}
                placeholder="180"
                keyboardType="numeric"
              />
            </View>

            <View style={{ width: 12 }} />

            <View style={{ flex: 1 }}>
              <Field
                label="Вес (кг)"
                value={weightKg}
                onChangeText={(v) => setWeightKg(clampNumStr(v))}
                placeholder="75"
                keyboardType="numeric"
              />
            </View>
          </View>
        </SectionCard>

        <SectionCard
          kicker="СТАТИСТИКА"
          title="Короткая сводка"
          subtitle="Главные показатели Вашего текущего прогресса."
        >
          <View style={styles.statsMiniRow}>
            <SummaryStat
              value={workouts7}
              label="трен. за 7 дней"
              tint="rgba(124,231,255,0.28)"
              icon={<Ionicons name="calendar-outline" size={18} color={palette.purple} />}
            />
            <SummaryStat
              value={prCount}
              label="PR"
              tint="rgba(255,179,107,0.28)"
              icon={<Ionicons name="flash-outline" size={18} color={palette.purple} />}
            />
            <SummaryStat
              value={achValue}
              label="достижений"
              tint="rgba(255,141,216,0.28)"
              icon={<Ionicons name="trophy-outline" size={18} color={palette.purple} />}
            />
          </View>

          <Text style={styles.smallMeta}>Всего тренировок: {totalWorkouts}</Text>
        </SectionCard>

        <Pressable
          style={({ pressed }) => [
            styles.saveButtonWrap,
            { opacity: loading || saving ? 0.65 : pressed ? 0.9 : 1 },
          ]}
          onPress={onSave}
          disabled={loading || saving}
        >
          <LinearGradient
            colors={[palette.purple, palette.purpleDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveButton}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Сохраняем…' : 'Сохранить изменения'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          onPress={signOut}
        >
          <View style={styles.logoutButton}>
            <MaterialCommunityIcons name="logout" size={18} color={palette.danger} />
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </View>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  blobTopRight: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 100,
    backgroundColor: 'rgba(109,76,255,0.14)',
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 22,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 12,
  },

  blobLeft: {
    position: 'absolute',
    left: -28,
    top: 240,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(184,168,255,0.16)',
  },

  blobBottom: {
    position: 'absolute',
    right: -20,
    bottom: 150,
    width: 120,
    height: 76,
    backgroundColor: 'rgba(124,231,255,0.16)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  heroCard: {
    minHeight: 240,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#6D4CFF',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  heroBlobTop: {
    position: 'absolute',
    top: -20,
    right: -12,
    width: 120,
    height: 84,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderBottomLeftRadius: 56,
    borderBottomRightRadius: 26,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 16,
  },

  heroBlobBottom: {
    position: 'absolute',
    bottom: -12,
    left: -10,
    width: 128,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 38,
  },

  heroKicker: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    marginBottom: 10,
    maxWidth: '86%',
  },

  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    maxWidth: '92%',
    marginBottom: 18,
  },

  heroProfileRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  heroAvatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroAvatarText: {
    color: palette.purple,
    fontSize: 22,
    fontWeight: '900',
  },

  heroAvatarBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  heroAvatarBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
  },

  heroName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  heroMeta: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 3,
  },

  heroBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  heroBadgeText: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: '900',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },

  statsMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
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
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '900',
    marginBottom: 8,
  },

  sectionDescription: {
    color: palette.subtext,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 16,
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.cardSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  infoBadgeText: {
    color: palette.purple,
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 6,
  },

  notificationRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.cardSoft,
  },

  notificationTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontWeight: '900',
  },

  notificationSub: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '800',
  },

  hintBox: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
    backgroundColor: palette.successSoft,
  },

  hintText: {
    color: palette.text,
    fontSize: 12.5,
    fontWeight: '800',
    lineHeight: 18,
  },

  linkText: {
    color: palette.purple,
    fontSize: 13.5,
    fontWeight: '900',
  },

  fieldLabel: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: '900',
  },

  input: {
    marginTop: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15.5,
    fontWeight: '800',
    color: palette.text,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '900',
  },

  twoCols: {
    flexDirection: 'row',
    marginTop: 10,
  },

  summaryStat: {
    flex: 1,
    backgroundColor: palette.cardSoft,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
  },

  summaryStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  summaryStatValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },

  summaryStatLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },

  smallMeta: {
    color: palette.subtext,
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 10,
  },

  saveButtonWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 2,
  },

  saveButton: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '900',
  },

  logoutButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    flexDirection: 'row',
    gap: 10,
  },

  logoutButtonText: {
    color: palette.danger,
    fontSize: 15.5,
    fontWeight: '900',
  },
});