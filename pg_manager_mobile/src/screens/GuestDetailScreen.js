import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { LogOut, Pencil, Phone, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import BackHeader from '../components/BackHeader';
import PrimaryButton from '../components/PrimaryButton';
import { confirm, notify } from '../lib/confirm';
import { formatINR, initialsOf } from '../lib/format';
import { callPhone } from '../lib/phone';
import { monthKeyOf, monthLabel } from '../lib/rent';
import { ApiError, guestsApi, paymentsApi, roomsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function GuestDetailScreen({ navigation, route }) {
  const { guestId } = route.params;
  const currentPropertyId = useStore((s) => s.currentPropertyId);

  const [guest, setGuest] = useState(null);
  const [roomNumber, setRoomNumber] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!currentPropertyId) return;
    setLoading(true);
    setError(null);
    try {
      const g = await guestsApi.get(currentPropertyId, guestId);
      const [room, guestPayments] = await Promise.all([
        roomsApi.get(currentPropertyId, g.room_id).catch(() => null),
        paymentsApi.list(currentPropertyId, { guest_id: guestId }),
      ]);
      setGuest(g);
      setRoomNumber(room?.room_number ?? '—');
      setPayments(guestPayments.sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        navigation.goBack();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not load guest.');
    } finally {
      setLoading(false);
    }
  }, [currentPropertyId, guestId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !guest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <BackHeader title="Guest" />
        <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error && !guest) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <BackHeader title="Guest" />
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!guest) return null;

  const currentMonth = monthKeyOf();
  const paidThisMonth = payments
    .filter((p) => p.for_month?.startsWith(currentMonth))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number(guest.monthly_rent) - paidThisMonth);

  const handleMoveOut = () => {
    confirm({
      title: 'Mark as moved out?',
      message: `${guest.full_name} will stop being billed and their bed in Room ${roomNumber} becomes free. Their payment history is kept.`,
      confirmLabel: 'Move out',
      onConfirm: async () => {
        setBusy(true);
        try {
          const updated = await guestsApi.moveOut(currentPropertyId, guest.id);
          setGuest(updated);
        } catch (err) {
          notify('Could not move out', err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const handleReactivate = async () => {
    setBusy(true);
    try {
      const updated = await guestsApi.reactivate(currentPropertyId, guest.id);
      setGuest(updated);
    } catch (err) {
      notify('Could not reactivate', err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader
        title="Guest"
        right={
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate('GuestForm', { guestId: guest.id });
            }}
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
          <LinearGradient
            colors={['#E3F2FD', '#90CAF9']}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{initialsOf(guest.full_name)}</Text>
          </LinearGradient>
          <Text style={styles.name}>{guest.full_name}</Text>
          <View style={[styles.statusBadge, guest.active ? styles.badgeActive : styles.badgeMuted]}>
            <Text style={[styles.statusText, guest.active ? styles.statusTextActive : styles.statusTextMuted]}>
              {guest.active ? 'Active' : 'Moved out'}
            </Text>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Room</Text>
              <Text style={styles.metaValue}>{roomNumber}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Monthly rent</Text>
              <Text style={styles.metaValue}>{formatINR(guest.monthly_rent)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Joined</Text>
              <Text style={styles.metaValue}>
                {guest.joined_at ? format(new Date(guest.joined_at), 'd MMM yyyy') : '—'}
              </Text>
            </View>
            {!guest.active && guest.moved_out_at && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Moved out</Text>
                <Text style={styles.metaValue}>{format(new Date(guest.moved_out_at), 'd MMM yyyy')}</Text>
              </View>
            )}
            {guest.advance_paid != null && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Advance paid</Text>
                <Text style={styles.metaValue}>{formatINR(guest.advance_paid)}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaGrid}>
            {!!guest.aadhar_last4 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Aadhar</Text>
                <Text style={styles.metaValue}>•••• {guest.aadhar_last4}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Type</Text>
              <Text style={styles.metaValue}>
                {guest.guest_type === 'temporary' ? 'Temporary' : 'Permanent'}
              </Text>
            </View>
            {!!guest.stay_duration && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Stay</Text>
                <Text style={styles.metaValue}>
                  {guest.stay_duration} {guest.stay_unit ?? 'months'}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Food</Text>
              <Text style={styles.metaValue}>
                {guest.has_food ? (guest.food_type === 'non_veg' ? 'Non-Veg' : guest.food_type === 'eggetarian' ? 'Eggetarian' : 'Veg') : 'No'}
              </Text>
            </View>
          </View>

          {!!guest.permanent_address && (
            <View style={styles.addressBox}>
              <Text style={styles.metaLabel}>Permanent Address</Text>
              <Text style={[styles.metaValue, { textAlign: 'center', marginTop: 4 }]}>{guest.permanent_address}</Text>
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
              {formatINR(paidThisMonth)} received of {formatINR(guest.monthly_rent)}
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
        {payments.length === 0 ? (
          <Text style={styles.emptyHistory}>No payments recorded yet.</Text>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMonth}>Rent · {monthLabel(p.for_month?.slice(0, 7))}</Text>
                <Text style={styles.paymentMeta}>
                  {p.paid_at ? format(new Date(p.paid_at), 'd MMM yyyy') : ''} · {p.method}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>{formatINR(p.amount)}</Text>
            </View>
          ))
        )}

        <View style={styles.dangerSection}>
          {guest.active ? (
            <TouchableOpacity style={styles.moveOutButton} onPress={handleMoveOut} activeOpacity={0.8} disabled={busy} testID="move-out">
              <LogOut color={theme.colors.text} size={18} strokeWidth={2.2} />
              <Text style={styles.moveOutText}>Mark as moved out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.moveOutButton} onPress={handleReactivate} activeOpacity={0.8} disabled={busy} testID="reactivate">
              <RotateCcw color={theme.colors.text} size={18} strokeWidth={2.2} />
              <Text style={styles.moveOutText}>Reactivate guest</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  loading: { marginTop: theme.spacing.xxl },
  errorText: { ...theme.typography.body, color: theme.colors.error, textAlign: 'center', margin: theme.spacing.lg },
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  avatarText: { ...theme.typography.h2, color: '#1565C0' },
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
});
