import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { BedDouble } from 'lucide-react-native';

import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import ModalShell from '../components/ModalShell';
import PrimaryButton from '../components/PrimaryButton';
import { ApiError, guestsApi, roomsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const PHONE_RE = /^[+\d][\d\s-]{6,15}$/;

export default function GuestFormModal({ navigation, route }) {
  const guestId = route.params?.guestId;
  const currentPropertyId = useStore((s) => s.currentPropertyId);

  const [rooms, setRooms] = useState([]);
  const [editingGuest, setEditingGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roomList, guest] = await Promise.all([
          roomsApi.list(currentPropertyId),
          guestId ? guestsApi.get(currentPropertyId, guestId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setRooms(roomList);
        setEditingGuest(guest);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load form data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPropertyId, guestId]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [monthlyRent, setMonthlyRent] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [guestType, setGuestType] = useState('permanent');
  const [stayDuration, setStayDuration] = useState('');
  const [stayUnit, setStayUnit] = useState('months');
  const [advancePaid, setAdvancePaid] = useState('');
  const [food, setFood] = useState(false);
  const [foodType, setFoodType] = useState('veg');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingGuest) return;
    setFullName(editingGuest.full_name);
    setPhone(editingGuest.phone);
    setRoomId(editingGuest.room_id);
    setMonthlyRent(String(editingGuest.monthly_rent));
    setPermanentAddress(editingGuest.permanent_address || '');
    setGuestType(editingGuest.guest_type);
    setStayDuration(editingGuest.stay_duration ? String(editingGuest.stay_duration) : '');
    setStayUnit(editingGuest.stay_unit || 'months');
    setAdvancePaid(editingGuest.advance_paid != null ? String(editingGuest.advance_paid) : '');
    setFood(!!editingGuest.has_food);
    setFoodType(editingGuest.food_type || 'veg');
    // aadhar_number is write-only server-side (only aadhar_last4 comes back)
    // — leave the field blank on edit so we don't overwrite it with "".
  }, [editingGuest]);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
      ),
    [rooms]
  );

  const freeBedsOf = (room) => {
    const isCurrent = editingGuest?.room_id === room.id;
    const free = room.capacity - room.occupied_beds + (isCurrent ? 1 : 0);
    return Math.max(0, free);
  };

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const handleSave = async () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    if (!PHONE_RE.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    const rent = Number(monthlyRent);
    if (!Number.isFinite(rent) || rent < 0) next.monthlyRent = 'Enter a valid amount.';
    if (!roomId) next.room = 'Select a room.';
    if (advancePaid.trim() && (!Number.isFinite(Number(advancePaid)) || Number(advancePaid) < 0)) {
      next.advancePaid = 'Enter a valid amount.';
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const basePayload = {
      room_id: roomId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      monthly_rent: rent,
      guest_type: guestType,
      advance_paid: advancePaid.trim() ? Number(advancePaid) : null,
      has_food: food,
      food_type: food ? foodType : null,
      stay_duration: stayDuration ? Number(stayDuration) : null,
      stay_unit: stayDuration ? stayUnit : null,
      aadhar_number: aadharNumber.trim() || null,
      permanent_address: permanentAddress.trim() || null,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editingGuest) {
        // GuestUpdateRequest has no joined_at field — join date can't be
        // changed after creation.
        await guestsApi.update(currentPropertyId, editingGuest.id, basePayload);
      } else {
        await guestsApi.create(currentPropertyId, {
          ...basePayload,
          joined_at: new Date().toISOString().slice(0, 10),
        });
      }
      navigation.goBack();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save guest.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ModalShell title={guestId ? 'Edit guest' : 'Add guest'}>
        <ActivityIndicator color={theme.colors.primary} />
      </ModalShell>
    );
  }

  if (loadError) {
    return <ModalShell title={guestId ? 'Edit guest' : 'Add guest'} error={loadError} />;
  }

  if (rooms.length === 0) {
    return (
      <ModalShell title="Add guest">
        <EmptyState
          icon={BedDouble}
          title="Add a room first"
          message="Guests are assigned to rooms, so set up at least one room before adding a guest."
          actionLabel="Add room"
          onAction={() => navigation.replace('RoomForm')}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={editingGuest ? 'Edit guest' : 'Add guest'}
      error={formError}
      footer={
        <PrimaryButton
          title={saving ? 'Saving…' : editingGuest ? 'Save changes' : 'Save guest'}
          onPress={handleSave}
          disabled={saving}
          testID="guest-form-save"
        />
      }
    >
      <FormField
        label="Full name"
        value={fullName}
        onChangeText={(v) => { setFullName(v); clearError('fullName'); }}
        placeholder="e.g. Rahul Sharma"
        error={errors.fullName}
        autoCapitalize="words"
        testID="guest-name-input"
      />

      <FormField
        label="Phone number"
        value={phone}
        onChangeText={(v) => { setPhone(v); clearError('phone'); }}
        keyboardType="phone-pad"
        placeholder="e.g. +91 98765 43210"
        error={errors.phone}
        testID="guest-phone-input"
      />

      <View style={styles.roomGroup}>
        <Text style={styles.label}>Room</Text>
        <View style={styles.roomChips}>
          {sortedRooms.map((room) => {
            const isCurrent = editingGuest?.room_id === room.id;
            const free = freeBedsOf(room);
            const disabled = free === 0 && !isCurrent;
            return (
              <Chip
                key={room.id}
                label={isCurrent ? `${room.room_number} · current` : `${room.room_number} · ${free} free`}
                selected={roomId === room.id}
                disabled={disabled}
                onPress={() => { setRoomId(room.id); clearError('room'); }}
                testID={`room-chip-${room.room_number}`}
              />
            );
          })}
        </View>
        {!!errors.room && <Text style={styles.chipError}>{errors.room}</Text>}
      </View>

      <FormField
        label="Monthly rent (₹)"
        value={monthlyRent}
        onChangeText={(v) => { setMonthlyRent(v); clearError('monthlyRent'); }}
        keyboardType="numeric"
        placeholder="e.g. 8500"
        error={errors.monthlyRent}
        testID="guest-rent-input"
      />

      <FormField
        label="Advance paid (₹)"
        value={advancePaid}
        onChangeText={(v) => { setAdvancePaid(v); clearError('advancePaid'); }}
        keyboardType="numeric"
        placeholder="e.g. 5000"
        error={errors.advancePaid}
        testID="guest-advance-input"
      />

      <FormField
        label={editingGuest ? 'Aadhar Number (leave blank to keep unchanged)' : 'Aadhar Number'}
        value={aadharNumber}
        onChangeText={setAadharNumber}
        placeholder={editingGuest ? `On file: •••• ${editingGuest.aadhar_last4 ?? '----'}` : 'e.g. 1234 5678 9012'}
        testID="guest-aadhar-input"
        keyboardType="numeric"
      />

      <View style={styles.addressGroup}>
        <Text style={styles.label}>Permanent Address</Text>
        <TextInput
          style={styles.addressInput}
          value={permanentAddress}
          onChangeText={setPermanentAddress}
          placeholder="House / Flat no., Street, City, State, PIN"
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="next"
          blurOnSubmit={false}
          testID="guest-address-input"
        />
      </View>

      <View style={styles.roomGroup}>
        <Text style={styles.label}>Guest Type</Text>
        <View style={styles.roomChips}>
          <Chip label="Permanent" selected={guestType === 'permanent'} onPress={() => setGuestType('permanent')} />
          <Chip label="Temporary" selected={guestType === 'temporary'} onPress={() => setGuestType('temporary')} />
        </View>
      </View>

      <View style={styles.stayRow}>
        <View style={styles.stayInputWrap}>
          <Text style={styles.label}>
            {guestType === 'temporary' ? 'Expected stay' : 'Stay duration'}
          </Text>
          <TextInput
            style={styles.stayInput}
            value={stayDuration}
            onChangeText={setStayDuration}
            placeholder={stayUnit === 'months' ? 'e.g. 6' : 'e.g. 15'}
            keyboardType="numeric"
            placeholderTextColor={theme.colors.textTertiary}
            testID="guest-stay-duration-input"
          />
        </View>
        <View style={styles.stayUnitWrap}>
          <Text style={styles.label}>Unit</Text>
          <View style={styles.unitChips}>
            <Chip label="Days" selected={stayUnit === 'days'} onPress={() => setStayUnit('days')} />
            <Chip label="Months" selected={stayUnit === 'months'} onPress={() => setStayUnit('months')} />
            <Chip label="Years" selected={stayUnit === 'years'} onPress={() => setStayUnit('years')} />
          </View>
        </View>
      </View>

      <View style={styles.roomGroup}>
        <Text style={styles.label}>Food Details</Text>
        <View style={styles.roomChips}>
          <Chip label="Food Required" selected={food} onPress={() => setFood(true)} />
          <Chip label="No Food" selected={!food} onPress={() => setFood(false)} />
        </View>
      </View>

      {food && (
        <View style={styles.roomGroup}>
          <Text style={styles.label}>Food Type</Text>
          <View style={styles.roomChips}>
            <Chip label="Vegetarian" selected={foodType === 'veg'} onPress={() => setFoodType('veg')} />
            <Chip label="Non-Vegetarian" selected={foodType === 'non_veg'} onPress={() => setFoodType('non_veg')} />
          </View>
        </View>
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  roomGroup: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  roomChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chipError: { ...theme.typography.caption, color: theme.colors.error, marginTop: 6 },

  addressGroup: { marginBottom: theme.spacing.lg },
  addressInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 110,
    textAlignVertical: 'top',
  },

  stayRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'flex-start',
  },
  stayInputWrap: { flex: 1 },
  stayInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stayUnitWrap: { flex: 1.3 },
  unitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
});
