import { useStore } from '../useStore';

const reset = () =>
  useStore.setState({
    onboarded: false,
    pgDetails: { pgName: '', ownerName: '' },
    guests: [],
    rooms: [],
    payments: [],
  });

const S = () => useStore.getState();

const addRoom = (roomNumber = '101', capacity = 2, type = '2 Sharing') =>
  S().addRoom({ roomNumber, type, capacity });

const addGuest = (overrides = {}) =>
  S().addGuest({
    fullName: 'Rahul Sharma',
    phone: '+91 9876543210',
    roomNumber: '101',
    monthlyRent: 8500,
    ...overrides,
  });

beforeEach(reset);

describe('onboarding', () => {
  it('rejects blank fields', () => {
    expect(S().completeOnboarding({ pgName: '  ', ownerName: 'A' }).ok).toBe(false);
    expect(S().onboarded).toBe(false);
  });

  it('trims and saves details', () => {
    const res = S().completeOnboarding({ pgName: '  Sunrise PG ', ownerName: ' Kowshek ' });
    expect(res.ok).toBe(true);
    expect(S().onboarded).toBe(true);
    expect(S().pgDetails).toEqual({ pgName: 'Sunrise PG', ownerName: 'Kowshek' });
  });
});

describe('rooms', () => {
  it('adds a room with trimmed fields', () => {
    expect(addRoom(' 101 ').ok).toBe(true);
    expect(S().rooms[0].roomNumber).toBe('101');
  });

  it('rejects duplicates case-insensitively', () => {
    addRoom('101A');
    const res = addRoom(' 101a ');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already exists/);
    expect(S().rooms).toHaveLength(1);
  });

  it('rejects invalid capacity', () => {
    expect(addRoom('101', 0).ok).toBe(false);
    expect(addRoom('101', 2.5).ok).toBe(false);
    expect(addRoom('101', 21).ok).toBe(false);
    expect(addRoom('101', 'abc').ok).toBe(false);
  });

  it('renaming a room carries its guests along', () => {
    addRoom('101');
    addGuest();
    const roomId = S().rooms[0].id;
    const res = S().updateRoom(roomId, { roomNumber: '201', type: '2 Sharing', capacity: 2 });
    expect(res.ok).toBe(true);
    expect(S().guests[0].roomNumber).toBe('201');
  });

  it('rejects capacity below current occupancy', () => {
    addRoom('101', 2);
    addGuest();
    addGuest({ fullName: 'Aman Gupta', phone: '9876543211' });
    const res = S().updateRoom(S().rooms[0].id, { roomNumber: '101', type: '2 Sharing', capacity: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/occupancy/);
  });

  it('blocks deleting an occupied room but allows once guests moved out', () => {
    addRoom('101');
    addGuest();
    const roomId = S().rooms[0].id;
    expect(S().deleteRoom(roomId).ok).toBe(false);

    S().setGuestActive(S().guests[0].id, false);
    expect(S().deleteRoom(roomId).ok).toBe(true);
    expect(S().rooms).toHaveLength(0);
  });
});

