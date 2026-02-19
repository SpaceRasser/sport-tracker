import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AddWorkoutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Добавить тренировку</Text>
      <Text>Позже: форма по schema активности.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
});
