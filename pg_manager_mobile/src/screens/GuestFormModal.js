import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, Alert, Modal, Pressable } from 'react-native';
import { BedDouble, Camera, ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import ModalShell from '../components/ModalShell';
import PrimaryButton from '../components/PrimaryButton';
import { bedsFreeOf } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const PHONE_RE = /^[+\d][\d\s-]{6,15}$/;

export default function GuestFormModal({ navigation, route }) {
  const guestId = route.params?.guestId;
  const guests = useStore((s) => s.guests);
  const rooms = useStore((s) => s.rooms);
  const addGuest = useStore((s) => s.addGuest);
  const updateGuest = useStore((s) => s.updateGuest);

  const editingGuest = guestId ? guests.find((g) => g.id === guestId) : null;

  const [fullName, setFullName] = useState(editingGuest?.fullName ?? '');
  const [phone, setPhone] = useState(editingGuest?.phone ?? '');
  const [roomNumber, setRoomNumber] = useState(editingGuest?.roomNumber ?? null);
  const [monthlyRent, setMonthlyRent] = useState(
    editingGuest ? String(editingGuest.monthlyRent) : ''
  );

  const [aadharNumber, setAadharNumber] = useState(editingGuest?.aadharNumber ?? '');
  const [permanentAddress, setPermanentAddress] = useState(editingGuest?.permanentAddress ?? '');
  const [profilePicture, setProfilePicture] = useState(editingGuest?.profilePicture ?? '');
  const [guestType, setGuestType] = useState(editingGuest?.guestType ?? 'permanent');

  // Stay duration is universal — available for both permanent and temporary guests
  const [stayDuration, setStayDuration] = useState(
    editingGuest?.stayDuration ? String(editingGuest.stayDuration) : ''
  );
  const [stayUnit, setStayUnit] = useState(editingGuest?.stayUnit ?? 'months'); // 'days' | 'months' | 'years'

  const [advancePaid, setAdvancePaid] = useState(
    editingGuest?.advancePaid != null ? String(editingGuest.advancePaid) : ''
  );

  const [food, setFood] = useState(editingGuest?.food ?? false);
  const [foodType, setFoodType] = useState(editingGuest?.foodType ?? 'veg');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);

  // ── Camera ──────────────────────────────────────────────
  const openCamera = async () => {
    setShowPhotoMenu(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled) setProfilePicture(result.assets[0].uri);
  };

  // ── Gallery ─────────────────────────────────────────────
  const openGallery = async () => {
    setShowPhotoMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setProfilePicture(result.assets[0].uri);
  };

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
      ),
    [rooms]
  );

  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: null } : e));

  const handleSave = () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    if (!PHONE_RE.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    const rent = Number(monthlyRent);
    if (!Number.isFinite(rent) || rent < 0) next.monthlyRent = 'Enter a valid amount.';
    if (!roomNumber) next.room = 'Select a room.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const payload = {
      fullName,
      phone,
      roomNumber,
      monthlyRent: rent,
      aadharNumber,
      permanentAddress,
      profilePicture,
      guestType,
      stayDuration: stayDuration ? Number(stayDuration) : null,
      stayUnit,
      advancePaid: advancePaid !== '' ? Number(advancePaid) : null,
      food,
      foodType: food ? foodType : null,
    };
    const res = editingGuest ? updateGuest(editingGuest.id, payload) : addGuest(payload);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    navigation.goBack();
  };

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
          title={editingGuest ? 'Save changes' : 'Save guest'}
          onPress={handleSave}
          testID="guest-form-save"
        />
      }
    >

      {/* ── Profile Picture ────────────────────────────── */}
      <View style={styles.imagePickerGroup}>
        <Text style={styles.label}>Profile Picture</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity
            style={styles.imagePickerBtn}
            onPress={() => setShowPhotoMenu(true)}
            testID="profile-picture-btn"
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.profileImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Camera color={theme.colors.textSecondary} size={28} />
                <Text style={styles.imagePlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {!!profilePicture && (
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => setProfilePicture('')}
            >
              <X color={theme.colors.error} size={16} />
              <Text style={styles.removePhotoText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Basic Info ────────────────────────────────── */}
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

      {/* ── Room ─────────────────────────────────────── */}
      <View style={styles.roomGroup}>
        <Text style={styles.label}>Room</Text>
        <View style={styles.roomChips}>
          {sortedRooms.map((room) => {
            const isCurrent = editingGuest?.roomNumber === room.roomNumber;
            const free = bedsFreeOf(room, guests);
            const disabled = free === 0 && !isCurrent;
            return (
              <Chip
                key={room.id}
                label={
                  isCurrent
                    ? `${room.roomNumber} · current`
                    : `${room.roomNumber} · ${free} free`
                }
                selected={roomNumber === room.roomNumber}
                disabled={disabled}
                onPress={() => { setRoomNumber(room.roomNumber); clearError('room'); }}
                testID={`room-chip-${room.roomNumber}`}
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
        onChangeText={setAdvancePaid}
        keyboardType="numeric"
        placeholder="e.g. 5000"
        testID="guest-advance-input"
      />

      <FormField
        label="Aadhar Number"
        value={aadharNumber}
        onChangeText={setAadharNumber}
        placeholder="e.g. 1234 5678 9012"
        testID="guest-aadhar-input"
        keyboardType="numeric"
      />

      {/* ── Address — larger multiline box ───────────── */}
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

      {/* ── Guest Type ───────────────────────────────── */}
      <View style={styles.roomGroup}>
        <Text style={styles.label}>Guest Type</Text>
        <View style={styles.roomChips}>
          <Chip label="Permanent" selected={guestType === 'permanent'} onPress={() => setGuestType('permanent')} />
          <Chip label="Temporary" selected={guestType === 'temp'} onPress={() => setGuestType('temp')} />
        </View>
      </View>

      {/* ── Stay Duration — available for BOTH types ─── */}
      <View style={styles.stayRow}>
        <View style={styles.stayInputWrap}>
          <Text style={styles.label}>
            {guestType === 'temp' ? 'Expected stay' : 'Stay duration'}
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

      {/* ── Food ─────────────────────────────────────── */}
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
            <Chip label="Non-Vegetarian" selected={foodType === 'non-veg'} onPress={() => setFoodType('non-veg')} />
          </View>
        </View>
      )}

      {/* ── Photo Picker Bottom Sheet ─────────────────── */}
      <Modal
        visible={showPhotoMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoMenu(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowPhotoMenu(false)}>
          <View style={styles.photoSheet}>
            <Text style={styles.photoSheetTitle}>Add Profile Photo</Text>

            <TouchableOpacity style={styles.photoOption} onPress={openCamera}>
              <View style={styles.photoIconWrap}>
                <Camera color={theme.colors.primary} size={22} />
              </View>
              <View>
                <Text style={styles.photoOptionText}>Take Photo</Text>
                <Text style={styles.photoOptionSub}>Open camera</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.photoDivider} />

            <TouchableOpacity style={styles.photoOption} onPress={openGallery}>
              <View style={styles.photoIconWrap}>
                <ImageIcon color={theme.colors.primary} size={22} />
              </View>
              <View>
                <Text style={styles.photoOptionText}>Choose from Gallery</Text>
                <Text style={styles.photoOptionSub}>Pick an existing photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoCancelBtn}
              onPress={() => setShowPhotoMenu(false)}
            >
              <Text style={styles.photoCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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

  // ── Profile picture
  imagePickerGroup: { marginBottom: theme.spacing.lg },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  imagePickerBtn: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { ...theme.typography.caption, color: theme.colors.textSecondary },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error + '12',
  },
  removePhotoText: { ...theme.typography.caption, color: theme.colors.error },

  // ── Address
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

  // ── Stay duration
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

  // ── Photo picker modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  photoSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
    gap: 4,
  },
  photoSheetTitle: {
    ...theme.typography.h3,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 14,
  },
  photoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionText: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  photoOptionSub: {
    ...theme.typography.caption,
    marginTop: 1,
  },
  photoDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  photoCancelBtn: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  photoCancelText: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.textSecondary,
  },
});
