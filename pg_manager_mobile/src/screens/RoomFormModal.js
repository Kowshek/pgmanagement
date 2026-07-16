import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Chip from '../components/Chip';
import FormField from '../components/FormField';
import ModalShell from '../components/ModalShell';
import PrimaryButton from '../components/PrimaryButton';
import { occupancyOf } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const TYPE_PRESETS = [
  { label: 'Single', capacity: 1 },
  { label: '2 Sharing', capacity: 2 },
  { label: '3 Sharing', capacity: 3 },
  { label: '4 Sharing', capacity: 4 },
];
const CUSTOM = 'Custom';

export default function RoomFormModal({ navigation, route }) {
  const roomId = route.params?.roomId;
  const rooms = useStore((s) => s.rooms);
  const guests = useStore((s) => s.guests);
  const addRoom = useStore((s) => s.addRoom);
  const updateRoom = useStore((s) => s.updateRoom);

  const editingRoom = roomId ? rooms.find((r) => r.id === roomId) : null;
  const occupied = editingRoom ? occupancyOf(editingRoom, guests) : 0;

  const presetOf = (type) => TYPE_PRESETS.find((p) => p.label === type);

  const [roomNumber, setRoomNumber] = useState(editingRoom?.roomNumber ?? '');
  const [typeChoice, setTypeChoice] = useState(
    editingRoom ? (presetOf(editingRoom.type) ? editingRoom.type : CUSTOM) : null
  );
  const [customType, setCustomType] = useState(
    editingRoom && !presetOf(editingRoom.type) ? editingRoom.type : ''
  );
  const [capacity, setCapacity] = useState(editingRoom ? String(editingRoom.capacity) : '');
  const [isAc, setIsAc] = useState(editingRoom?.isAc ?? false);
  const [advanceDetails, setAdvanceDetails] = useState(editingRoom?.advanceDetails ?? '');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const selectType = (label) => {
    setTypeChoice(label);
    clearError('type');
    const preset = presetOf(label);
    if (preset) {
      setCapacity(String(preset.capacity));
      clearError('capacity');
    }
  };

  const handleSave = () => {
    const type = typeChoice === CUSTOM ? customType.trim() : typeChoice;
    const cap = Number(capacity);

    const next = {};
    if (!roomNumber.trim()) next.roomNumber = 'Room number is required.';
    if (!type) next.type = 'Select a room type.';
    if (!Number.isInteger(cap) || cap < 1 || cap > 20) {
      next.capacity = 'Whole number between 1 and 20.';
    } else if (editingRoom && cap < occupied) {
      next.capacity = `At least ${occupied} — that many guests live here now.`;
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = { roomNumber, type, capacity: cap, isAc, advanceDetails };
    const res = editingRoom ? updateRoom(editingRoom.id, payload) : addRoom(payload);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    navigation.goBack();
  };

  return (
    <ModalShell
      title={editingRoom ? 'Edit room' : 'Add room'}
      error={formError}
      footer={
        <PrimaryButton
          title={editingRoom ? 'Save changes' : 'Save room'}
          onPress={handleSave}
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
              key={preset.label}
              label={preset.label}
              selected={typeChoice === preset.label}
              onPress={() => selectType(preset.label)}
              testID={`type-chip-${preset.capacity}`}
            />
          ))}
          <Chip
            label={CUSTOM}
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
          <Chip
            label="AC"
            selected={isAc}
            onPress={() => setIsAc(true)}
            testID="ac-yes-chip"
          />
          <Chip
            label="Non-AC"
            selected={!isAc}
            onPress={() => setIsAc(false)}
            testID="ac-no-chip"
          />
        </View>
      </View>

      <FormField
        label="Advance details"
        value={advanceDetails}
        onChangeText={setAdvanceDetails}
        placeholder="e.g. 5000 deposit"
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
