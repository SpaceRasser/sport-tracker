import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const palette = {
  purple: '#6D4CFF',
  purpleDark: '#5137D7',
  text: '#2D244D',
  subtext: '#7D739D',
  line: '#E6E0FA',
  card: '#FFFFFF',
  cardSoft: '#F4F0FF',
};

type Props = {
  visible: boolean;
  step: string;
  title: string;
  text: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

export default function OnboardingHint({
  visible,
  step,
  title,
  text,
  primaryLabel = 'Далее',
  secondaryLabel = 'Пропустить',
  onPrimary,
  onSecondary,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSecondary}>
      <View style={styles.overlay}>
        <View style={styles.backdrop} />

        <View style={styles.wrap}>
          <View style={styles.card}>
            <LinearGradient
              colors={[palette.purple, palette.purpleDark, '#7B61FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerIcon}>
                <Ionicons name="sparkles-outline" size={18} color={palette.purpleDark} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.step}>{step}</Text>
                <Text style={styles.title}>{title}</Text>
              </View>
            </LinearGradient>

            <View style={styles.body}>
              <Text style={styles.text}>{text}</Text>

              <View style={styles.actions}>
                <Pressable onPress={onSecondary} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
                  <View style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
                  </View>
                </Pressable>

                <Pressable onPress={onPrimary} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, flex: 1 }]}>
                  <LinearGradient
                    colors={[palette.purple, palette.purpleDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45,36,77,0.42)',
  },
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  card: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  header: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  body: {
    padding: 16,
    backgroundColor: palette.card,
  },
  text: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});