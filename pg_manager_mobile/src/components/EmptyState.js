import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PrimaryButton from './PrimaryButton';
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
        <View style={styles.actionWrapper}>
          <PrimaryButton title={actionLabel} onPress={onAction} />
        </View>
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
  actionWrapper: {
    marginTop: theme.spacing.lg,
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
  },
});
