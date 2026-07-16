import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UserPlus } from 'lucide-react-native';

import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import ModalShell from '../components/ModalShell';
import PrimaryButton from '../components/PrimaryButton';
import { formatINR, initialsOf } from '../lib/format';
import { balanceForMonth, monthKeyOf, monthLabel, prevMonthKey } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const METHODS = ['UPI', 'Cash', 'Bank transfer', 'Card'];

export default function RecordPaymentModal({ navigation, route }) {
  const preselectedGuestId = route.params?.guestId;
  const guests = useStore((s) => s.guests);
  const payments = useStore((s) => s.payments);
  const addPayment = useStore((s) => s.addPayment);

  const activeGuests = useMemo(
    () => guests.filter((g) => g.active).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [guests]
  );

  const currentMonth = monthKeyOf();
  const lastMonth = prevMonthKey(currentMonth);

  const prefillFor = (guest, month) => {
    if (!guest) return '';
    const balance = balanceForMonth(guest, payments, month);
    return balance > 0 ? String(balance) : '';
  };

  const initialGuest = activeGuests.find((g) => g.id === preselectedGuestId) || null;
  const [selectedGuestId, setSelectedGuestId] = useState(initialGuest?.id ?? null);
  const [forMonth, setForMonth] = useState(currentMonth);
  const [amount, setAmount] = useState(() => prefillFor(initialGuest, currentMonth));
  const [method, setMethod] = useState('UPI');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const selectedGuest = activeGuests.find((g) => g.id === selectedGuestId) || null;

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const selectGuest = (guest) => {
    setSelectedGuestId(guest.id);
    setAmount(prefillFor(guest, forMonth));
    clearError('guest');
  };

  const selectMonth = (month) => {
    setForMonth(month);
    if (selectedGuest) setAmount(prefillFor(selectedGuest, month));
  };

  const handleSave = () => {
    const next = {};
    if (!selectedGuest) next.guest = 'Select a guest.';
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) next.amount = 'Enter a positive amount.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const res = addPayment({ guestId: selectedGuest.id, amount: value, method, forMonth });
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    navigation.goBack();
  };

  if (activeGuests.length === 0) {
    return (
      <ModalShell title="Record payment">
        <EmptyState
          icon={UserPlus}
          title="No active guests"
          message="Add a guest first — then record their rent payments here."
          actionLabel="Add guest"
          onAction={() => navigation.replace('GuestForm')}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Record payment"
      error={formError}
      footer={
        <>
          {selectedGuest && Number(amount) > 0 && (
            <Text style={styles.summary}>
              {formatINR(amount)} from {selectedGuest.fullName} · rent for {monthLabel(forMonth)} ·{' '}
              {method}
            </Text>
          )}
          <PrimaryButton title="Save payment" onPress={handleSave} testID="payment-save" />
        </>
      }
    >
      <View style={styles.group}>
        <Text style={styles.label}>Guest</Text>
        {activeGuests.map((guest) => {
          const balance = balanceForMonth(guest, payments, forMonth);
          const selected = guest.id === selectedGuestId;
          return (
            <TouchableOpacity
              key={guest.id}
              style={[styles.guestRow, selected && styles.guestRowSelected]}
              onPress={() => selectGuest(guest)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              testID={`payment-guest-${guest.id}`}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.guestAvatar}>
                <Text style={styles.guestAvatarText}>{initialsOf(guest.fullName)}</Text>
              </View>
              <View style={styles.guestInfo}>
                <Text style={styles.guestName} numberOfLines={1}>
                  {guest.fullName}
                </Text>
                <Text style={styles.guestRoom}>Room {guest.roomNumber}</Text>
              </View>
              {balance > 0 ? (
                <Text style={styles.guestDue}>{formatINR(balance)} due</Text>
              ) : (
                <Text style={styles.guestPaid}>Paid</Text>
              )}
            </TouchableOpacity>
          );
        })}
        {!!errors.guest && <Text style={styles.chipError}>{errors.guest}</Text>}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Rent for</Text>
        <View style={styles.chips}>
          <Chip
            label={monthLabel(currentMonth)}
            selected={forMonth === currentMonth}
            onPress={() => selectMonth(currentMonth)}
            testID="month-chip-current"
          />
          <Chip
            label={monthLabel(lastMonth)}
            selected={forMonth === lastMonth}
            onPress={() => selectMonth(lastMonth)}
            testID="month-chip-last"
          />
        </View>
      </View>

      <FormField
        label="Amount (₹)"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          clearError('amount');
        }}
        keyboardType="numeric"
        placeholder="e.g. 8500"
        error={errors.amount}
        testID="payment-amount-input"
      />

      <View style={styles.group}>
        <Text style={styles.label}>Payment method</Text>
        <View style={styles.chips}>
          {METHODS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={method === m}
              onPress={() => setMethod(m)}
              testID={`method-chip-${m.replace(/\s/g, '-').toLowerCase()}`}
            />
          ))}
        </View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chipError: { ...theme.typography.caption, color: theme.colors.error, marginTop: 6 },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  guestRowSelected: { borderColor: theme.colors.primary, borderWidth: 1.5 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: theme.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarText: { ...theme.typography.caption, fontFamily: 'PlusJakartaSans_700Bold' },
  guestInfo: { flex: 1 },
  guestName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  guestRoom: { ...theme.typography.caption },
  guestDue: { ...theme.typography.caption, color: theme.colors.error, fontFamily: 'PlusJakartaSans_700Bold' },
  guestPaid: { ...theme.typography.caption, color: theme.colors.success, fontFamily: 'PlusJakartaSans_700Bold' },
  summary: {
    ...theme.typography.caption,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
});
