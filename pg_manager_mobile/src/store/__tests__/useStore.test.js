// The store used to be a local, persisted rooms/guests/payments database
// and these tests drove its CRUD validation directly. Now it only tracks
// auth/session/property-selection state and delegates everything else to
// the backend via src/lib/api.js — so these tests mock that module and
// verify the store's orchestration (what it calls, what it sets) rather
// than any business-rule validation, which now lives server-side.

jest.mock('../../lib/api', () => ({
  authApi: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  },
  propertiesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  loadStoredTokens: jest.fn(),
  hasStoredSession: jest.fn(),
  setOnSessionExpired: jest.fn(),
}));

import { useStore } from '../useStore';
import { authApi, hasStoredSession, loadStoredTokens, propertiesApi } from '../../lib/api';

const S = () => useStore.getState();

const user = { id: 'u1', email: 'kai@example.com', full_name: 'Kai' };
const property = { id: 'p1', name: 'Sunrise PG' };

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({
    user: null,
    properties: [],
    currentPropertyId: null,
    authChecked: false,
    authLoading: false,
    authError: null,
  });
});

describe('bootstrap', () => {
  it('marks authChecked without a session when no token is stored', async () => {
    loadStoredTokens.mockResolvedValue({ accessToken: null, refreshToken: null });
    hasStoredSession.mockReturnValue(false);

    await S().bootstrap();

    expect(S().authChecked).toBe(true);
    expect(S().user).toBeNull();
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('loads the user and their properties when a session exists', async () => {
    loadStoredTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    hasStoredSession.mockReturnValue(true);
    authApi.me.mockResolvedValue(user);
    propertiesApi.list.mockResolvedValue([property]);

    await S().bootstrap();

    expect(S().authChecked).toBe(true);
    expect(S().user).toEqual(user);
    expect(S().properties).toEqual([property]);
    expect(S().currentPropertyId).toBe('p1');
  });

  it('falls back to logged-out if the stored session is no longer valid', async () => {
    loadStoredTokens.mockResolvedValue({ accessToken: 'stale', refreshToken: 'stale' });
    hasStoredSession.mockReturnValue(true);
    authApi.me.mockRejectedValue(new Error('401'));

    await S().bootstrap();

    expect(S().authChecked).toBe(true);
    expect(S().user).toBeNull();
    expect(S().properties).toEqual([]);
  });
});

describe('login', () => {
  it('on success, loads the user and their properties', async () => {
    authApi.login.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    authApi.me.mockResolvedValue(user);
    propertiesApi.list.mockResolvedValue([property]);

    const res = await S().login('kai@example.com', 'password123');

    expect(res.ok).toBe(true);
    expect(S().user).toEqual(user);
    expect(S().currentPropertyId).toBe('p1');
    expect(S().authLoading).toBe(false);
  });

  it('on failure, surfaces the error and leaves the session logged out', async () => {
    authApi.login.mockRejectedValue(new Error('Invalid email or password'));

    const res = await S().login('kai@example.com', 'wrong');

    expect(res.ok).toBe(false);
    expect(res.error).toBe('Invalid email or password');
    expect(S().user).toBeNull();
    expect(S().authError).toBe('Invalid email or password');
  });
});

describe('register', () => {
  it('registers then chains into login', async () => {
    authApi.register.mockResolvedValue(user);
    authApi.login.mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
    authApi.me.mockResolvedValue(user);
    propertiesApi.list.mockResolvedValue([]);

    const res = await S().register('kai@example.com', 'password123', 'Kai');

    expect(authApi.register).toHaveBeenCalledWith('kai@example.com', 'password123', 'Kai');
    expect(authApi.login).toHaveBeenCalledWith('kai@example.com', 'password123');
    expect(res.ok).toBe(true);
    expect(S().user).toEqual(user);
  });

  it('does not attempt login if registration itself fails', async () => {
    authApi.register.mockRejectedValue(new Error('Email already registered'));

    const res = await S().register('kai@example.com', 'password123', 'Kai');

    expect(res.ok).toBe(false);
    expect(authApi.login).not.toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('clears session state', async () => {
    useStore.setState({ user, properties: [property], currentPropertyId: 'p1', authChecked: true });
    authApi.logout.mockResolvedValue(undefined);

    await S().logout();

    expect(S().user).toBeNull();
    expect(S().properties).toEqual([]);
    expect(S().currentPropertyId).toBeNull();
    expect(S().authChecked).toBe(true);
  });
});

describe('properties', () => {
  it('createProperty adds the new property and selects it', async () => {
    propertiesApi.create.mockResolvedValue(property);

    const res = await S().createProperty({ name: 'Sunrise PG' });

    expect(res.ok).toBe(true);
    expect(S().properties).toEqual([property]);
    expect(S().currentPropertyId).toBe('p1');
  });

  it('updateCurrentProperty patches the matching property in place', async () => {
    useStore.setState({ properties: [property], currentPropertyId: 'p1' });
    const updated = { ...property, name: 'New Name' };
    propertiesApi.update.mockResolvedValue(updated);

    const res = await S().updateCurrentProperty({ name: 'New Name' });

    expect(res.ok).toBe(true);
    expect(S().properties[0].name).toBe('New Name');
  });

  it('updateCurrentProperty fails gracefully with no property selected', async () => {
    const res = await S().updateCurrentProperty({ name: 'X' });
    expect(res.ok).toBe(false);
    expect(propertiesApi.update).not.toHaveBeenCalled();
  });

  it('selectProperty switches the active property', () => {
    useStore.setState({ properties: [property, { id: 'p2', name: 'Other PG' }], currentPropertyId: 'p1' });
    S().selectProperty('p2');
    expect(S().currentPropertyId).toBe('p2');
  });
});
