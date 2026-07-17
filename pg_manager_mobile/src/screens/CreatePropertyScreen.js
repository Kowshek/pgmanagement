import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';

import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

// Shown once a logged-in user has zero properties — replaces the old
// OnboardingScreen, which just captured a local pgName/ownerName pair.
// Now it actually creates a Property row via POST /properties, since the
// backend is multi-tenant (a user can own several properties; this is
// just the "you have none yet" empty state).
export default function CreatePropertyScreen() {
  const createProperty = useStore((s) => s.createProperty);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const next = {};
    if (!name.trim()) next.name = 'Give your property a name.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const res = await createProperty({ name: name.trim(), city: city.trim() || undefined });
    setSaving(false);
    if (!res.ok) setErrors({ name: res.error });
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
            <Text style={styles.title}>Set up your property</Text>
            <Text style={styles.subtitle}>
              Give your PG a name to get started. You can add more properties later from
              Settings.
            </Text>
          </View>

          <FormField
            label="Property name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (errors.name) setErrors((e) => ({ ...e, name: null }));
            }}
            placeholder="e.g. Sunrise PG"
            error={errors.name}
            autoCapitalize="words"
            testID="create-property-name"
          />
          <FormField
            label="City (optional)"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Bengaluru"
            autoCapitalize="words"
            testID="create-property-city"
          />

          <PrimaryButton
            title={saving ? 'Creating…' : 'Create property'}
            onPress={handleCreate}
            disabled={saving}
            testID="create-property-submit"
          />
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
