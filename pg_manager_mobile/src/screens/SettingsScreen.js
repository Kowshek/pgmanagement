import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BackHeader from '../components/BackHeader';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { confirm, notify } from '../lib/confirm';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const APP_VERSION = require('../../package.json').version;

export default function SettingsScreen() {
  const pgDetails = useStore((s) => s.pgDetails);
  const updatePgDetails = useStore((s) => s.updatePgDetails);
  const eraseAllData = useStore((s) => s.eraseAllData);

  const [pgName, setPgName] = useState(pgDetails.pgName);
  const [ownerName, setOwnerName] = useState(pgDetails.ownerName);
  const [error, setError] = useState(null);

  const dirty = pgName !== pgDetails.pgName || ownerName !== pgDetails.ownerName;

  const handleSave = () => {
    const res = updatePgDetails({ pgName, ownerName });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    notify('Saved', 'Property details updated.');
  };

  const handleErase = () => {
    confirm({
      title: 'Erase all data?',
      message:
        'This permanently deletes every room, guest and payment on this device and cannot be undone.',
      confirmLabel: 'Erase everything',
      destructive: true,
      onConfirm: () => eraseAllData(),
      // The root navigator returns to onboarding automatically.
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Settings" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Property</Text>
          <FormField
            label="PG name"
            value={pgName}
            onChangeText={setPgName}
            placeholder="e.g. Sunrise PG"
            autoCapitalize="words"
            testID="settings-pg-name"
          />
          <FormField
            label="Owner name"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Kowshek"
            error={error}
            autoCapitalize="words"
            testID="settings-owner-name"
          />
          <PrimaryButton title="Save changes" onPress={handleSave} disabled={!dirty} testID="settings-save" />

          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger zone</Text>
          <View style={styles.dangerCard}>
            <View style={styles.dangerText}>
              <Text style={styles.dangerHeading}>Erase all data</Text>
              <Text style={styles.dangerDescription}>
                Removes all rooms, guests and payments and restarts setup.
              </Text>
            </View>
            <PrimaryButton
              title="Erase"
              variant="danger"
              onPress={handleErase}
              style={styles.dangerButton}
              testID="settings-erase"
            />
          </View>

          <Text style={styles.version}>PG Manager v{APP_VERSION}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  content: { padding: theme.spacing.lg },
  sectionTitle: { ...theme.typography.h3, marginBottom: theme.spacing.md },
  dangerTitle: { marginTop: theme.spacing.xl, color: theme.colors.error },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.error + '30',
    padding: theme.spacing.md,
  },
  dangerText: { flex: 1 },
  dangerHeading: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  dangerDescription: { ...theme.typography.caption, lineHeight: 18 },
  dangerButton: { paddingHorizontal: theme.spacing.lg, paddingVertical: 12 },
  version: {
    ...theme.typography.small,
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
  },
});
