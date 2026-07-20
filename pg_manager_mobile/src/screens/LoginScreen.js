import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function LoginScreen({ navigation }) {
  const login = useStore((s) => s.login);
  const authLoading = useStore((s) => s.authLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const handleLogin = async () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setFormError(null);
    const res = await login(email.trim(), password);
    if (!res.ok) setFormError(res.error);
    // On success the root navigator switches away from auth automatically.
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <LinearGradient
              colors={['#2C2C2C', '#111111']}
              style={styles.iconCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Building2 color="#FFFFFF" size={32} strokeWidth={2} />
            </LinearGradient>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to manage your PG properties.</Text>
          </View>

          <FormField
            label="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); clearError('email'); }}
            placeholder="you@example.com"
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            testID="login-email"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); clearError('password'); }}
            placeholder="••••••••"
            error={errors.password}
            secureTextEntry
            testID="login-password"
          />

          {!!formError && <Text style={styles.formError}>{formError}</Text>}

          <PrimaryButton
            title={authLoading ? 'Logging in…' : 'Log in'}
            onPress={handleLogin}
            disabled={authLoading}
            testID="login-submit"
          />

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => navigation.navigate('Register')}
            testID="go-to-register"
          >
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchLink}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg },
  hero: { alignItems: 'center', marginBottom: theme.spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  title: { ...theme.typography.h1, textAlign: 'center', marginBottom: theme.spacing.sm },
  subtitle: { ...theme.typography.bodySecondary, textAlign: 'center', lineHeight: 22 },
  formError: { ...theme.typography.caption, color: theme.colors.error, marginBottom: theme.spacing.md, textAlign: 'center' },
  switchRow: { marginTop: theme.spacing.lg, alignItems: 'center' },
  switchText: { ...theme.typography.bodySecondary },
  switchLink: { color: theme.colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
