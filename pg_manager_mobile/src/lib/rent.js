// Pure domain logic for rooms, occupancy and monthly rent tracking.
// Room occupancy and status are always derived from active guests — never stored —
// so they cannot drift when guests are added, moved, moved out or deleted.
//
// Payments carry a `forMonth` key ('2026-07') attributing them to a rent month.
// "Pending" and "collected" for a month are both computed against forMonth, so
// pending + collected always reconciles with the total expected rent.

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

export function activeOccupants(room, guests) {
  return guests.filter((g) => g.active && g.roomNumber === room.roomNumber);
}

export function occupancyOf(room, guests) {
  return activeOccupants(room, guests).length;
}

export function bedsFreeOf(room, guests) {
  return Math.max(0, Number(room.capacity || 0) - occupancyOf(room, guests));
}

export function roomStatusOf(room, guests) {
  return bedsFreeOf(room, guests) === 0 ? 'Full' : 'Available';
}

export function paidForMonth(payments, guestId, monthKey) {
  return payments
    .filter((p) => p.guestId === guestId && p.forMonth === monthKey)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

export function balanceForMonth(guest, payments, monthKey) {
  return Math.max(0, Number(guest.monthlyRent || 0) - paidForMonth(payments, guest.id, monthKey));
}

export function computeStats({ guests, rooms, payments }, monthKey = monthKeyOf()) {
  const active = guests.filter((g) => g.active);

  const dueGuests = active
    .map((guest) => ({ guest, balance: balanceForMonth(guest, payments, monthKey) }))
    .filter((entry) => entry.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const pendingRent = dueGuests.reduce((sum, e) => sum + e.balance, 0);
  const collectedThisMonth = payments
    .filter((p) => p.forMonth === monthKey)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalBeds = rooms.reduce((sum, r) => sum + Number(r.capacity || 0), 0);
  const roomNumbers = new Set(rooms.map((r) => r.roomNumber));
  const occupiedBeds = active.filter((g) => roomNumbers.has(g.roomNumber)).length;
  const occupancyRate = totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100);

  return {
    pendingRent,
    collectedThisMonth,
    totalCollected,
    occupancyRate,
    totalBeds,
    occupiedBeds,
    totalRooms: rooms.length,
    activeGuests: active.length,
    dueGuests,
  };
}
