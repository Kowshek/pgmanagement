import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { theme } from '../theme/theme';

export default function FormField({ label, error, style, ...inputProps }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={theme.colors.textTertiary}
        {...inputProps}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputError: { borderColor: theme.colors.error },
  error: { ...theme.typography.caption, color: theme.colors.error, marginTop: 6 },
});
