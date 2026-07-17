import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bed, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import { confirm, notify } from '../lib/confirm';
import { formatINR, roomTypeLabel } from '../lib/format';
import { ApiError, guestsApi, roomsApi } from '../lib/api';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function RoomsScreen({ navigation }) {
  const currentPropertyId = useStore((s) => s.currentPropertyId);

  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!currentPropertyId) return;
    setLoading(true);
    setError(null);
    try {
      const [roomList, guestList] = await Promise.all([
        roomsApi.list(currentPropertyId),
        guestsApi.list(currentPropertyId, { active: true }),
      ]);
      setRooms(roomList);
      setGuests(guestList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load rooms.');
    } finally {
      setLoading(false);
    }
  }, [currentPropertyId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true })
      ),
    [rooms]
  );

  const occupantsByRoom = useMemo(() => {
    const map = new Map();
    for (const g of guests) {
      if (!map.has(g.room_id)) map.set(g.room_id, []);
      map.get(g.room_id).push(g);
    }
    return map;
  }, [guests]);

  const handleDelete = (room) => {
    confirm({
      title: 'Delete room?',
      message: `Room ${room.room_number} will be removed permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await roomsApi.remove(currentPropertyId, room.id);
          setRooms((rs) => rs.filter((r) => r.id !== room.id));
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            notify('Room is occupied', `Room ${room.room_number} still has guests. Move them out or to another room first.`);
          } else {
            notify('Could not delete', err.message);
          }
        }
      },
    });
  };

  const renderRoom = ({ item, index }) => {
    const occupants = occupantsByRoom.get(item.id) || [];
    const isFull = item.status === 'Full';
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
        style={styles.roomCard}
        testID={`room-card-${item.room_number}`}
      >
        <View style={styles.roomHeader}>
          <View style={styles.roomTitleRow}>
            <Text style={styles.roomNumber}>Room {item.room_number}</Text>
            <View style={[styles.badge, isFull ? styles.badgeFull : styles.badgeAvailable]}>
              <Text style={[styles.badgeText, isFull ? styles.badgeTextFull : styles.badgeTextAvailable]}>
                {item.status}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('RoomForm', { roomId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Edit room ${item.room_number}`}
              testID={`edit-room-${item.room_number}`}
            >
              <Pencil color={theme.colors.text} size={16} strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButtonError}
              onPress={() => handleDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Delete room ${item.room_number}`}
              testID={`delete-room-${item.room_number}`}
            >
              <Trash2 color={theme.colors.error} size={16} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roomFooter}>
          <View style={styles.roomDetailsCol}>
            <Text style={styles.detailText}>{roomTypeLabel(item)} • {item.is_ac ? 'AC' : 'Non-AC'}</Text>
            {item.advance_details != null && (
              <Text style={styles.advanceText}>Advance: {formatINR(item.advance_details)}</Text>
            )}
          </View>
          <View style={styles.occupancyContainer}>
            <Users color={theme.colors.textSecondary} size={16} />
            <Text style={styles.occupancyText}>
              {item.occupied_beds}/{item.capacity}
            </Text>
          </View>
        </View>

        {occupants.length > 0 && (
          <View style={styles.occupantsRow}>
            {occupants.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.occupantChip}
                onPress={() => navigation.navigate('GuestDetail', { guestId: g.id })}
                activeOpacity={0.7}
              >
                <Text style={styles.occupantName} numberOfLines={1}>
                  {g.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Rooms"
        right={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('RoomForm')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add room"
            testID="add-room"
          >
            <Plus color="#FFFFFF" size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        }
      />

      {loading && rooms.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={sortedRooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            error ? (
              <EmptyState icon={Bed} title="Couldn't load rooms" message={error} actionLabel="Retry" onAction={load} />
            ) : (
              <EmptyState
                icon={Bed}
                title="No rooms yet"
                message="Add the rooms in your property. Guests are assigned to rooms and beds are tracked automatically."
                actionLabel="Add room"
                onAction={() => navigation.navigate('RoomForm')}
              />
            )
          }
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
  listContainer: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 },
  roomCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  roomNumber: { ...theme.typography.h2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  badgeAvailable: { backgroundColor: theme.colors.success + '15' },
  badgeFull: { backgroundColor: theme.colors.background },
  badgeText: {
    ...theme.typography.caption,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  badgeTextAvailable: { color: theme.colors.success },
  badgeTextFull: { color: theme.colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: theme.spacing.sm },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonError: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  roomDetailsCol: { flexDirection: 'column', gap: 2 },
  detailText: { ...theme.typography.bodySecondary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  advanceText: { ...theme.typography.caption, color: theme.colors.textTertiary },
  occupancyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  occupancyText: { ...theme.typography.caption, fontFamily: 'PlusJakartaSans_700Bold' },
  occupantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  occupantChip: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    maxWidth: '100%',
  },
  occupantName: { ...theme.typography.caption, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