describe('guests', () => {
  beforeEach(() => addRoom('101', 2));

  it('adds a guest into a room with free beds', () => {
    const res = addGuest();
    expect(res.ok).toBe(true);
    const g = S().guests[0];
    expect(g.active).toBe(true);
    expect(g.movedOutAt).toBeNull();
    expect(g.joinedAt).toBeTruthy();
  });

  it('validates phone and rent', () => {
    expect(addGuest({ phone: 'abc' }).ok).toBe(false);
    expect(addGuest({ monthlyRent: 0 }).ok).toBe(false);
    expect(addGuest({ monthlyRent: -5 }).ok).toBe(false);
    expect(addGuest({ monthlyRent: 'x' }).ok).toBe(false);
  });

  it('rejects a full room', () => {
    addGuest();
    addGuest({ fullName: 'Aman Gupta', phone: '9876543211' });
    const res = addGuest({ fullName: 'Third Person', phone: '9876543212' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/full/i);
  });

  it('rejects unknown rooms', () => {
    expect(addGuest({ roomNumber: '999' }).ok).toBe(false);
  });

  it('editing a guest without changing rooms never hits the bed check', () => {
    addRoom('102', 1);
    addGuest({ roomNumber: '102' });
    const g = S().guests[0];
    const res = S().updateGuest(g.id, { ...g, monthlyRent: 9999 });
    expect(res.ok).toBe(true);
    expect(S().guests[0].monthlyRent).toBe(9999);
  });

  it('rejects moving a guest into a full room', () => {
    addRoom('102', 1);
    addGuest({ roomNumber: '102' });
    addGuest({ fullName: 'Aman Gupta', phone: '9876543211', roomNumber: '101' });
    const aman = S().guests[1];
    const res = S().updateGuest(aman.id, { ...aman, roomNumber: '102' });
    expect(res.ok).toBe(false);
  });

  it('move-out frees the bed; reactivation requires a free bed', () => {
    addRoom('102', 1);
    addGuest({ roomNumber: '102' });
    const first = S().guests[0];

    expect(S().setGuestActive(first.id, false).ok).toBe(true);
    expect(S().guests[0].movedOutAt).toBeTruthy();

    // bed is free now, someone else moves in
    addGuest({ fullName: 'Aman Gupta', phone: '9876543211', roomNumber: '102' });

    // reactivating the first guest must fail — room is full again
    const res = S().setGuestActive(first.id, true);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/full/i);
  });

  it('reactivation fails if the room was deleted meanwhile', () => {
    addGuest();
    const g = S().guests[0];
    S().setGuestActive(g.id, false);
    S().deleteRoom(S().rooms[0].id);
    expect(S().setGuestActive(g.id, true).ok).toBe(false);
  });

  it('deleting a guest keeps the payment ledger intact', () => {
    addGuest();
    const g = S().guests[0];
    S().addPayment({ guestId: g.id, amount: 8500, method: 'UPI', forMonth: '2026-07' });
    S().deleteGuest(g.id);
    expect(S().guests).toHaveLength(0);
    expect(S().payments).toHaveLength(1);
    expect(S().payments[0].guestName).toBe('Rahul Sharma');
    expect(S().payments[0].roomNumber).toBe('101');
  });
});

describe('payments', () => {
  beforeEach(() => {
    addRoom('101', 2);
    addGuest();
  });

  it('records a payment with snapshot and month attribution', () => {
    const g = S().guests[0];
    const res = S().addPayment({ guestId: g.id, amount: 8500, method: 'UPI', forMonth: '2026-07' });
    expect(res.ok).toBe(true);
    const p = S().payments[0];
    expect(p.guestName).toBe('Rahul Sharma');
    expect(p.forMonth).toBe('2026-07');
    expect(p.date).toBeTruthy();
  });

  it('falls back to the current month when forMonth is malformed', () => {
    const g = S().guests[0];
    S().addPayment({ guestId: g.id, amount: 100, method: 'Cash', forMonth: 'garbage' });
    expect(S().payments[0].forMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('validates guest, amount and method', () => {
    const g = S().guests[0];
    expect(S().addPayment({ guestId: 'nope', amount: 100, method: 'UPI' }).ok).toBe(false);
    expect(S().addPayment({ guestId: g.id, amount: 0, method: 'UPI' }).ok).toBe(false);
    expect(S().addPayment({ guestId: g.id, amount: -5, method: 'UPI' }).ok).toBe(false);
    expect(S().addPayment({ guestId: g.id, amount: 'x', method: 'UPI' }).ok).toBe(false);
    expect(S().addPayment({ guestId: g.id, amount: 100, method: '  ' }).ok).toBe(false);
  });

  it('deletes payments', () => {
    const g = S().guests[0];
    S().addPayment({ guestId: g.id, amount: 100, method: 'UPI' });
    const id = S().payments[0].id;
    expect(S().deletePayment(id).ok).toBe(true);
    expect(S().payments).toHaveLength(0);
  });
});

describe('eraseAllData', () => {
  it('resets everything including onboarding', () => {
    S().completeOnboarding({ pgName: 'X', ownerName: 'Y' });
    addRoom();
    addGuest();
    S().eraseAllData();
    expect(S().onboarded).toBe(false);
    expect(S().guests).toEqual([]);
    expect(S().rooms).toEqual([]);
    expect(S().payments).toEqual([]);
  });
});
