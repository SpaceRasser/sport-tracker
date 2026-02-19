import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { api } from '../api/client';

export default function HomeScreen() {
  const [status, setStatus] = useState<string>('Не проверял');

  const checkHealth = async () => {
    try {
      setStatus('Проверяю...');
      const res = await api.get('/health');
      setStatus(`OK: ${res.data?.ts ?? 'no ts'}`);
    } catch (e: any) {
      setStatus(`Ошибка: ${e?.message ?? 'unknown'}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Главная</Text>

      <Pressable style={styles.button} onPress={checkHealth}>
        <Text style={styles.buttonText}>Проверить сервер</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  button: { paddingVertical: 12, borderRadius: 10, backgroundColor: '#111' },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  status: { opacity: 0.8 },
});
