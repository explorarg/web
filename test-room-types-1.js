
// Test script to verify room type functions
// Copy-pasted from lib/reservas/room-types.ts
const RESERVATION_ROOM_TYPE_VALUES = [
  'twin',
  'matrimonial',
  'triple-twin',
  'matrimonial-plus-one-twin',
  'matrimonial-plus-twin',
  'quadruple-twin',
  'full-day',
];

const ROOM_TYPE_CONFIG = {
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

const ROOM_TYPE_OPTIONS = Object.keys(ROOM_TYPE_CONFIG).map((value) => ({
  value,
  ...ROOM_TYPE_CONFIG[value],
}));

function getRoomTypeOptionLabel(roomType) {
  if (!roomType) return 'Sin definir';
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config) return String(roomType);
  return `${config.label}: ${config.description}`;
}

function isRoomTypeCompatible(roomType, people) {
  if (!roomType) return false;
  const normalizedPeople = Math.max(1, Math.floor(Number(people) || 0));
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config) return false;
  if (roomType === 'full-day') {
    return normalizedPeople <= config.maxOccupancy;
  }
  return normalizedPeople === config.maxOccupancy;
}

function getCompatibleRoomTypes(people) {
  const normalizedPeople = Math.max(1, Math.floor(Number(people) || 0));
  return ROOM_TYPE_OPTIONS.filter((option) => isRoomTypeCompatible(option.value, normalizedPeople)).map(
    (option) => option.value
  );
}

function getPreferredRoomType(people, currentRoomType) {
  if (currentRoomType && isRoomTypeCompatible(currentRoomType, people)) return currentRoomType;
  const compatible = getCompatibleRoomTypes(people);
  return compatible[0] ?? null;
}

console.log('Testing people=1:');
console.log('Compatible:', getCompatibleRoomTypes(1));
console.log('Preferred:', getPreferredRoomType(1));
console.log('Option labels:', getCompatibleRoomTypes(1).map(rt => getRoomTypeOptionLabel(rt)));
