// mobile/src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { getMe, updateMyProfile } from '../api/userApi';
import { presignAvatar, updateMe } from '../api/meApi';
import { useAuth } from '../auth/AuthContext';
import { getAnalyticsSummary, AnalyticsSummary } from '../api/analyticsApi';
import { useFocusEffect } from '@react-navigation/native';

type Level = 'beginner' | 'intermediate' | 'advanced';
type Gender = 'male' | 'female' | 'other' | 'unknown';

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

function makePalette(isDark: boolean) {
  return {
    bg: isDark ? '#0B0D12' : '#F4F6FA',
    card: isDark ? '#121625' : '#FFFFFF',
    text: isDark ? '#E9ECF5' : '#121722',
    subtext: isDark ? '#A9B1C7' : '#5C667A',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,24,40,0.08)',
    primary: '#2D6BFF',
    danger: '#E5484D',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7',
  };
}

function Section({
  title,
  subtitle,
  children,
  palette,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <View style={[styles.section, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={{ marginBottom: 10 }}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: palette.subtext }]}>{subtitle}</Text>
        ) : null}
      </View>
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
  palette,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  palette: ReturnType<typeof makePalette>;
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.fieldLabel, { color: palette.subtext }]}>{label}</Text>
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
            backgroundColor: palette.inputBg,
            color: palette.text,
            borderColor: palette.border,
            opacity: editable ? 1 : 0.75,
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
  palette,
}: {
  value: T;
  options: T[];
  getLabel: (v: T) => string;
  onChange: (v: T) => void;
  palette: ReturnType<typeof makePalette>;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.chip,
              {
                borderColor: active ? palette.primary : palette.border,
                backgroundColor: active ? 'rgba(45,107,255,0.14)' : 'transparent',
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? palette.primary : palette.text }]}>
              {getLabel(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const palette = useMemo(() => makePalette(scheme === 'dark'), [scheme]);

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

  const load = async () => {
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
  };

  const loadStats = async () => {
  setStatsLoading(true);
  try {
    const s = await getAnalyticsSummary();
    setStats(s);
  } catch {
    setStats(null);
  } finally {
    setStatsLoading(false);
  }
};

  useEffect(() => {
    load();
    loadStats();
  }, []);

  useFocusEffect(
  React.useCallback(() => {
    loadStats();
  }, []),
);

  const pickAndUploadAvatar = async () => {
    try {
      setUploadingAvatar(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Доступ', 'Разреши доступ к галерее, чтобы выбрать аватар');
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


      // сохраняем avatarUrl в users
      await updateMe({ avatarUrl: publicUrl });

      // обновляем UI сразу (если вдруг Image кеширует — добавим версию)
      setAvatarUrl(`${publicUrl}?v=${Date.now()}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось обновить аватар');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);

      // 1) сохраняем name в users
      const trimmedName = name.trim();
      await updateMe({ name: trimmedName || undefined });

      // 2) сохраняем профиль
      const hStr = heightCm.trim();
      const wStr = weightKg.trim();
      const h = hStr ? Number(hStr) : undefined;
      const w = wStr ? Number(wStr) : undefined;

      if (hStr && (Number.isNaN(h) || h < 50 || h > 260)) {
        return Alert.alert('Проверьте рост', 'Рост должен быть числом от 50 до 260');
      }
      if (wStr && (Number.isNaN(w) || w < 20 || w > 400)) {
        return Alert.alert('Проверьте вес', 'Вес должен быть числом от 20 до 400');
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
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Pressable
            onPress={pickAndUploadAvatar}
            disabled={uploadingAvatar}
            style={({ pressed }) => [{ opacity: pressed || uploadingAvatar ? 0.85 : 1 }]}
          >
            <View
              style={[
                styles.avatar,
                {
                  borderColor: palette.border,
                  backgroundColor: 'rgba(45,107,255,0.12)',
                  overflow: 'hidden',
                },
              ]}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.avatarText, { color: palette.primary }]}>{initials(name)}</Text>
              )}

              {/* маленькая плашка “изменить” */}
              <View
                style={[
                  styles.avatarBadge,
                  { backgroundColor: 'rgba(0,0,0,0.42)' },
                ]}
              >
                <Text style={styles.avatarBadgeText}>{uploadingAvatar ? '...' : '✎'}</Text>
              </View>
            </View>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {name?.trim() ? name : 'Пользователь'}
            </Text>
            <Text style={[styles.meta, { color: palette.subtext }]} numberOfLines={1}>
              {formatPhone(phone)} {userId ? `• ID: ${userId.slice(0, 8)}` : ''}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <View
              style={[
                styles.badge,
                { borderColor: palette.border, backgroundColor: 'rgba(45,107,255,0.10)' },
              ]}
            >
              <Text style={[styles.badgeText, { color: palette.primary }]}>{levelTitle(level)}</Text>
            </View>
          </View>
        </View>

        <Section
          title="Аккаунт"
          subtitle="Имя и аватар сохраняются в users"
          palette={palette}
        >
          <Field
            label="Имя"
            value={name}
            onChangeText={setName}
            placeholder="Как к вам обращаться"
            palette={palette}
          />
          <Field
            label="Телефон"
            value={formatPhone(phone)}
            placeholder="—"
            palette={palette}
            editable={false}
          />
        </Section>

        <Section title="Параметры" subtitle="То, что влияет на аналитику" palette={palette}>
          <Text style={[styles.fieldLabel, { color: palette.subtext, marginBottom: 8 }]}>Пол</Text>
          <ChipRow
            value={gender}
            options={['unknown', 'male', 'female', 'other']}
            getLabel={(g) => genderTitle(g as Gender)}
            onChange={(g) => setGender(g as Gender)}
            palette={palette}
          />

          <Text style={[styles.fieldLabel, { color: palette.subtext, marginTop: 14, marginBottom: 8 }]}>
            Уровень
          </Text>
          <ChipRow
            value={level}
            options={['beginner', 'intermediate', 'advanced']}
            getLabel={(l) => levelTitle(l as Level)}
            onChange={(l) => setLevel(l as Level)}
            palette={palette}
          />

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}>
              <Field
                label="Рост (см)"
                value={heightCm}
                onChangeText={(v) => setHeightCm(clampNumStr(v))}
                placeholder="180"
                keyboardType="numeric"
                palette={palette}
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
                palette={palette}
              />
            </View>
          </View>
        </Section>

        <Section title="Статистика" subtitle="Короткая сводка по прогрессу" palette={palette}>
  <View style={styles.statsRow}>
    <View style={[styles.statCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>
        {statsLoading ? '…' : String(stats?.workoutsLast7 ?? '—')}
      </Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>Трен. за 7 дней</Text>
    </View>

    <View style={[styles.statCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>
        {statsLoading ? '…' : String(stats?.prCount ?? '—')}
      </Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>PR</Text>
    </View>

    <View style={[styles.statCard, { borderColor: palette.border, backgroundColor: palette.inputBg }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>
        {statsLoading
          ? '…'
          : `${stats?.achievementsEarned ?? 0}/${stats?.achievementsTotal ?? 0}`}
      </Text>
      <Text style={[styles.statLabel, { color: palette.subtext }]}>Достижений</Text>
    </View>
  </View>

  <View style={{ marginTop: 10 }}>
    <Text style={[styles.smallMeta, { color: palette.subtext }]}>
      Всего тренировок: {statsLoading ? '…' : String(stats?.workoutsTotal ?? '—')}
    </Text>
  </View>

  <Pressable
    onPress={loadStats}
    style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 8, opacity: pressed ? 0.75 : 1 }]}
  >
    <Text style={[styles.link, { color: palette.primary }]}>Обновить</Text>
  </Pressable>
</Section>

        <Pressable
          style={[
            styles.primaryBtn,
            { backgroundColor: palette.primary, opacity: loading || saving ? 0.65 : 1 },
          ]}
          onPress={onSave}
          disabled={loading || saving}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Сохраняю…' : 'Сохранить изменения'}</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryBtn, { borderColor: palette.border, backgroundColor: palette.card }]}
          onPress={signOut}
        >
          <Text style={[styles.secondaryBtnText, { color: palette.danger }]}>Выйти</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingTop: 18 },

  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 2 }),
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },

  avatarBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },

  name: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  meta: { fontSize: 12.5, fontWeight: '600' },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },

  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 1 }),
  },
  sectionTitle: { fontSize: 15.5, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, fontSize: 12.5, fontWeight: '600' },

  fieldLabel: { fontSize: 12.5, fontWeight: '800' },
  input: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15.5,
    fontWeight: '700',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 13, fontWeight: '800' },

  twoCols: { flexDirection: 'row', marginTop: 10 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { marginTop: 4, fontSize: 12, fontWeight: '800' },

  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },

  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15.5, fontWeight: '900' },
  smallMeta: { fontSize: 12.5, fontWeight: '700' },
link: { fontSize: 13.5, fontWeight: '900' },
});
