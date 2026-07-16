import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { theme } from '../theme/theme';

export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      {!!Icon && (
        <View style={styles.iconCircle}>
          <Icon color={theme.colors.textTertiary} size={28} strokeWidth={1.8} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {!!actionLabel && (
        <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: theme.spacing.xxl, paddingHorizontal: theme.spacing.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: { ...theme.typography.h3, marginBottom: theme.spacing.xs, textAlign: 'center' },
  message: { ...theme.typography.bodySecondary, textAlign: 'center', lineHeight: 22 },
  action: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.sm,
  },
  actionText: {
    ...theme.typography.body,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
