import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { ArrowDownLeft, Plus, Trash2, Wallet } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import { confirm } from '../lib/confirm';
import { formatINR } from '../lib/format';
import { monthLabel } from '../lib/rent';
import { ApiError, guestsApi, paymentsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function PaymentsScreen({ navigation }) {
  const currentPropertyId = useStore((s) => s.currentPropertyId);

  const [payments, setPayments] = useState([]);
  const [guestNameById, setGuestNameById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!currentPropertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [paymentList, guestList] = await Promise.all([
        paymentsApi.list(currentPropertyId),
        guestsApi.list(currentPropertyId),
      ]);
      setPayments(paymentList);
      const nameMap = {};
      for (const g of guestList) nameMap[g.id] = g.full_name;
      setGuestNameById(nameMap);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, [currentPropertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sections = useMemo(() => {
    const byMonth = new Map();
    for (const p of payments) {
      const monthKey = String(p.for_month).slice(0, 7);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey).push(p);
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, items]) => ({
        monthKey,
        title: monthLabel(monthKey),
        total: items.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        data: [...items].sort((x, y) => new Date(y.paid_at) - new Date(x.paid_at)),
      }));
  }, [payments]);

  const handleDelete = (payment) => {
    const guestName = guestNameById[payment.guest_id] || 'this guest';
    confirm({
      title: 'Delete payment?',
      message: `${formatINR(payment.amount)} from ${guestName} (${monthLabel(String(payment.for_month).slice(0, 7))}) will be removed from the ledger.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await paymentsApi.remove(currentPropertyId, payment.id);
          setPayments((ps) => ps.filter((p) => p.id !== payment.id));
        } catch (err) {
          // Silently reloading is enough feedback here — the row will
          // reappear if the delete actually failed server-side.
          load();
        }
      },
    });
  };

  const renderPayment = ({ item, index }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={Layout.springify()}
      style={styles.paymentCard}
    >
      <View style={styles.paymentIcon}>
        <ArrowDownLeft color={theme.colors.success} size={22} strokeWidth={2.5} />
      </View>
      <View style={styles.paymentDetails}>
        <Text style={styles.guestName} numberOfLines={1}>
          {guestNameById[item.guest_id] || 'Unknown guest'}
        </Text>
        <Text style={styles.date}>
          {format(new Date(item.paid_at), 'd MMM')} · {item.method}
        </Text>
      </View>
      <Text style={styles.amount}>+{formatINR(item.amount)}</Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
        accessibilityRole="button"
        accessibilityLabel={`Delete payment from ${guestNameById[item.guest_id] || 'guest'}`}
      >
        <Trash2 color={theme.colors.textTertiary} size={16} strokeWidth={2.2} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Payments"
        right={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('RecordPayment')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Record payment"
            testID="add-payment"
          >
            <Plus color="#FFFFFF" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      {loading && payments.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderPayment}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionTotal}>{formatINR(section.total)}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            error ? (
              <EmptyState icon={Wallet} title="Couldn't load payments" message={error} actionLabel="Retry" onAction={load} />
            ) : (
              <EmptyState
                icon={Wallet}
                title="No payments yet"
                message="Record rent as it comes in — pending amounts update automatically."
                actionLabel="Record payment"
                onAction={() => navigation.navigate('RecordPayment')}
              />
            )
          }
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  loading: { marginTop: theme.spacing.xxl },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  listContainer: { paddingHorizontal: theme.spacing.lg, paddingBottom: 120, flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: { ...theme.typography.h3 },
  sectionTotal: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_700Bold', color: theme.colors.success },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  paymentDetails: { flex: 1, marginRight: theme.spacing.sm },
  guestName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  date: { ...theme.typography.caption },
  amount: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.success,
    marginRight: theme.spacing.sm,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
