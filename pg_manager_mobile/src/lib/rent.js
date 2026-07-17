// Month-key helpers shared across screens.
//
// Occupancy, room status, rent balances and dashboard totals used to be
// computed here client-side against a local guests/rooms/payments array.
// The backend now owns that math (Room.occupied_beds/status are
// server-computed, and GET /properties/{id}/stats/dashboard returns
// pending_rent/collected/occupancy_rate/due_guests pre-calculated) — so
// this file only keeps the pure calendar-key helpers screens still need
// for display and for building `for_month`/`?month=` query values.

import { format } from 'date-fns';

export function monthKeyOf(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthLabel(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number);
  if (!y || !m) return String(monthKey);
  return format(new Date(y, m - 1, 1), 'MMMM yyyy');
}

export function prevMonthKey(monthKey = monthKeyOf()) {
  const [y, m] = String(monthKey).split('-').map(Number);
  return monthKeyOf(new Date(y, m - 2, 1));
}

// Payments' `for_month` must be the first-of-month date the DB CHECK
// constraint expects, e.g. "2026-07-01".
export function monthKeyToDate(monthKey) {
  return `${monthKey}-01`;
}
