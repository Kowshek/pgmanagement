import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus } from 'lucide-react-native';

import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function RegisterScreen({ navigation }) {
  const register = useStore((s) => s.register);
  const authLoading = useStore((s) => s.authLoading);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const handleRegister = async () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Your name is required.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email.';
    if (password.length < 8) next.password = 'At least 8 characters.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setFormError(null);
    const res = await register(email.trim(), password, fullName.trim());
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
            <View style={styles.iconCircle}>
              <UserPlus color={theme.colors.primary} size={32} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Set up an account to start managing your PG.</Text>
          </View>

          <FormField
            label="Full name"
            value={fullName}
            onChangeText={(v) => { setFullName(v); clearError('fullName'); }}
            placeholder="e.g. Kowshek"
            error={errors.fullName}
            autoCapitalize="words"
            testID="register-name"
          />
          <FormField
            label="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); clearError('email'); }}
            placeholder="you@example.com"
            error={errors.email}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            testID="register-email"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); clearError('password'); }}
            placeholder="At least 8 characters"
            error={errors.password}
            secureTextEntry
            testID="register-password"
          />

          {!!formError && <Text style={styles.formError}>{formError}</Text>}

          <PrimaryButton
            title={authLoading ? 'Creating account…' : 'Sign up'}
            onPress={handleRegister}
            disabled={authLoading}
            testID="register-submit"
          />

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => navigation.navigate('Login')}
            testID="go-to-login"
          >
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Log in</Text>
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
