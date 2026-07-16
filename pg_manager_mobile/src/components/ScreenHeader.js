import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';

export default function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  titles: { flex: 1, marginRight: theme.spacing.md },
  subtitle: {
    ...theme.typography.bodySecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: theme.spacing.xs,
  },
  title: { ...theme.typography.h1 },
});
