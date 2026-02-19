import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function ProfileScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Профиль</Text>
      <Text>Позже: данные пользователя, уровень, цели.</Text>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Выйти</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  button: { marginTop: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: '#b00020' },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
