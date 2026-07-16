import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { bedsFreeOf, monthKeyOf, occupancyOf } from '../lib/rent';

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const norm = (roomNumber) => String(roomNumber || '').trim().toLowerCase();

const initialData = {
  onboarded: false,
  pgDetails: { pgName: '', ownerName: '' },
  guests: [],
  rooms: [],
  payments: [],
};

// Every mutating action validates its invariants and returns { ok, error? } so
// screens can pre-validate for inline UX while the store stays the last line
// of defense. Room occupancy/status are derived (src/lib/rent.js), not stored.
export const useStore = create(
  persist(
    (set, get) => ({
      ...initialData,

      completeOnboarding: ({ pgName, ownerName }) => {
        const name = String(pgName || '').trim();
        const owner = String(ownerName || '').trim();
        if (!name || !owner) return { ok: false, error: 'Please fill in both fields.' };
        set({ onboarded: true, pgDetails: { pgName: name, ownerName: owner } });
        return { ok: true };
      },

      updatePgDetails: ({ pgName, ownerName }) => {
        const name = String(pgName || '').trim();
        const owner = String(ownerName || '').trim();
        if (!name || !owner) return { ok: false, error: 'Please fill in both fields.' };
        set({ pgDetails: { pgName: name, ownerName: owner } });
        return { ok: true };
      },

      addRoom: ({ roomNumber, type, capacity, isAc, advanceDetails }) => {
        const number = String(roomNumber || '').trim();
        const roomType = String(type || '').trim();
        const cap = Number(capacity);
        const ac = Boolean(isAc);
        const advance = String(advanceDetails || '').trim();
        if (!number) return { ok: false, error: 'Room number is required.' };
        if (!roomType) return { ok: false, error: 'Room type is required.' };
        if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
          return { ok: false, error: 'Capacity must be a whole number between 1 and 20.' };
        }
        if (get().rooms.some((r) => norm(r.roomNumber) === norm(number))) {
          return { ok: false, error: `Room ${number} already exists.` };
        }
        set((state) => ({
          rooms: [...state.rooms, { id: makeId(), roomNumber: number, type: roomType, capacity: cap, isAc: ac, advanceDetails: advance }],
        }));
        return { ok: true };
      },

      updateRoom: (id, { roomNumber, type, capacity, isAc, advanceDetails }) => {
        const state = get();
        const room = state.rooms.find((r) => r.id === id);
        if (!room) return { ok: false, error: 'Room not found.' };

        const number = String(roomNumber || '').trim();
        const roomType = String(type || '').trim();
        const cap = Number(capacity);
        const ac = Boolean(isAc);
        const advance = String(advanceDetails || '').trim();
        if (!number) return { ok: false, error: 'Room number is required.' };
        if (!roomType) return { ok: false, error: 'Room type is required.' };
        if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
          return { ok: false, error: 'Capacity must be a whole number between 1 and 20.' };
        }
        if (state.rooms.some((r) => r.id !== id && norm(r.roomNumber) === norm(number))) {
          return { ok: false, error: `Room ${number} already exists.` };
        }
        const occupied = occupancyOf(room, state.guests);
        if (cap < occupied) {
          return { ok: false, error: `Capacity can't be below current occupancy (${occupied}).` };
        }
        set((s) => ({
          rooms: s.rooms.map((r) => (r.id === id ? { ...r, roomNumber: number, type: roomType, capacity: cap, isAc: ac, advanceDetails: advance } : r)),
          // Renaming a room carries its guests (and their payment history labels) along.
          guests:
            room.roomNumber === number
              ? s.guests
              : s.guests.map((g) => (g.roomNumber === room.roomNumber ? { ...g, roomNumber: number } : g)),
        }));
        return { ok: true };
      },

      deleteRoom: (id) => {
        const state = get();
        const room = state.rooms.find((r) => r.id === id);
        if (!room) return { ok: false, error: 'Room not found.' };
        const occupied = occupancyOf(room, state.guests);
        if (occupied > 0) {
          return { ok: false, error: `Room ${room.roomNumber} still has ${occupied} guest${occupied > 1 ? 's' : ''}. Move them out first.` };
        }
        set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) }));
        return { ok: true };
      },

      addGuest: ({ fullName, phone, roomNumber, monthlyRent, aadharNumber, permanentAddress, profilePicture, guestType, stayDuration, stayUnit, advancePaid, food, foodType }) => {
        const state = get();
        const name = String(fullName || '').trim();
        const phoneNumber = String(phone || '').trim();
        const rent = Number(monthlyRent);
        
        const aadhar = String(aadharNumber || '').trim();
        const address = String(permanentAddress || '').trim();
        const picture = String(profilePicture || '').trim();
        const gType = String(guestType || 'permanent').trim();
        const duration = Number(stayDuration);
        const unit = String(stayUnit || 'months').trim();
        const advance = advancePaid != null && advancePaid !== '' ? Number(advancePaid) : null;
        const hasFood = Boolean(food);
        const typeFood = String(foodType || '').trim();

        if (!name) return { ok: false, error: 'Full name is required.' };
        if (!/^[+\d][\d\s-]{6,15}$/.test(phoneNumber)) {
          return { ok: false, error: 'Enter a valid phone number.' };
        }
        if (!Number.isFinite(rent) || rent < 0) {
          return { ok: false, error: 'Monthly rent must be a positive amount or zero.' };
        }
        const room = state.rooms.find((r) => norm(r.roomNumber) === norm(roomNumber));
        if (!room) return { ok: false, error: 'Select a room.' };
        if (bedsFreeOf(room, state.guests) === 0) {
          return { ok: false, error: `Room ${room.roomNumber} is full.` };
        }
        set((s) => ({
          guests: [
            ...s.guests,
            {
              id: makeId(),
              fullName: name,
              phone: phoneNumber,
              roomNumber: room.roomNumber,
              monthlyRent: rent,
              aadharNumber: aadhar,
              permanentAddress: address,
              profilePicture: picture,
              guestType: gType,
              stayDuration: isNaN(duration) ? null : duration,
              stayUnit: unit,
              advancePaid: advance,
              food: hasFood,
              foodType: typeFood,
              active: true,
              joinedAt: new Date().toISOString(),
              movedOutAt: null,
            },
          ],
        }));
        return { ok: true };
      },

      updateGuest: (id, { fullName, phone, roomNumber, monthlyRent, aadharNumber, permanentAddress, profilePicture, guestType, stayDuration, stayUnit, advancePaid, food, foodType }) => {
        const state = get();
        const guest = state.guests.find((g) => g.id === id);
        if (!guest) return { ok: false, error: 'Guest not found.' };

        const name = String(fullName || '').trim();
        const phoneNumber = String(phone || '').trim();
        const rent = Number(monthlyRent);
        
        const aadhar = String(aadharNumber || '').trim();
        const address = String(permanentAddress || '').trim();
        const picture = String(profilePicture || '').trim();
        const gType = String(guestType || 'permanent').trim();
        const duration = Number(stayDuration);
        const unit = String(stayUnit || 'months').trim();
        const advance = advancePaid != null && advancePaid !== '' ? Number(advancePaid) : null;
        const hasFood = Boolean(food);
        const typeFood = String(foodType || '').trim();

        if (!name) return { ok: false, error: 'Full name is required.' };
        if (!/^[+\d][\d\s-]{6,15}$/.test(phoneNumber)) {
          return { ok: false, error: 'Enter a valid phone number.' };
        }
        if (!Number.isFinite(rent) || rent < 0) {
          return { ok: false, error: 'Monthly rent must be a positive amount or zero.' };
        }
        const room = state.rooms.find((r) => norm(r.roomNumber) === norm(roomNumber));
        if (!room) return { ok: false, error: 'Select a room.' };
        const movingRooms = room.roomNumber !== guest.roomNumber;
        if (guest.active && movingRooms && bedsFreeOf(room, state.guests) === 0) {
          return { ok: false, error: `Room ${room.roomNumber} is full.` };
        }
        set((s) => ({
          guests: s.guests.map((g) =>
            g.id === id
              ? { 
                  ...g, 
                  fullName: name, 
                  phone: phoneNumber, 
                  roomNumber: room.roomNumber, 
                  monthlyRent: rent,
                  aadharNumber: aadhar,
                  permanentAddress: address,
                  profilePicture: picture,
                  guestType: gType,
                  stayDuration: isNaN(duration) ? null : duration,
                  stayUnit: unit,
                  advancePaid: advance,
                  food: hasFood,
                  foodType: typeFood
                }
              : g
          ),
        }));
        return { ok: true };
      },

      setGuestActive: (id, active) => {
        const state = get();
        const guest = state.guests.find((g) => g.id === id);
        if (!guest) return { ok: false, error: 'Guest not found.' };
        if (guest.active === active) return { ok: true };
        if (active) {
          const room = state.rooms.find((r) => r.roomNumber === guest.roomNumber);
          if (!room) return { ok: false, error: `Room ${guest.roomNumber} no longer exists. Edit the guest's room first.` };
          if (bedsFreeOf(room, state.guests) === 0) {
            return { ok: false, error: `Room ${room.roomNumber} is full. Edit the guest's room first.` };
          }
        }
        set((s) => ({
          guests: s.guests.map((g) =>
            g.id === id ? { ...g, active, movedOutAt: active ? null : new Date().toISOString() } : g
          ),
        }));
        return { ok: true };
      },

      deleteGuest: (id) => {
        if (!get().guests.some((g) => g.id === id)) return { ok: false, error: 'Guest not found.' };
        // Payments snapshot guestName at record time, so the ledger stays intact.
        set((s) => ({ guests: s.guests.filter((g) => g.id !== id) }));
        return { ok: true };
      },

      addPayment: ({ guestId, amount, method, forMonth }) => {
        const state = get();
        const guest = state.guests.find((g) => g.id === guestId);
        if (!guest) return { ok: false, error: 'Select a guest.' };
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
          return { ok: false, error: 'Amount must be a positive number.' };
        }
        const payMethod = String(method || '').trim();
        if (!payMethod) return { ok: false, error: 'Select a payment method.' };
        const month = /^\d{4}-\d{2}$/.test(forMonth) ? forMonth : monthKeyOf();
        set((s) => ({
          payments: [
            {
              id: makeId(),
              guestId,
              guestName: guest.fullName,
              roomNumber: guest.roomNumber,
              amount: value,
              method: payMethod,
              forMonth: month,
              date: new Date().toISOString(),
            },
            ...s.payments,
          ],
        }));
        return { ok: true };
      },

      deletePayment: (id) => {
        if (!get().payments.some((p) => p.id === id)) return { ok: false, error: 'Payment not found.' };
        set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }));
        return { ok: true };
      },

      eraseAllData: () => {
        set({ ...initialData });
        return { ok: true };
      },
    }),
    {
      name: 'pg-manager-storage',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// True once persisted state has been loaded from AsyncStorage.
export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsubFinish = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsubFinish;
  }, []);
  return hydrated;
}
