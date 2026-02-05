import { useState } from "react";
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { API_URL } from "./src/config";

type HealthResponse = {
  status?: string;
  message?: string;
  error?: string;
};

export default function App() {
  const [result, setResult] = useState<string>("Нажмите кнопку для проверки");
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckApi = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = (await response.json()) as HealthResponse;

      if (data.status === "ok") {
        setResult("API OK");
      } else {
        const errorText = data.error ?? data.message ?? "Unknown API error";
        setResult(`Ошибка: ${errorText}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setResult(`Ошибка: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sport Tracker Mobile</Text>
        <Text style={styles.subtitle}>API: {API_URL}</Text>
        <Button title="Check API" onPress={handleCheckApi} />
        <View style={styles.resultContainer}>
          {isLoading ? <ActivityIndicator /> : <Text style={styles.resultText}>{result}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "#4b5563",
  },
  resultContainer: {
    marginTop: 12,
    minHeight: 24,
    alignItems: "center",
  },
  resultText: {
    fontSize: 16,
    textAlign: "center",
  },
});
