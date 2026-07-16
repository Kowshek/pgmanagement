import {
  balanceForMonth,
  bedsFreeOf,
  computeStats,
  monthKeyOf,
  monthLabel,
  occupancyOf,
  paidForMonth,
  prevMonthKey,
  roomStatusOf,
} from '../rent';

const room = (roomNumber, capacity) => ({ id: roomNumber, roomNumber, type: 'Test', capacity });
const guest = (id, roomNumber, monthlyRent = 8000, active = true) => ({
  id,
  fullName: `Guest ${id}`,
  roomNumber,
  monthlyRent,
  active,
});
const payment = (guestId, amount, forMonth) => ({ id: Math.random().toString(), guestId, amount, forMonth });

describe('month keys', () => {
  it('formats month keys with zero padding', () => {
    expect(monthKeyOf(new Date(2026, 6, 11))).toBe('2026-07');
    expect(monthKeyOf(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('computes previous month across year boundaries', () => {
    expect(prevMonthKey('2026-07')).toBe('2026-06');
    expect(prevMonthKey('2026-01')).toBe('2025-12');
  });

  it('renders human labels', () => {
    expect(monthLabel('2026-07')).toBe('July 2026');
  });
});

describe('occupancy (derived from active guests)', () => {
  const rooms = [room('101', 2), room('102', 1)];
  const guests = [
    guest('a', '101'),
    guest('b', '101', 8000, false), // moved out — must not count
    guest('c', '102'),
  ];

  it('counts only active guests in the room', () => {
    expect(occupancyOf(rooms[0], guests)).toBe(1);
    expect(occupancyOf(rooms[1], guests)).toBe(1);
  });

  it('derives beds free and status', () => {
    expect(bedsFreeOf(rooms[0], guests)).toBe(1);
    expect(roomStatusOf(rooms[0], guests)).toBe('Available');
    expect(bedsFreeOf(rooms[1], guests)).toBe(0);
    expect(roomStatusOf(rooms[1], guests)).toBe('Full');
  });
});

describe('rent balances', () => {
  const g = guest('a', '101', 9000);
  const payments = [
    payment('a', 4000, '2026-07'),
    payment('a', 2000, '2026-07'),
    payment('a', 9000, '2026-06'), // other month, ignored
    payment('b', 9000, '2026-07'), // other guest, ignored
  ];

  it('sums payments attributed to the month', () => {
    expect(paidForMonth(payments, 'a', '2026-07')).toBe(6000);
  });

  it('computes outstanding balance', () => {
    expect(balanceForMonth(g, payments, '2026-07')).toBe(3000);
    expect(balanceForMonth(g, payments, '2026-06')).toBe(0);
  });

  it('clamps overpayment at zero', () => {
    const paid = [payment('a', 12000, '2026-07')];
    expect(balanceForMonth(g, paid, '2026-07')).toBe(0);
  });
});

describe('computeStats', () => {
  const state = {
    rooms: [room('101', 2), room('102', 1)],
    guests: [
      guest('a', '101', 8000),
      guest('b', '101', 7000),
      guest('c', '102', 9000, false), // moved out: no rent due, no bed used
    ],
    payments: [payment('a', 8000, '2026-07'), payment('b', 3000, '2026-07'), payment('c', 9000, '2026-06')],
  };

  it('computes pending and collected consistently for the month', () => {
    const stats = computeStats(state, '2026-07');
    expect(stats.pendingRent).toBe(4000); // b owes 7000-3000
    expect(stats.collectedThisMonth).toBe(11000);
    // invariant: pending + collected = total expected active rent (no overpayment here)
    expect(stats.pendingRent + stats.collectedThisMonth).toBe(15000);
    expect(stats.totalCollected).toBe(20000);
  });

  it('lists due guests sorted by balance, active only', () => {
    const stats = computeStats(state, '2026-07');
    expect(stats.dueGuests.map((d) => d.guest.id)).toEqual(['b']);
    expect(stats.dueGuests[0].balance).toBe(4000);
  });

  it('derives occupancy from active guests only', () => {
    const stats = computeStats(state, '2026-07');
    expect(stats.totalBeds).toBe(3);
    expect(stats.occupiedBeds).toBe(2);
    expect(stats.occupancyRate).toBe(67);
    expect(stats.activeGuests).toBe(2);
    expect(stats.totalRooms).toBe(2);
  });

  it('handles empty data without dividing by zero', () => {
    const stats = computeStats({ rooms: [], guests: [], payments: [] }, '2026-07');
    expect(stats.occupancyRate).toBe(0);
    expect(stats.pendingRent).toBe(0);
    expect(stats.dueGuests).toEqual([]);
  });

  it('ignores beds of guests whose room was deleted', () => {
    const stats = computeStats(
      { rooms: [room('101', 1)], guests: [guest('x', 'GONE', 5000)], payments: [] },
      '2026-07'
    );
    expect(stats.occupiedBeds).toBe(0);
    // …but their rent is still tracked
    expect(stats.pendingRent).toBe(5000);
  });
});
