// In-app confirmation/notice dialog state.
// Used instead of Alert.alert because RN-web's Alert is a silent no-op, and a
// themed dialog behaves identically across Android, iOS and web.
// <ConfirmDialog /> is rendered once at the app root and consumes this store.

import { create } from 'zustand';

export const useConfirmStore = create((set) => ({
  request: null,
  show: (request) => set({ request }),
  dismiss: () => set({ request: null }),
}));

// confirm({ title, message, confirmLabel?, destructive?, onConfirm })
export function confirm(request) {
  useConfirmStore.getState().show({ confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...request });
}

// One-button informational dialog.
export function notify(title, message) {
  useConfirmStore.getState().show({ title, message, confirmLabel: 'OK', cancelLabel: null });
}
