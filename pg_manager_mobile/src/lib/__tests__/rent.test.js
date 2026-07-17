import { monthKeyOf, monthKeyToDate, monthLabel, prevMonthKey } from '../rent';

// Occupancy/balance/dashboard-stat math used to live in rent.js and was
// tested here directly. That logic now lives server-side (Room.status,
// Room.occupied_beds, GET /stats/dashboard) since the app was wired to the
// real backend — so only the calendar-key helpers below are still local,
// pure logic worth unit testing.

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

describe('monthKeyToDate', () => {
  it('appends the first-of-month day for the payments API', () => {
    expect(monthKeyToDate('2026-07')).toBe('2026-07-01');
  });
});
