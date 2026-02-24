import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

type Step = 'phone' | 'login' | 'register';

function normalizePhone(input: string) {
  return input.trim();
}

export default function PhoneAuthScreen() {
  const { demoCheckPhone, signInDemoLogin, signInDemoRegister, isLoading } = useAuth() as any;

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+7');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const title = useMemo(() => {
    if (step === 'phone') return 'Вход по телефону';
    if (step === 'login') return 'Введите пароль';
    return 'Регистрация';
  }, [step]);

  const onNext = async () => {
    try {
      const p = normalizePhone(phone);
      if (!p || p.length < 5) return Alert.alert('Ошибка', 'Введите телефон');

      const res = await demoCheckPhone(p);
      setStep(res.exists ? 'login' : 'register');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось проверить телефон');
    }
  };

  const onLogin = async () => {
    try {
      const p = normalizePhone(phone);
      if (!password || password.length < 6) return Alert.alert('Ошибка', 'Пароль минимум 6 символов');

      await signInDemoLogin({ phone: p, password });
      // если всё ок — AuthNavigator сам переключит на AppStack по токену в контексте
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось войти');
    }
  };

  const onRegister = async () => {
    try {
      const p = normalizePhone(phone);
      if (!password || password.length < 6) return Alert.alert('Ошибка', 'Пароль минимум 6 символов');
      await signInDemoRegister({ phone: p, password, name: name.trim() || undefined });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось зарегистрироваться');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+79991234567"
        keyboardType="phone-pad"
        autoCapitalize="none"
        style={styles.input}
        editable={step === 'phone' && !isLoading}
      />

      {step === 'login' ? (
        <>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль"
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            editable={!isLoading}
          />

          <Pressable style={[styles.btn, isLoading && { opacity: 0.6 }]} onPress={onLogin} disabled={isLoading}>
            <Text style={styles.btnText}>Войти</Text>
          </Pressable>

          <Pressable style={styles.link} onPress={() => { setStep('phone'); setPassword(''); }}>
            <Text style={styles.linkText}>Изменить телефон</Text>
          </Pressable>
        </>
      ) : null}

      {step === 'register' ? (
        <>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Имя (необязательно)"
            autoCapitalize="words"
            style={styles.input}
            editable={!isLoading}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль (мин 6 символов)"
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            editable={!isLoading}
          />

          <Pressable style={[styles.btn, isLoading && { opacity: 0.6 }]} onPress={onRegister} disabled={isLoading}>
            <Text style={styles.btnText}>Зарегистрироваться</Text>
          </Pressable>

          <Pressable style={styles.link} onPress={() => { setStep('phone'); setPassword(''); setName(''); }}>
            <Text style={styles.linkText}>Изменить телефон</Text>
          </Pressable>
        </>
      ) : null}

      {step === 'phone' ? (
        <Pressable style={[styles.btn, isLoading && { opacity: 0.6 }]} onPress={onNext} disabled={isLoading}>
          <Text style={styles.btnText}>Далее</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  btn: { width: '100%', padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#1976D2' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 12, alignItems: 'center' },
  linkText: { color: '#1976D2', fontWeight: '600' },
});
