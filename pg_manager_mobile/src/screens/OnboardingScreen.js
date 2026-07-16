import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';

import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function OnboardingScreen() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [pgName, setPgName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [errors, setErrors] = useState({});

  const handleStart = () => {
    const next = {};
    if (!pgName.trim()) next.pgName = 'Give your property a name.';
    if (!ownerName.trim()) next.ownerName = 'Tell us your name.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const res = completeOnboarding({ pgName, ownerName });
    if (!res.ok) setErrors({ ownerName: res.error });
    // On success the root navigator switches to the main app automatically.
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Building2 color={theme.colors.primary} size={32} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Welcome to PG Manager</Text>
            <Text style={styles.subtitle}>
              Track rooms, guests and rent payments for your paying-guest property — all offline,
              on your phone.
            </Text>
          </View>

          <FormField
            label="PG name"
            value={pgName}
            onChangeText={(v) => {
              setPgName(v);
              if (errors.pgName) setErrors((e) => ({ ...e, pgName: null }));
            }}
            placeholder="e.g. Sunrise PG"
            error={errors.pgName}
            autoCapitalize="words"
            testID="onboarding-pg-name"
          />
          <FormField
            label="Your name"
            value={ownerName}
            onChangeText={(v) => {
              setOwnerName(v);
              if (errors.ownerName) setErrors((e) => ({ ...e, ownerName: null }));
            }}
            placeholder="e.g. Kowshek"
            error={errors.ownerName}
            autoCapitalize="words"
            testID="onboarding-owner-name"
          />

          <PrimaryButton title="Get started" onPress={handleStart} testID="onboarding-submit" />
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
  subtitle: {
    ...theme.typography.bodySecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
  },
});
