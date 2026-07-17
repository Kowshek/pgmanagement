import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import Chip from '../components/Chip';
import FormField from '../components/FormField';
import ModalShell from '../components/ModalShell';
import PrimaryButton from '../components/PrimaryButton';
import { ApiError, roomsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const TYPE_PRESETS = [
  { label: 'Single', value: 'single', capacity: 1 },
  { label: '2 Sharing', value: 'double', capacity: 2 },
  { label: '3 Sharing', value: 'triple', capacity: 3 },
  { label: '4 Sharing', value: 'quad', capacity: 4 },
];
const CUSTOM = 'custom';

export default function RoomFormModal({ navigation, route }) {
  const roomId = route.params?.roomId;
  const currentPropertyId = useStore((s) => s.currentPropertyId);

  const [editingRoom, setEditingRoom] = useState(null);
  const [loading, setLoading] = useState(!!roomId);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      try {
        const room = await roomsApi.get(currentPropertyId, roomId);
        if (!cancelled) setEditingRoom(room);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load room.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, currentPropertyId]);

  const presetOf = (value) => TYPE_PRESETS.find((p) => p.value === value);

  const [roomNumber, setRoomNumber] = useState('');
  const [typeChoice, setTypeChoice] = useState(null);
  const [customType, setCustomType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isAc, setIsAc] = useState(false);
  const [advanceDetails, setAdvanceDetails] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingRoom) return;
    setRoomNumber(editingRoom.room_number);
    setTypeChoice(editingRoom.room_type);
    setCustomType(editingRoom.room_type === CUSTOM ? editingRoom.custom_type_label || '' : '');
    setCapacity(String(editingRoom.capacity));
    setIsAc(!!editingRoom.is_ac);
    setAdvanceDetails(editingRoom.advance_details != null ? String(editingRoom.advance_details) : '');
  }, [editingRoom]);

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const selectType = (value) => {
    setTypeChoice(value);
    clearError('type');
    const preset = presetOf(value);
    if (preset) {
      setCapacity(String(preset.capacity));
      clearError('capacity');
    }
  };

  const occupied = editingRoom?.occupied_beds ?? 0;

  const handleSave = async () => {
    const cap = Number(capacity);

    const next = {};
    if (!roomNumber.trim()) next.roomNumber = 'Room number is required.';
    if (!typeChoice) next.type = 'Select a room type.';
    if (typeChoice === CUSTOM && !customType.trim()) next.type = 'Enter a custom type label.';
    if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
      next.capacity = 'Whole number between 1 and 20.';
    } else if (editingRoom && cap < occupied) {
      next.capacity = `At least ${occupied} — that many guests live here now.`;
    }
    const advanceValue = advanceDetails.trim() ? Number(advanceDetails) : null;
    if (advanceDetails.trim() && (!Number.isFinite(advanceValue) || advanceValue < 0)) {
      next.advanceDetails = 'Enter a valid amount.';
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = {
      room_number: roomNumber.trim(),
      room_type: typeChoice,
      custom_type_label: typeChoice === CUSTOM ? customType.trim() : undefined,
      capacity: cap,
      is_ac: isAc,
      advance_details: advanceValue,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editingRoom) {
        await roomsApi.update(currentPropertyId, editingRoom.id, payload);
      } else {
        await roomsApi.create(currentPropertyId, payload);
      }
      navigation.goBack();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save room.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ModalShell title="Edit room">
        <ActivityIndicator color={theme.colors.primary} />
      </ModalShell>
    );
  }

  if (loadError) {
    return (
      <ModalShell title="Edit room" error={loadError} />
    );
  }

  return (
    <ModalShell
      title={editingRoom ? 'Edit room' : 'Add room'}
      error={formError}
      footer={
        <PrimaryButton
          title={saving ? 'Saving…' : editingRoom ? 'Save changes' : 'Save room'}
          onPress={handleSave}
          disabled={saving}
          testID="room-form-save"
        />
      }
    >
      <FormField
        label="Room number"
        value={roomNumber}
        onChangeText={(v) => {
          setRoomNumber(v);
          clearError('roomNumber');
        }}
        placeholder="e.g. 105"
        error={errors.roomNumber}
        autoCapitalize="characters"
        testID="room-number-input"
      />

      <View style={styles.typeGroup}>
        <Text style={styles.label}>Room type</Text>
        <View style={styles.typeChips}>
          {TYPE_PRESETS.map((preset) => (
            <Chip
              key={preset.value}
              label={preset.label}
              selected={typeChoice === preset.value}
              onPress={() => selectType(preset.value)}
              testID={`type-chip-${preset.capacity}`}
            />
          ))}
          <Chip
            label="Custom"
            selected={typeChoice === CUSTOM}
            onPress={() => selectType(CUSTOM)}
            testID="type-chip-custom"
          />
        </View>
        {!!errors.type && <Text style={styles.chipError}>{errors.type}</Text>}
      </View>

      {typeChoice === CUSTOM && (
        <FormField
          label="Custom type"
          value={customType}
          onChangeText={(v) => {
            setCustomType(v);
            clearError('type');
          }}
          placeholder="e.g. Dormitory"
          testID="room-custom-type-input"
        />
      )}

      <FormField
        label="Capacity (beds)"
        value={capacity}
        onChangeText={(v) => {
          setCapacity(v);
          clearError('capacity');
        }}
        keyboardType="numeric"
        placeholder="e.g. 2"
        error={errors.capacity}
        testID="room-capacity-input"
      />
      {editingRoom && occupied > 0 && !errors.capacity && (
        <Text style={styles.hint}>
          {occupied} guest{occupied > 1 ? 's' : ''} currently in this room.
        </Text>
      )}

      <View style={styles.typeGroup}>
        <Text style={styles.label}>Air Conditioning</Text>
        <View style={styles.typeChips}>
          <Chip label="AC" selected={isAc} onPress={() => setIsAc(true)} testID="ac-yes-chip" />
          <Chip label="Non-AC" selected={!isAc} onPress={() => setIsAc(false)} testID="ac-no-chip" />
        </View>
      </View>

      <FormField
        label="Advance / deposit (₹)"
        value={advanceDetails}
        onChangeText={(v) => { setAdvanceDetails(v); clearError('advanceDetails'); }}
        keyboardType="numeric"
        placeholder="e.g. 5000"
        error={errors.advanceDetails}
        testID="room-advance-input"
      />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  typeGroup: { marginBottom: theme.spacing.lg },
  label: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chipError: { ...theme.typography.caption, color: theme.colors.error, marginTop: 6 },
  hint: { ...theme.typography.caption, marginTop: -theme.spacing.md, marginBottom: theme.spacing.md },
});
