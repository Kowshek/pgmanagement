import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bed, Pencil, Plus, Trash2, Users } from 'lucide-react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import { confirm, notify } from '../lib/confirm';
import { activeOccupants, occupancyOf, roomStatusOf } from '../lib/rent';
import { useStore } from '../store/useStore';
import { theme } from '../theme/theme';

export default function RoomsScreen({ navigation }) {
  const rooms = useStore((s) => s.rooms);
  const guests = useStore((s) => s.guests);
  const deleteRoom = useStore((s) => s.deleteRoom);

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
      ),
    [rooms]
  );

  const handleDelete = (room) => {
    const occupied = occupancyOf(room, guests);
    if (occupied > 0) {
      notify(
        'Room is occupied',
        `Room ${room.roomNumber} still has ${occupied} active guest${occupied > 1 ? 's' : ''}. Move them out or to another room first.`
      );
      return;
    }
    confirm({
      title: 'Delete room?',
      message: `Room ${room.roomNumber} will be removed permanently.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        const res = deleteRoom(room.id);
        if (!res.ok) notify('Could not delete', res.error);
      },
    });
  };

  const renderRoom = ({ item, index }) => {
    const occupants = activeOccupants(item, guests);
    const status = roomStatusOf(item, guests);
    const isFull = status === 'Full';
    return (
      <Animated.View 
        entering={FadeInDown.delay(index * 50).springify()}
        layout={Layout.springify()}
        style={styles.roomCard} 
        testID={`room-card-${item.roomNumber}`}
      >
        <View style={styles.roomHeader}>
          <View style={styles.roomTitleRow}>
            <Text style={styles.roomNumber}>Room {item.roomNumber}</Text>
            <View style={[styles.badge, isFull ? styles.badgeFull : styles.badgeAvailable]}>
              <Text style={[styles.badgeText, isFull ? styles.badgeTextFull : styles.badgeTextAvailable]}>
                {status}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('RoomForm', { roomId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Edit room ${item.roomNumber}`}
              testID={`edit-room-${item.roomNumber}`}
            >
              <Pencil color={theme.colors.text} size={16} strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButtonError}
              onPress={() => handleDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Delete room ${item.roomNumber}`}
              testID={`delete-room-${item.roomNumber}`}
            >
              <Trash2 color={theme.colors.error} size={16} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roomFooter}>
          <View style={styles.roomDetailsCol}>
            <Text style={styles.detailText}>{item.type} • {item.isAc ? 'AC' : 'Non-AC'}</Text>
            {!!item.advanceDetails && (
              <Text style={styles.advanceText}>Advance: {item.advanceDetails}</Text>
            )}
          </View>
          <View style={styles.occupancyContainer}>
            <Users color={theme.colors.textSecondary} size={16} />
            <Text style={styles.occupancyText}>
              {occupants.length}/{item.capacity}
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
                  {g.fullName}
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

      <FlatList
        data={sortedRooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon={Bed}
            title="No rooms yet"
            message="Add the rooms in your property. Guests are assigned to rooms and beds are tracked automatically."
            actionLabel="Add room"
            onAction={() => navigation.navigate('RoomForm')}
          />
        }
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
