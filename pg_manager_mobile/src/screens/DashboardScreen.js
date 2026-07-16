import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bed,
  Building2,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react-native';

import EmptyState from '../components/EmptyState';
import { formatINR, initialsOf } from '../lib/format';
import { computeStats, monthKeyOf, monthLabel } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Icon color={color} size={22} strokeWidth={2.5} />
      </View>
      <View>
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const pgDetails = useStore((s) => s.pgDetails);
  const guests = useStore((s) => s.guests);
  const rooms = useStore((s) => s.rooms);
  const payments = useStore((s) => s.payments);

  const currentMonth = monthKeyOf();
  const stats = useMemo(
    () => computeStats({ guests, rooms, payments }, currentMonth),
    [guests, rooms, payments, currentMonth]
  );
  const hasData = rooms.length > 0 || guests.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hello, {pgDetails.ownerName}</Text>
            <Text style={styles.pgName} numberOfLines={1}>
              {pgDetails.pgName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            testID="open-settings"
          >
            <Settings color={theme.colors.text} size={20} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {!hasData ? (
          <EmptyState
            icon={Building2}
            title="Set up your PG"
            message="Start by adding your rooms, then move guests in and track their rent here."
            actionLabel="Add a room"
            onAction={() => navigation.navigate('RoomForm')}
          />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.grid}>
                <StatCard
                  title="Pending rent"
                  value={formatINR(stats.pendingRent)}
                  icon={IndianRupee}
                  color={theme.colors.error}
                />
                <StatCard
                  title="Collected this month"
                  value={formatINR(stats.collectedThisMonth)}
                  icon={TrendingUp}
                  color={theme.colors.success}
                />
                <StatCard
                  title="Occupancy"
                  value={`${stats.occupancyRate}%`}
                  icon={Users}
                  color={theme.colors.blue}
                />
                <StatCard
                  title={stats.totalRooms === 1 ? 'Room' : 'Rooms'}
                  value={stats.totalRooms}
                  icon={Bed}
                  color={theme.colors.warning}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rent due · {monthLabel(currentMonth)}</Text>
              {stats.dueGuests.length === 0 ? (
                stats.activeGuests > 0 ? (
                  <View style={styles.allPaidCard}>
                    <CheckCircle2 color={theme.colors.success} size={22} strokeWidth={2.2} />
                    <Text style={styles.allPaidText}>All rent collected. Nothing pending.</Text>
                  </View>
                ) : (
                  <View style={styles.allPaidCard}>
                    <Users color={theme.colors.textTertiary} size={22} strokeWidth={2} />
                    <Text style={styles.noGuestsText}>No active guests yet.</Text>
                  </View>
                )
              ) : (
                stats.dueGuests.map(({ guest, balance }) => (
                  <TouchableOpacity
                    key={guest.id}
                    style={styles.dueRow}
                    onPress={() => navigation.navigate('GuestDetail', { guestId: guest.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dueAvatar}>
                      <Text style={styles.dueAvatarText}>{initialsOf(guest.fullName)}</Text>
                    </View>
                    <View style={styles.dueInfo}>
                      <Text style={styles.dueName} numberOfLines={1}>
                        {guest.fullName}
                      </Text>
                      <Text style={styles.dueRoom}>Room {guest.roomNumber}</Text>
                    </View>
                    <Text style={styles.dueAmount}>{formatINR(balance)}</Text>
                    <ChevronRight color={theme.colors.textTertiary} size={18} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <View style={styles.actionGrid}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('GuestForm')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionText}>Add guest</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  onPress={() => navigation.navigate('RecordPayment')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionTextSecondary}>Record payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, paddingHorizontal: theme.spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  headerText: { flex: 1, marginRight: theme.spacing.md },
  greeting: {
    ...theme.typography.bodySecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  pgName: { ...theme.typography.h1 },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginBottom: theme.spacing.xl },
  sectionTitle: { ...theme.typography.h3, marginBottom: theme.spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  card: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 4,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  cardValue: { ...theme.typography.h2, marginBottom: 2 },
  cardTitle: { ...theme.typography.caption },
  allPaidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...theme.shadows.sm,
  },
  allPaidText: { ...theme.typography.body, color: theme.colors.success, flex: 1 },
  noGuestsText: { ...theme.typography.bodySecondary, flex: 1 },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...theme.shadows.sm,
  },
  dueAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueAvatarText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_700Bold' },
  dueInfo: { flex: 1 },
  dueName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  dueRoom: { ...theme.typography.caption },
  dueAmount: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.error,
  },
  actionGrid: { flexDirection: 'row', gap: theme.spacing.md },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  actionText: {
    ...theme.typography.body,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionTextSecondary: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
  },
  bottomSpacer: { height: 40 },
});
