import type { Timestamp } from 'firebase/firestore';
import type { DepartureSeat, SeatLayoutSeat, SeatLayoutSpecialCell, SeatLayoutTemplate, SeatStatus } from '@/types';

export type SeatReservationSeatState = {
  status: SeatStatus;
  holdId?: string | null;
  cartId?: string | null;
  cartItemId?: string | null;
  orderId?: string | null;
  reservationId?: string | null;
  expiresAt?: Timestamp | Date | null;
  blockedBy?: 'default' | 'admin' | null;
  blockReason?: string | null;
  updatedAt?: Timestamp | Date | null;
};

export type SeatReservationDoc = {
  id: string;
  packageId: string;
  date: string;
  seatLayoutId: string;
  seats: Record<string, SeatReservationSeatState>;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

export function getSeatDepartureId(packageId: string, date: string): string {
  return `${packageId}_${date}`;
}

export function getTemplateSeatById(template: SeatLayoutTemplate): Map<string, SeatLayoutSeat> {
  const map = new Map<string, SeatLayoutSeat>();
  for (const seat of template.seats ?? []) {
    map.set(seat.seatId, seat);
  }
  return map;
}

export function seatIdsFromLabels(template: SeatLayoutTemplate, labels: string[]): string[] {
  const normalized = labels.map((s) => {
    const raw = String(s).trim();
    // Extraer etiqueta si viene con formato "Etiqueta (Fila X, Col Y)"
    const match = raw.match(/^([^(]+)\s\(/);
    return match ? match[1].trim() : raw;
  }).filter(Boolean);
  
  if (normalized.length === 0) return [];
  const seatByLabel = new Map<string, string>();
  for (const seat of template.seats ?? []) {
    const label = String(seat.label ?? '').trim();
    if (!label) continue;
    if (!seatByLabel.has(label)) seatByLabel.set(label, seat.seatId);
  }
  return normalized.map((label) => seatByLabel.get(label) || '').filter(Boolean);
}

export function seatLabelsFromIds(template: SeatLayoutTemplate, seatIds: string[]): string[] {
  const normalized = seatIds.map((s) => String(s).trim()).filter(Boolean);
  if (normalized.length === 0) return [];
  const seatById = getTemplateSeatById(template);
  return normalized
    .map((id) => seatById.get(id)?.label ?? '')
    .map((s) => String(s).trim())
    .filter(Boolean);
}

export function getSpecialCellsIndex(template: SeatLayoutTemplate): Map<string, SeatLayoutSpecialCell> {
  const map = new Map<string, SeatLayoutSpecialCell>();
  for (const cell of template.specialCells ?? []) {
    map.set(`${cell.floor}:${cell.row}:${cell.col}`, cell);
  }
  return map;
}

export function isSeatSelectableStatus(status: SeatStatus): boolean {
  return status === 'available';
}

export function buildBaseSeatReservationSeats(template: SeatLayoutTemplate): Record<string, SeatReservationSeatState> {
  const seats: Record<string, SeatReservationSeatState> = {};
  for (const seat of template.seats ?? []) {
    const isDisabled = Boolean(seat.disabled);
    const isBlocked = Boolean(seat.defaultBlocked);
    const status: SeatStatus = isDisabled ? 'disabled' : isBlocked ? 'blocked' : 'available';
    seats[seat.seatId] = {
      status,
      blockedBy: isBlocked ? 'default' : null,
    };
  }
  return seats;
}

export function toDepartureSeats(template: SeatLayoutTemplate, reservation: SeatReservationDoc | null): DepartureSeat[] {
  const out: DepartureSeat[] = [];
  const states = reservation?.seats ?? {};
  const nowMs = Date.now();

  const toMs = (v: any): number => {
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
  };

  for (const seat of template.seats ?? []) {
    const baseStatus: DepartureSeat['baseStatus'] = seat.disabled
      ? 'disabled'
      : seat.defaultBlocked
        ? 'blocked'
        : 'available';
    const state = states[seat.seatId];
    let status: SeatStatus = state?.status ?? (baseStatus === 'disabled' ? 'disabled' : baseStatus === 'blocked' ? 'blocked' : 'available');

    // Limpieza dinámica: si está 'held' pero el tiempo expiró, mostrar como disponible
    if (status === 'held') {
      const expMs = toMs(state?.expiresAt);
      if (expMs > 0 && expMs <= nowMs) {
        status = baseStatus === 'blocked' ? 'blocked' : 'available';
      }
    }

    out.push({
      id: seat.seatId,
      seatId: seat.seatId,
      label: seat.label,
      floor: seat.floor,
      row: seat.row,
      col: seat.col,
      category: seat.category ?? null,
      baseStatus,
      status,
      holdId: state?.holdId ?? null,
      cartId: state?.cartId ?? null,
      cartItemId: state?.cartItemId ?? null,
      orderId: state?.orderId ?? null,
      reservationId: state?.reservationId ?? null,
      expiresAt: state?.expiresAt ?? null,
      blockedBy: state?.blockedBy ?? (baseStatus === 'blocked' ? 'default' : null),
      blockReason: (state as any)?.blockReason ?? null,
      updatedAt: state?.updatedAt ?? undefined,
    });
  }
  return out;
}
