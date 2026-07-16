import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme/theme';
import { useConfirmStore } from '../lib/confirm';

export default function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const dismiss = useConfirmStore((s) => s.dismiss);

  if (!request) return null;
  const { title, message, confirmLabel, cancelLabel, destructive, onConfirm } = request;

  const handleConfirm = () => {
    dismiss();
    if (onConfirm) onConfirm();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={cancelLabel ? dismiss : handleConfirm}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            {!!cancelLabel && (
              <Pressable
                style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
                onPress={dismiss}
                testID="dialog-cancel"
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
                pressed && styles.pressed,
              ]}
              onPress={handleConfirm}
              testID="dialog-confirm"
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  title: { ...theme.typography.h3, marginBottom: theme.spacing.sm },
  message: { ...theme.typography.bodySecondary, lineHeight: 22 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  cancelButton: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  confirmButton: { backgroundColor: theme.colors.primary },
  destructiveButton: { backgroundColor: theme.colors.error },
  cancelText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  confirmText: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#FFFFFF',
  },
});
