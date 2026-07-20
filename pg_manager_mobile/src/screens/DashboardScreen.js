import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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
import PrimaryButton from '../components/PrimaryButton';
import { formatINR, initialsOf } from '../lib/format';
import { monthKeyOf, monthLabel } from '../lib/rent';
import { statsApi, ApiError } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { })}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Icon color={color} size={22} strokeWidth={2.5} />
      </View>
      <View>
        <Text style={styles.cardValue}>{value}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const properties = useStore((s) => s.properties);
  const currentPropertyId = useStore((s) => s.currentPropertyId);
  const property = properties.find((p) => p.id === currentPropertyId);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentMonth = monthKeyOf();

  const load = useCallback(
    async ({ silent } = {}) => {
      if (!currentPropertyId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await statsApi.dashboard(currentPropertyId, currentMonth);
        setStats(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load dashboard.');
      } finally {
        setLoading(false);
      }
    },
    [currentPropertyId, currentMonth]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hasData = !!stats && (stats.total_rooms > 0 || stats.active_guests > 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && !!stats} onRefresh={() => load({ silent: true })} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hello, {user?.full_name || ''}</Text>
            <Text style={styles.pgName} numberOfLines={1}>
              {property?.name || ''}
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

        {loading && !stats ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
        ) : error && !stats ? (
          <EmptyState icon={Building2} title="Couldn't load dashboard" message={error} actionLabel="Retry" onAction={load} />
        ) : !hasData ? (
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
                  value={formatINR(stats.pending_rent)}
                  icon={IndianRupee}
                  color={theme.colors.error}
                />
                <StatCard
                  title="Collected this month"
                  value={formatINR(stats.collected_this_month)}
                  icon={TrendingUp}
                  color={theme.colors.success}
                />
                <StatCard
                  title="Occupancy"
                  value={`${stats.occupancy_rate}%`}
                  icon={Users}
                  color={theme.colors.blue}
                />
                <StatCard
                  title={stats.total_rooms === 1 ? 'Room' : 'Rooms'}
                  value={stats.total_rooms}
                  icon={Bed}
                  color={theme.colors.warning}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rent due · {monthLabel(currentMonth)}</Text>
              {stats.due_guests.length === 0 ? (
                stats.active_guests > 0 ? (
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
                stats.due_guests.map((entry) => (
                  <TouchableOpacity
                    key={entry.guest_id}
                    style={styles.dueRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                      navigation.navigate('GuestDetail', { guestId: entry.guest_id });
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#E3F2FD', '#BBDEFB']}
                      style={styles.dueAvatar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.dueAvatarText}>{initialsOf(entry.guest_name)}</Text>
                    </LinearGradient>
                    <View style={styles.dueInfo}>
                      <Text style={styles.dueName} numberOfLines={1}>
                        {entry.guest_name}
                      </Text>
                    </View>
                    <Text style={styles.dueAmount}>{formatINR(entry.balance)}</Text>
                    <ChevronRight color={theme.colors.textTertiary} size={18} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <View style={styles.actionGrid}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Add guest"
                    onPress={() => navigation.navigate('GuestForm')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    title="Payment"
                    variant="secondary"
                    onPress={() => navigation.navigate('RecordPayment')}
                  />
                </View>
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
  loading: { marginTop: theme.spacing.xxl },
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
  pgName: { ...theme.typography.h1, textTransform: 'capitalize' },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueAvatarText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_700Bold', color: '#1565C0' },
  dueInfo: { flex: 1 },
  dueName: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold' },
  dueAmount: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.error,
  },
  dueAmount: {
    ...theme.typography.body,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.error,
  },
  actionGrid: { flexDirection: 'row', gap: theme.spacing.md },
  bottomSpacer: { height: 120 },
});
