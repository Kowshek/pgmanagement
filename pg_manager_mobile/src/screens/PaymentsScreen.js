import React, { useMemo } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ArrowDownLeft, Plus, Trash2, Wallet } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import { confirm } from '../lib/confirm';
import { formatINR } from '../lib/format';
import { monthLabel } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function PaymentsScreen({ navigation }) {
  const payments = useStore((s) => s.payments);
  const deletePayment = useStore((s) => s.deletePayment);

  const sections = useMemo(() => {
    const byMonth = new Map();
    for (const p of payments) {
      if (!byMonth.has(p.forMonth)) byMonth.set(p.forMonth, []);
      byMonth.get(p.forMonth).push(p);
    }
    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, items]) => ({
        monthKey,
        title: monthLabel(monthKey),
        total: items.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        data: [...items].sort((x, y) => new Date(y.date) - new Date(x.date)),
      }));
  }, [payments]);

  const handleDelete = (payment) => {
    confirm({
      title: 'Delete payment?',
      message: `${formatINR(payment.amount)} from ${payment.guestName} (${monthLabel(payment.forMonth)}) will be removed from the ledger.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => deletePayment(payment.id),
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
          {item.guestName}
        </Text>
        <Text style={styles.date}>
          Room {item.roomNumber} · {format(new Date(item.date), 'd MMM')} · {item.method}
        </Text>
      </View>
      <Text style={styles.amount}>+{formatINR(item.amount)}</Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
        accessibilityRole="button"
        accessibilityLabel={`Delete payment from ${item.guestName}`}
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
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            message="Record rent as it comes in — pending amounts update automatically."
            actionLabel="Record payment"
            onAction={() => navigation.navigate('RecordPayment')}
          />
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  addButton: {
    backgroundColor: theme.colors.primary,
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  listContainer: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 },
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
