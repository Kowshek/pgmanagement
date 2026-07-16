import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Plus, Search, UserPlus } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import Chip from '../components/Chip';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import { formatINR, initialsOf } from '../lib/format';
import { callPhone } from '../lib/phone';
import { balanceForMonth, monthKeyOf } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Moved out' },
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function GuestsScreen({ navigation }) {
  const guests = useStore((s) => s.guests);
  const payments = useStore((s) => s.payments);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const currentMonth = monthKeyOf();

  const visibleGuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => {
        if (filter === 'active' && !g.active) return false;
        if (filter === 'inactive' && g.active) return false;
        if (!q) return true;
        return (
          g.fullName.toLowerCase().includes(q) ||
          String(g.roomNumber).toLowerCase().includes(q) ||
          String(g.phone).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [guests, query, filter]);

  const renderGuest = ({ item, index }) => {
    const balance = item.active ? balanceForMonth(item, payments, currentMonth) : 0;
    return (
      <AnimatedTouchable
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
        style={styles.guestCard}
        onPress={() => navigation.navigate('GuestDetail', { guestId: item.id })}
        activeOpacity={0.7}
        testID={`guest-row-${item.id}`}
      >
        <View style={styles.avatar}>
          {item.profilePicture ? (
            <Image source={{ uri: item.profilePicture }} style={styles.profileImage} />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(item.fullName)}</Text>
          )}
        </View>
        <View style={styles.details}>
          <Text style={styles.name} numberOfLines={1}>
            {item.fullName}
          </Text>
          <Text style={styles.roomInfo}>
            Room {item.roomNumber} · {formatINR(item.monthlyRent)}/mo
          </Text>
        </View>
        <View style={styles.actions}>
          {!item.active ? (
            <View style={[styles.badge, styles.badgeMuted]}>
              <Text style={[styles.badgeText, styles.badgeTextMuted]}>Moved out</Text>
            </View>
          ) : balance > 0 ? (
            <View style={[styles.badge, styles.badgeDue]}>
              <Text style={[styles.badgeText, styles.badgeTextDue]}>Due {formatINR(balance)}</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgePaid]}>
              <Text style={[styles.badgeText, styles.badgeTextPaid]}>Paid</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => callPhone(item.phone)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.fullName}`}
          >
            <Phone color={theme.colors.primary} size={18} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedTouchable>
    );
  };

  const emptyState =
    guests.length === 0 ? (
      <EmptyState
        icon={UserPlus}
        title="No guests yet"
        message="Add your first guest and their rent will be tracked automatically each month."
        actionLabel="Add guest"
        onAction={() => navigation.navigate('GuestForm')}
      />
    ) : (
      <EmptyState icon={Search} title="No matches" message="Try a different search or filter." />
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Guests"
        right={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('GuestForm')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add guest"
            testID="add-guest"
          >
            <Plus color="#FFFFFF" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchRow}>
        <Search color={theme.colors.textTertiary} size={18} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, room or phone"
          placeholderTextColor={theme.colors.textTertiary}
          autoCorrect={false}
          testID="guest-search"
        />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            testID={`guest-filter-${f.key}`}
          />
        ))}
      </View>

      <FlatList
        data={visibleGuests}
        keyExtractor={(item) => item.id}
        renderItem={renderGuest}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={emptyState}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, ...theme.typography.body },
  filters: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  listContainer: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 },
  guestCard: {
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    overflow: 'hidden',
  },
  profileImage: { width: '100%', height: '100%' },
  avatarText: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_700Bold' },
  details: { flex: 1, marginRight: theme.spacing.sm },
  name: { ...theme.typography.body, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  roomInfo: { ...theme.typography.caption },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  badgeMuted: { backgroundColor: theme.colors.background },
  badgeDue: { backgroundColor: theme.colors.error + '15' },
  badgePaid: { backgroundColor: theme.colors.success + '15' },
  badgeText: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', textTransform: 'uppercase' },
  badgeTextMuted: { color: theme.colors.textSecondary },
  badgeTextDue: { color: theme.colors.error },
  badgeTextPaid: { color: theme.colors.success },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
