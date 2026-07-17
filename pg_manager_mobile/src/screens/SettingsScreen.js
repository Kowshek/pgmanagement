import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, LogOut } from 'lucide-react-native';

import BackHeader from '../components/BackHeader';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { confirm, notify } from '../lib/confirm';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const APP_VERSION = require('../../package.json').version;

export default function SettingsScreen() {
  const user = useStore((s) => s.user);
  const properties = useStore((s) => s.properties);
  const currentPropertyId = useStore((s) => s.currentPropertyId);
  const updateCurrentProperty = useStore((s) => s.updateCurrentProperty);
  const selectProperty = useStore((s) => s.selectProperty);
  const logout = useStore((s) => s.logout);

  const property = properties.find((p) => p.id === currentPropertyId);
  const [name, setName] = useState(property?.name ?? '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== (property?.name ?? '');

  const handleSave = async () => {
    setSaving(true);
    const res = await updateCurrentProperty({ name: name.trim() });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    notify('Saved', 'Property details updated.');
  };

  const handleLogout = () => {
    confirm({
      title: 'Log out?',
      message: "You'll need to log in again to access your properties.",
      confirmLabel: 'Log out',
      destructive: true,
      onConfirm: () => logout(),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title="Settings" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountCard}>
            <Text style={styles.accountName}>{user?.full_name}</Text>
            <Text style={styles.accountEmail}>{user?.email}</Text>
          </View>

          <Text style={styles.sectionTitle}>Property</Text>
          <FormField
            label="Property name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sunrise PG"
            autoCapitalize="words"
            error={error}
            testID="settings-property-name"
          />
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={!dirty || saving}
            testID="settings-save"
          />

          {properties.length > 1 && (
            <>
              <Text style={styles.sectionTitle}>Switch property</Text>
              <View style={styles.propertyList}>
                {properties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.propertyRow}
                    onPress={() => {
                      selectProperty(p.id);
                      setName(p.name);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.propertyName}>{p.name}</Text>
                    {p.id === currentPropertyId && <Check color={theme.colors.primary} size={18} strokeWidth={2.5} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8} testID="settings-logout">
            <LogOut color={theme.colors.error} size={18} strokeWidth={2.2} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

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
  sectionTitle: { ...theme.typography.h3, marginBottom: theme.spacing.md, marginTop: theme.spacing.lg },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  accountName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  accountEmail: { ...theme.typography.caption },
  propertyList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  propertyName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.error + '10',
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
    marginTop: theme.spacing.xl,
  },
  logoutText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', color: theme.colors.error },
  version: {
    ...theme.typography.small,
    textAlign: 'center',
    marginTop: theme.spacing.xxl,
  },
});
