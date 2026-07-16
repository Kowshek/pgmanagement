import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { theme } from '../theme/theme';

export default function Chip({ label, selected, onPress, disabled, testID }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
    >
      <Text style={[styles.label, selected && styles.labelSelected, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  disabled: { opacity: 0.4 },
  label: { ...theme.typography.caption, fontFamily: 'PlusJakartaSans_600SemiBold', color: theme.colors.text },
  labelSelected: { color: '#FFFFFF' },
  labelDisabled: { color: theme.colors.textTertiary },
});
