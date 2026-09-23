import type { Paquete, ReservationRoomSelection, ReservationRoomType, RoomTypeDefinition } from '@/types';

export const ROOM_TYPE_CONFIG: Record<string, { label: string; maxOccupancy: number; description: string }> = {
  simple: {
    label: 'Habitación Simple',
    maxOccupancy: 1,
    description: '1 pasajero - habitación individual',
  },
  twin: {
    label: 'Doble Twin',
    maxOccupancy: 2,
    description: '2 pasajeros – 2 camas individuales',
  },
  matrimonial: {
    label: 'Matrimonial',
    maxOccupancy: 2,
    description: '2 pasajeros – 1 cama matrimonial',
  },
  'triple-twin': {
    label: 'Triple Twin',
    maxOccupancy: 3,
    description: '3 pasajeros – 3 camas individuales',
  },
  'matrimonial-plus-one-twin': {
    label: 'Matrimonial + 1 cama Twin',
    maxOccupancy: 3,
    description: '3 pasajeros – 1 cama matrimonial + 1 cama individual',
  },
  'matrimonial-plus-twin': {
    label: 'Matrimonial + 2 camas Twin',
    maxOccupancy: 4,
    description: '4 pasajeros – 1 cama matrimonial + 2 camas individuales',
  },
  'quadruple-twin': {
    label: 'Cuádruple Twin',
    maxOccupancy: 4,
    description: '4 pasajeros – 4 camas individuales',
  },
  'full-day': {
    label: 'Full day',
    maxOccupancy: 50,
    description: 'Sin alojamiento. Se mantiene disponible para reservas sin pernocte o grupos amplios.',
  },
};

export const DEFAULT_ROOM_TYPE_DEFINITIONS: RoomTypeDefinition[] = Object.entries(ROOM_TYPE_CONFIG).map(
  ([id, config], order) => ({
    id,
    label: config.label,
    description: config.description,
    isFullDay: id === 'full-day',
    active: true,
    order,
  })
);

export const ROOM_TYPE_OPTIONS = DEFAULT_ROOM_TYPE_DEFINITIONS.map((option) => ({
  value: option.id,
  label: option.label,
  description: option.description,
}));

export function getPackageRoomTypes(
  paquete: Pick<Paquete, 'roomTypes' | 'roomTypeOptions'> | null | undefined
): ReservationRoomType[] {
  if (!Array.isArray(paquete?.roomTypes)) return [];
  return Array.from(new Set(paquete.roomTypes)).filter(
    (roomType): roomType is ReservationRoomType => {
      if (typeof roomType !== 'string' || roomType.trim().length === 0) return false;
      const definition = paquete.roomTypeOptions?.find((option) => option.id === roomType);
      return definition?.active !== false;
    }
  );
}

export function getPackageRoomTypeOptions(
  paquete: Pick<Paquete, 'roomTypes' | 'roomTypeOptions'> | null | undefined
): RoomTypeDefinition[] {
  const selectedIds = getPackageRoomTypes(paquete);
  const snapshots = Array.isArray(paquete?.roomTypeOptions) ? paquete.roomTypeOptions : [];
  return selectedIds.map((id) => {
    const snapshot = snapshots.find((option) => option.id === id);
    const legacy = ROOM_TYPE_CONFIG[id];
    return snapshot ?? {
      id,
      label: legacy?.label ?? id,
      description: legacy?.description ?? '',
      isFullDay: id === 'full-day',
      active: true,
    };
  });
}

export function getPackageRoomTypeLabel(
  paquete: Pick<Paquete, 'roomTypes' | 'roomTypeOptions'> | null | undefined,
  roomType: ReservationRoomType | null | undefined
): string {
  if (!roomType) return 'Sin definir';
  return getPackageRoomTypeOptions(paquete).find((option) => option.id === roomType)?.label ?? roomType;
}

export function isPackageRoomTypeAvailable(
  paquete: Pick<Paquete, 'roomTypes' | 'roomTypeOptions'> | null | undefined,
  roomType: ReservationRoomType | null | undefined
): boolean {
  if (!roomType) return getPackageRoomTypes(paquete).length === 0;
  return getPackageRoomTypes(paquete).includes(roomType);
}

export function getRoomTypeLabel(roomType: ReservationRoomType | null | undefined): string {
  if (!roomType) return 'Sin definir';
  return ROOM_TYPE_CONFIG[roomType]?.label ?? roomType;
}

export function getRoomTypeOptionLabel(roomType: ReservationRoomType | null | undefined): string {
  if (!roomType) return 'Sin definir';
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config) return String(roomType);
  return `${config.label}: ${config.description}`;
}

export function normalizeRoomSelection(
  selection: ReservationRoomSelection[] | null | undefined
): ReservationRoomSelection[] {
  if (!Array.isArray(selection)) return [];
  return selection
    .map((item) => ({
      roomType: item?.roomType as ReservationRoomType,
      quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0)),
    }))
    .filter((item) => item.quantity > 0 && typeof item.roomType === 'string' && item.roomType.trim().length > 0);
}

export function deriveLegacyRoomTypeFromSelection(
  selection: ReservationRoomSelection[] | null | undefined
): ReservationRoomType | null {
  const normalized = normalizeRoomSelection(selection);
  if (normalized.length !== 1) return null;
  const [item] = normalized;
  return item.quantity === 1 ? item.roomType : null;
}

export function getRoomSelectionSummary(
  selection: ReservationRoomSelection[] | null | undefined
): string {
  const normalized = normalizeRoomSelection(selection);
  if (!normalized.length) return 'Sin definir';
  return normalized
    .map((item) => {
      const config = ROOM_TYPE_CONFIG[item.roomType];
      const label = config?.label ?? item.roomType;
      return `${item.quantity} ${item.quantity === 1 ? 'habitación' : 'habitaciones'} ${label}`;
    })
    .join(' + ');
}

