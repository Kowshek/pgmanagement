// Indian-rupee and date formatting helpers.
// Manual lakh grouping (12,34,567) so output is identical on Hermes, web and jest,
// independent of which Intl locales the engine ships.

export function formatINR(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n));
  if (digits.length <= 3) return `${sign}₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}₹${rest},${last3}`;
}

const ROOM_TYPE_LABELS = {
  single: 'Single',
  double: '2 Sharing',
  triple: '3 Sharing',
  quad: '4 Sharing',
};

// Room.room_type is a fixed backend enum (single/double/triple/quad/custom);
// "custom" rooms carry their own free-text label separately.
export function roomTypeLabel(room) {
  if (room.room_type === 'custom') return room.custom_type_label || 'Custom';
  return ROOM_TYPE_LABELS[room.room_type] || room.room_type;
}

export function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
