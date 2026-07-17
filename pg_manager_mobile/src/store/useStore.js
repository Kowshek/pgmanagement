// Session/auth state only. Rooms, guests and payments used to live here as
// a local zustand-persisted database — that's gone. The backend is now the
// database; screens fetch what they need directly from the api* modules
// (see src/lib/api.js) with useState/useEffect, refetching on focus via
// @react-navigation's useFocusEffect. This store just tracks who's logged
// in and which property is selected, both of which many unrelated screens
// need at once (tab bar, headers, every list screen).

import { create } from 'zustand';

import {
  authApi,
  propertiesApi,
  loadStoredTokens,
  hasStoredSession,
  setOnSessionExpired,
} from '../lib/api';

const initialSessionState = {
  user: null,
  properties: [],
  currentPropertyId: null,
};

export const useStore = create((set, get) => ({
  ...initialSessionState,
  // False until the first bootstrap() (app launch) has resolved — the root
  // navigator stays on the splash screen until this flips, same role the
  // old useHydrated() AsyncStorage-hydration flag used to play.
  authChecked: false,
  authLoading: false,
  authError: null,

  // Called once from App.js on mount. Loads any stored tokens and, if a
  // session exists, verifies it against the server and loads properties.
  bootstrap: async () => {
    await loadStoredTokens();
    if (!hasStoredSession()) {
      set({ authChecked: true });
      return;
    }
    try {
      const [user, properties] = await Promise.all([authApi.me(), propertiesApi.list()]);
      set({ user, properties, currentPropertyId: properties[0]?.id ?? null, authChecked: true });
    } catch {
      // Access token invalid and refresh failed (api.js already cleared
      // storage in that case) — fall back to logged-out.
      set({ ...initialSessionState, authChecked: true });
    }
  },

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      await authApi.login(email, password);
      const [user, properties] = await Promise.all([authApi.me(), propertiesApi.list()]);
      set({ user, properties, currentPropertyId: properties[0]?.id ?? null, authLoading: false });
      return { ok: true };
    } catch (err) {
      set({ authLoading: false, authError: err.message });
      return { ok: false, error: err.message };
    }
  },

  register: async (email, password, fullName) => {
    set({ authLoading: true, authError: null });
    try {
      await authApi.register(email, password, fullName);
      // Registration doesn't return tokens — log in right after.
      return await get().login(email, password);
    } catch (err) {
      set({ authLoading: false, authError: err.message });
      return { ok: false, error: err.message };
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ ...initialSessionState, authChecked: true, authError: null });
  },

  createProperty: async (payload) => {
    try {
      const property = await propertiesApi.create(payload);
      set((s) => ({ properties: [...s.properties, property], currentPropertyId: property.id }));
      return { ok: true, property };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  updateCurrentProperty: async (payload) => {
    const propertyId = get().currentPropertyId;
    if (!propertyId) return { ok: false, error: 'No property selected.' };
    try {
      const updated = await propertiesApi.update(propertyId, payload);
      set((s) => ({ properties: s.properties.map((p) => (p.id === updated.id ? updated : p)) }));
      return { ok: true, property: updated };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  selectProperty: (id) => set({ currentPropertyId: id }),

  refreshProperties: async () => {
    try {
      const properties = await propertiesApi.list();
      set((s) => ({
        properties,
        currentPropertyId: properties.some((p) => p.id === s.currentPropertyId)
          ? s.currentPropertyId
          : properties[0]?.id ?? null,
      }));
    } catch {
      // Best-effort refresh — leave existing state as-is on failure.
    }
  },
}));

// api.js calls this when a refresh-token attempt fails (session truly
// expired/revoked), so the UI drops back to the login screen instead of
// silently failing every subsequent request. api.js can't import the store
// directly (it would create a circular import), so this is a one-way
// registration instead.
setOnSessionExpired(() => {
  useStore.setState({ ...initialSessionState, authChecked: true });
});
