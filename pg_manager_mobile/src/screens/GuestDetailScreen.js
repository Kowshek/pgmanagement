import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { LogOut, Pencil, Phone, RotateCcw, Trash2 } from 'lucide-react-native';

import BackHeader from '../components/BackHeader';
import PrimaryButton from '../components/PrimaryButton';
import { confirm, notify } from '../lib/confirm';
import { formatINR, initialsOf } from '../lib/format';
import { callPhone } from '../lib/phone';
import { monthKeyOf, monthLabel, paidForMonth } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function GuestDetailScreen({ navigation, route }) {
  const { guestId } = route.params;
  const guest = useStore((s) => s.guests.find((g) => g.id === guestId));
  const payments = useStore((s) => s.payments);
  const setGuestActive = useStore((s) => s.setGuestActive);
  const deleteGuest = useStore((s) => s.deleteGuest);

  // Guest can disappear (deleted elsewhere); leave the screen gracefully.
  useEffect(() => {
    if (!guest) navigation.goBack();
  }, [guest, navigation]);
  if (!guest) return null;

  const currentMonth = monthKeyOf();
  const paid = paidForMonth(payments, guest.id, currentMonth);
  const balance = Math.max(0, Number(guest.monthlyRent) - paid);
  const guestPayments = payments
    .filter((p) => p.guestId === guest.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleMoveOut = () => {
    confirm({
      title: 'Mark as moved out?',
      message: `${guest.fullName} will stop being billed and their bed in Room ${guest.roomNumber} becomes free. Their payment history is kept.`,
      confirmLabel: 'Move out',
      onConfirm: () => {
        const res = setGuestActive(guest.id, false);
        if (!res.ok) notify('Could not move out', res.error);
      },
    });
  };

  const handleReactivate = () => {
    const res = setGuestActive(guest.id, true);
    if (!res.ok) notify('Could not reactivate', res.error);
  };

  const handleDelete = () => {
    confirm({
      title: 'Delete guest?',
      message: `${guest.fullName} will be removed permanently. Their payments stay in the ledger.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        deleteGuest(guest.id);
        // navigation.goBack() happens via the effect above once the guest is gone.
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader
        title="Guest"
        right={
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('GuestForm', { guestId: guest.id })}
            accessibilityRole="button"
            accessibilityLabel="Edit guest"
            testID="edit-guest"
          >
            <Pencil color={theme.colors.text} size={18} strokeWidth={2.2} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {guest.profilePicture ? (
              <Image source={{ uri: guest.profilePicture }} style={styles.profileImage} />
            ) : (
              <Text style={styles.avatarText}>{initialsOf(guest.fullName)}</Text>
            )}
          </View>
          <Text style={styles.name}>{guest.fullName}</Text>
          <View style={[styles.statusBadge, guest.active ? styles.badgeActive : styles.badgeMuted]}>
            <Text style={[styles.statusText, guest.active ? styles.statusTextActive : styles.statusTextMuted]}>
              {guest.active ? 'Active' : 'Moved out'}
            </Text>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Room</Text>
              <Text style={styles.metaValue}>{guest.roomNumber}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Monthly rent</Text>
              <Text style={styles.metaValue}>{formatINR(guest.monthlyRent)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Joined</Text>
              <Text style={styles.metaValue}>
                {guest.joinedAt ? format(new Date(guest.joinedAt), 'd MMM yyyy') : '—'}
              </Text>
            </View>
            {!guest.active && guest.movedOutAt && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Moved out</Text>
                <Text style={styles.metaValue}>{format(new Date(guest.movedOutAt), 'd MMM yyyy')}</Text>
              </View>
            )}
            {guest.advancePaid != null && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Advance paid</Text>
                <Text style={styles.metaValue}>{formatINR(guest.advancePaid)}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaGrid}>
            {!!guest.aadharNumber && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Aadhar</Text>
                <Text style={styles.metaValue}>{guest.aadharNumber}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Type</Text>
              <Text style={styles.metaValue}>
                {guest.guestType === 'temp' ? 'Temporary' : 'Permanent'}
              </Text>
            </View>
            {!!guest.stayDuration && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Stay</Text>
                <Text style={styles.metaValue}>
                  {guest.stayDuration} {guest.stayUnit ?? 'months'}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Food</Text>
              <Text style={styles.metaValue}>
                {guest.food ? (guest.foodType === 'non-veg' ? 'Non-Veg' : 'Veg') : 'No'}
              </Text>
            </View>
          </View>

          {!!guest.permanentAddress && (
            <View style={styles.addressBox}>
              <Text style={styles.metaLabel}>Permanent Address</Text>
              <Text style={[styles.metaValue, { textAlign: 'center', marginTop: 4 }]}>{guest.permanentAddress}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.phoneRow} onPress={() => callPhone(guest.phone)} activeOpacity={0.7}>
            <Phone color={theme.colors.primary} size={16} strokeWidth={2.5} />
            <Text style={styles.phoneText}>{guest.phone}</Text>
          </TouchableOpacity>
        </View>

        {guest.active && (
          <View style={styles.rentCard}>
            <View style={styles.rentHeader}>
              <Text style={styles.rentTitle}>{monthLabel(currentMonth)}</Text>
              <Text style={[styles.rentBalance, balance === 0 && styles.rentPaid]}>
                {balance === 0 ? 'Paid in full' : `${formatINR(balance)} due`}
              </Text>
            </View>
            <Text style={styles.rentSub}>
              {formatINR(paid)} received of {formatINR(guest.monthlyRent)}
            </Text>
            <PrimaryButton
              title="Record payment"
              onPress={() => navigation.navigate('RecordPayment', { guestId: guest.id })}
              style={styles.rentButton}
              testID="record-payment-for-guest"
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Payment history</Text>
        {guestPayments.length === 0 ? (
          <Text style={styles.emptyHistory}>No payments recorded yet.</Text>
        ) : (
          guestPayments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMonth}>Rent · {monthLabel(p.forMonth)}</Text>
                <Text style={styles.paymentMeta}>
                  {format(new Date(p.date), 'd MMM yyyy')} · {p.method}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>{formatINR(p.amount)}</Text>
            </View>
          ))
        )}

        <View style={styles.dangerSection}>
          {guest.active ? (
            <TouchableOpacity style={styles.moveOutButton} onPress={handleMoveOut} activeOpacity={0.8} testID="move-out">
              <LogOut color={theme.colors.text} size={18} strokeWidth={2.2} />
              <Text style={styles.moveOutText}>Mark as moved out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.moveOutButton} onPress={handleReactivate} activeOpacity={0.8} testID="reactivate">
              <RotateCcw color={theme.colors.text} size={18} strokeWidth={2.2} />
              <Text style={styles.moveOutText}>Reactivate guest</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8} testID="delete-guest">
            <Trash2 color={theme.colors.error} size={18} strokeWidth={2.2} />
            <Text style={styles.deleteText}>Delete guest</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  profileImage: { width: '100%', height: '100%' },
  avatarText: { ...theme.typography.h2 },
  name: { ...theme.typography.h2, textAlign: 'center' },
  statusBadge: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgeActive: { backgroundColor: theme.colors.success + '15' },
  badgeMuted: { backgroundColor: theme.colors.background },
  statusText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', textTransform: 'uppercase' },
  statusTextActive: { color: theme.colors.success },
  statusTextMuted: { color: theme.colors.textSecondary },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  metaItem: { alignItems: 'center', minWidth: 80 },
  metaLabel: { ...theme.typography.small, marginBottom: 2 },
  metaValue: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  addressBox: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
  },
  phoneText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  rentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    marginBottom: theme.spacing.lg,
  },
  rentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rentTitle: { ...theme.typography.h3 },
  rentBalance: { ...theme.typography.h3, color: theme.colors.error },
  rentPaid: { color: theme.colors.success },
  rentSub: { ...theme.typography.caption, marginTop: 4 },
  rentButton: { marginTop: theme.spacing.md, paddingVertical: 14 },
  sectionTitle: { ...theme.typography.h3, marginBottom: theme.spacing.md },
  emptyHistory: { ...theme.typography.bodySecondary, marginBottom: theme.spacing.lg },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  paymentInfo: { flex: 1 },
  paymentMonth: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  paymentMeta: { ...theme.typography.caption },
  paymentAmount: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_700Bold', color: theme.colors.success },
  dangerSection: { marginTop: theme.spacing.lg, gap: theme.spacing.sm },
  moveOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
  },
  moveOutText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.error + '10',
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
  },
  deleteText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', color: theme.colors.error },
});
