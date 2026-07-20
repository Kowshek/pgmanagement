import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../theme/theme';

export default function PrimaryButton({ title, onPress, disabled, variant = 'primary', style, testID }) {
  const handlePress = (e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (onPress) onPress(e);
  };

  const content = (
    <Text 
      style={[styles.text, variant === 'secondary' && styles.textSecondary]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {title}
    </Text>
  );

  return (
    <TouchableOpacity
      style={[styles.buttonWrapper, disabled && styles.disabled, style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#1F1F1F', '#000000']}
          style={styles.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {content}
        </LinearGradient>
      ) : variant === 'danger' ? (
        <View style={[styles.button, styles.danger]}>{content}</View>
      ) : (
        <View style={[styles.button, styles.secondary]}>{content}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
  },
  gradientButton: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: 'rgb(223, 223, 223)',
    borderWidth: 0,
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
