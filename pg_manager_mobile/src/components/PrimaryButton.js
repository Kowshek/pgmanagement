import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { theme } from '../theme/theme';

export default function PrimaryButton({ title, onPress, disabled, variant = 'primary', style, testID }) {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 18,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: theme.colors.primary, ...theme.shadows.md },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: { backgroundColor: theme.colors.error },
  disabled: { opacity: 0.45 },
  text: {
    ...theme.typography.body,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  textSecondary: { color: theme.colors.text },
});
