import { FieldPath } from 'firebase-admin/firestore';

import type {
  Reservation,
  ReservationExtraSelection,
  ReservationPaymentMethod,
  ReservationRoomType,
  ReservationStatus,
} from '@/components/landing-reserva/types';
import { getAdminDb } from '@/lib/firebaseAdmin';
import type { Paquete } from '@/types';
import { ROOM_TYPE_CONFIG } from '@/lib/reservas/room-types';

export type ReservationExportPaymentMethodFilter = 'all' | 'mercadopago' | 'admin';

export type ReservationExportFilters = {
  packageId: string;
  date: string;
  statuses: ReservationStatus[];
  paymentMethod: ReservationExportPaymentMethodFilter;
  searchTerm: string;
  createdFrom: string;
  createdTo: string;
  checkoutFrom: string;
  checkoutTo: string;
  checkinFrom: string;
  checkinTo: string;
};

type ReservationExportEntity = Reservation & {
  reservationCode?: string | null;
};

type PaymentMovementType = 'payment' | 'extra' | 'discount' | 'refund' | 'adjustment';

type PaymentSummary = {
  baseTotal: number;
  totalAdjustments: number;
  billedTotal: number;
  totalPaid: number;
  balance: number;
};

export type ExportedReservationRow = {
  numeroReserva: string;
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  telefono: string;
  habitacion: string;
  tipoButaca: string;
  ascenso: string;
  comentarios: string;
  // Legacy columns (se mantienen por compatibilidad histórica con usuarios):
  reservationId: string;
  reservationCode: string;
  packageTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  checkIn: string;
  checkOut: string;
  packageBaseAmount: string;
  currency: string;
  peopleTotal: number;
  adults: number;
  minors: number;
  babies: number;
  seatsCount: number;
  seats: string;
  seatType: string;
  status: string;
  amountPaid: string;
  pendingDebt: string;
  createdAt: string;
};

export type ReservationExportResult = {
  totalReservations: number;
  generatedAt: string;
  csv: string;
};

const PAGE_SIZE = 1000;
const MAX_EXPORT_RESERVATIONS = 50000;
const MAX_EXPORT_PAYMENT_DOCS = 150000;
const DEFAULT_STATUSES: ReservationStatus[] = ['reserved', 'completed', 'pending', 'cancelled'];
const SEAT_CATEGORY_CODES = new Set(['cocheCama', 'panoramicos', 'cafeteras']);

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizeReservationExportFilters(input: URLSearchParams): ReservationExportFilters {
  const statusValues = (input.get('statuses') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is ReservationStatus =>
      value === 'reserved' || value === 'completed' || value === 'pending' || value === 'cancelled'
    );
  const uniqueStatuses = Array.from(new Set(statusValues));

  const normalizeIso = (value: string | null) => {
    const raw = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
  };

  const paymentMethod = normalizeString(input.get('paymentMethod')).toLowerCase();
  const normalizedPaymentMethod: ReservationExportPaymentMethodFilter =
    paymentMethod === 'admin' || paymentMethod === 'mercadopago' ? paymentMethod : 'all';

  return {
    packageId: normalizeString(input.get('packageId')),
    date: normalizeIso(input.get('date')),
    statuses: uniqueStatuses,
    paymentMethod: normalizedPaymentMethod,
    searchTerm: normalizeString(input.get('searchTerm')).toLowerCase(),
    createdFrom: normalizeIso(input.get('createdFrom')),
    createdTo: normalizeIso(input.get('createdTo')),
    checkoutFrom: normalizeIso(input.get('checkoutFrom')),
    checkoutTo: normalizeIso(input.get('checkoutTo')),
    checkinFrom: normalizeIso(input.get('checkinFrom')),
    checkinTo: normalizeIso(input.get('checkinTo')),
  };
}

function parseTimestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if ('seconds' in value) {
      return Number((value as { seconds?: number }).seconds ?? 0) * 1000;
    }
  }
  return 0;
}

function toIsoDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateOnly(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = parseTimestampMs(value);
  if (!ms) return '';
  return toIsoDateOnly(new Date(ms));
}

function formatDateTime(value: unknown): string {
  const ms = parseTimestampMs(value);
  if (!ms) return '';
  const date = new Date(ms);
  const base = toIsoDateOnly(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${base} ${hours}:${minutes}:${seconds}`;
}

function formatMoneyForCsv(amountInCents: number): string {
  return (Math.max(0, Number(amountInCents) || 0) / 100).toFixed(2);
}

function normalizeReservationPaymentMethod(
  reservation: Partial<Reservation> & Record<string, unknown>
): ReservationPaymentMethod {
  const fromSnapshot =
    reservation.pricingSnapshot && typeof reservation.pricingSnapshot === 'object'
      ? String((reservation.pricingSnapshot as { paymentMethod?: unknown }).paymentMethod ?? '').trim().toLowerCase()
      : '';
  const incoming = String(reservation.paymentMethod ?? '').trim().toLowerCase();
  const method = fromSnapshot || incoming;
  if (reservation.createdByAdmin) return 'admin';
  return method === 'admin' ? 'admin' : 'mercadopago';
}

function getNormalizedReservationPackageId(reservation: ReservationExportEntity): string {
  return normalizeString(reservation.packageId ?? reservation.experienceId);
}

export function buildReservationSearchIndex(reservation: ReservationExportEntity): string {
  return [
    reservation.id,
    reservation.reservationCode,
    reservation.customerName,
    reservation.customerEmail,
    reservation.experienceTitle,
    reservation.packageTitle,
    reservation.mercadoPagoPaymentId,
    reservation.referredBy?.vendorName,
    ...(Array.isArray(reservation.selectedSeats) ? reservation.selectedSeats : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function dateBetween(dateIso: string, fromIso: string, toIso: string): boolean {
  if (!dateIso) return !fromIso && !toIso;
  if (fromIso && dateIso < fromIso) return false;
  if (toIso && dateIso > toIso) return false;
  return true;
}

function matchesFilters(
  reservation: ReservationExportEntity,
  filters: ReservationExportFilters,
  checkOutDate: string
): boolean {
  if (filters.packageId && getNormalizedReservationPackageId(reservation) !== filters.packageId) {
    return false;
  }
  if (filters.date && normalizeString(reservation.date) !== filters.date) {
    return false;
  }
  if (filters.statuses.length > 0 && !filters.statuses.includes(reservation.status)) {
    return false;
  }
  if (filters.paymentMethod !== 'all' && normalizeReservationPaymentMethod(reservation) !== filters.paymentMethod) {
    return false;
  }
  if (filters.searchTerm && !buildReservationSearchIndex(reservation).includes(filters.searchTerm)) {
    return false;
  }

  const createdAtDate = formatDateOnly(reservation.createdAt);
  const checkInDate = formatDateOnly(reservation.date);

  if (!dateBetween(createdAtDate, filters.createdFrom, filters.createdTo)) return false;
  if (!dateBetween(checkInDate, filters.checkinFrom, filters.checkinTo)) return false;
  if (!dateBetween(checkOutDate, filters.checkoutFrom, filters.checkoutTo)) return false;

  return true;
}

function resolveCheckOutDate(paquete: Paquete | null | undefined, checkInDate: string): string {
  if (!paquete || !checkInDate || checkInDate === 'sin-fecha' || !Array.isArray(paquete.salidas)) return '';
  const match = paquete.salidas.find((salida) => normalizeString(salida?.fecha) === checkInDate);
  return match?.fechaVuelta && /^\d{4}-\d{2}-\d{2}$/.test(match.fechaVuelta) ? match.fechaVuelta : '';
}

function normalizePaymentMovementType(payment: Record<string, unknown>): PaymentMovementType {
  const value = normalizeString(payment.movementType).toLowerCase();
  if (value === 'extra' || value === 'discount' || value === 'refund' || value === 'adjustment') return value;
  return 'payment';
}

export function summarizeReservationPayments(
  baseTotal: number,
  payments: Array<Record<string, unknown>>
): PaymentSummary {
  let totalPaid = 0;
  let totalAdjustments = 0;

  for (const payment of payments) {
    const movementType = normalizePaymentMovementType(payment);
    const amount = Math.max(0, Number(payment.amount ?? 0));
    if (movementType === 'payment') totalPaid += amount;
    if (movementType === 'refund') totalPaid -= amount;
    if (movementType === 'extra' || movementType === 'adjustment') totalAdjustments += amount;
    if (movementType === 'discount') totalAdjustments -= amount;
  }

  const billedTotal = Math.max(0, Math.round(baseTotal + totalAdjustments));
  const balance = billedTotal - totalPaid;
  return {
    baseTotal: Math.max(0, Math.round(baseTotal)),
    totalAdjustments,
    billedTotal,
    totalPaid: Math.max(0, Math.round(totalPaid)),
    balance: Math.round(balance),
  };
}

function resolveSeatType(selectedExtras: ReservationExtraSelection[] | null | undefined, selectedSeats: string[]): string {
  const labels = Array.from(
    new Set(
      (selectedExtras ?? [])
        .filter((extra) => {
          const code = normalizeString(extra.code);
          const categoryCode = normalizeString(extra.categoryCode);
          const source = normalizeString(extra.source);
          return SEAT_CATEGORY_CODES.has(code) || SEAT_CATEGORY_CODES.has(categoryCode) || source === 'seatcategory';
        })
        .map((extra) => normalizeString(extra.label))
        .filter(Boolean)
    )
  );

  if (labels.length > 0) return labels.join(' | ');
  if (selectedSeats.length > 0) return 'Estándar';
  return '';
}

function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = normalizeString(fullName);
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getRoomSelectionSummary(roomSelection: unknown): string {
  if (!Array.isArray(roomSelection)) return '';
  const parts: string[] = [];
  for (const entry of roomSelection) {
    if (!entry || typeof entry !== 'object') continue;
    const typed = entry as { roomType?: unknown; quantity?: unknown };
    const label =
      typeof typed.roomType === 'string'
        ? ROOM_TYPE_CONFIG[typed.roomType as ReservationRoomType]?.label || typed.roomType
        : '';
    const qty = typeof typed.quantity === 'number' ? typed.quantity : 1;
    if (label) parts.push(qty > 1 ? `${qty}x ${label}` : label);
  }
  return parts.join(' | ');
}

function resolveHabitacionLabel(reservation: ReservationExportEntity): string {
  const anyRes = reservation as unknown as Record<string, unknown>;
  const roomTypeRaw = normalizeString(String(anyRes.roomType ?? ''));
  if (roomTypeRaw) {
    if (roomTypeRaw === 'full-day') return 'Full Day';
    const configLabel = ROOM_TYPE_CONFIG[roomTypeRaw as ReservationRoomType]?.label;
    if (configLabel) return configLabel;
  }
  const fromSelection = getRoomSelectionSummary(anyRes.roomSelection);
  if (fromSelection) return fromSelection;
  if (roomTypeRaw) return roomTypeRaw;
  return '';
}

function resolveAscensoLabel(reservation: ReservationExportEntity): string {
  const anyRes = reservation as unknown as Record<string, unknown>;
  const pickupPoint = normalizeString(String(anyRes.pickupPoint ?? ''));
  const pickupPointTime = normalizeString(String(anyRes.pickupPointTime ?? ''));
  if (!pickupPoint && !pickupPointTime) return '';
  if (pickupPoint && pickupPointTime) return `${pickupPoint} · ${pickupPointTime}`;
  return pickupPoint || pickupPointTime || '';
}

function inferAdultCount(reservation: ReservationExportEntity): number {
  if (typeof reservation.peopleAdults === 'number' && reservation.peopleAdults >= 0) {
    return reservation.peopleAdults;
  }
  if (Array.isArray(reservation.passengerDetails) && reservation.passengerDetails.length > 0) {
    const adults = reservation.passengerDetails.filter((passenger) => passenger.travelerType === 'adult').length;
    if (adults > 0) return adults;
  }
  const minors = typeof reservation.peopleMinors === 'number' && reservation.peopleMinors >= 0 ? reservation.peopleMinors : 0;
  return Math.max(0, Number(reservation.people ?? 0) - minors);
}

function inferMinorCount(reservation: ReservationExportEntity): number {
  if (typeof reservation.peopleMinors === 'number' && reservation.peopleMinors >= 0) {
    return reservation.peopleMinors;
  }
  if (Array.isArray(reservation.passengerDetails) && reservation.passengerDetails.length > 0) {
    return reservation.passengerDetails.filter((passenger) => passenger.travelerType === 'minor').length;
  }
  return 0;
}

function buildExportRow(input: {
  reservation: ReservationExportEntity;
  paquete: Paquete | null | undefined;
  paymentSummary: PaymentSummary;
}): ExportedReservationRow {
  const { reservation, paquete, paymentSummary } = input;
  const selectedSeats = Array.isArray(reservation.selectedSeats)
    ? reservation.selectedSeats.map((seat) => normalizeString(seat)).filter(Boolean)
    : [];
  const currency = normalizeString(reservation.currency || 'ARS').toUpperCase() || 'ARS';
  const checkIn = normalizeString(reservation.date) === 'sin-fecha' ? '' : formatDateOnly(reservation.date);
  const checkOut = resolveCheckOutDate(paquete, checkIn);
  const adults = inferAdultCount(reservation);
  const minors = inferMinorCount(reservation);
  const peopleTotal = Math.max(0, Number(reservation.people ?? adults + minors) || 0);
  const packageBaseAmount =
    typeof reservation.pricingBaseUnitAmount === 'number' && reservation.pricingBaseUnitAmount > 0
      ? reservation.pricingBaseUnitAmount * Math.max(1, peopleTotal)
      : typeof reservation.baseSubtotalAmount === 'number' && reservation.baseSubtotalAmount > 0
        ? reservation.baseSubtotalAmount
        : Math.max(0, Number(reservation.amountTotal ?? 0) - Number(reservation.extrasTotalAmount ?? 0));

  const anyRes = reservation as unknown as Record<string, unknown>;
  const numeroReserva = normalizeString(reservation.reservationCode || reservation.id);
  const { firstName: explicitFirstName, lastName: explicitLastName } = splitCustomerName('');
  const nombreRaw = normalizeString(String(anyRes.customerFirstName ?? explicitFirstName ?? ''));
  const apellidoRaw = normalizeString(String(anyRes.customerLastName ?? explicitLastName ?? ''));
  const nameSplit = splitCustomerName(normalizeString(reservation.customerName));
  const nombre = nombreRaw || nameSplit.firstName;
  const apellido = apellidoRaw || nameSplit.lastName;
  const dni = normalizeString(String(anyRes.customerDocument ?? ''));
  const fechaNacimiento = formatDateOnly(anyRes.customerBirthDate);
  const telefono = normalizeString(reservation.customerPhone);
  const habitacion = resolveHabitacionLabel(reservation);
  const tipoButaca = resolveSeatType(reservation.selectedExtras, selectedSeats);
  const ascenso = resolveAscensoLabel(reservation);
  const comentarios = normalizeString(String(anyRes.customerComments ?? ''));

  return {
    numeroReserva,
    nombre,
    apellido,
    dni,
    fechaNacimiento,
    telefono,
    habitacion,
    tipoButaca,
    ascenso,
    comentarios,
    reservationId: reservation.id,
    reservationCode: normalizeString(reservation.reservationCode || reservation.id),
    packageTitle:
      normalizeString(reservation.packageTitle) ||
      normalizeString(reservation.experienceTitle) ||
      normalizeString(paquete?.titulo),
    customerName: normalizeString(reservation.customerName),
    customerEmail: normalizeString(reservation.customerEmail),
    customerPhone: normalizeString(reservation.customerPhone),
    checkIn,
    checkOut,
    packageBaseAmount: formatMoneyForCsv(packageBaseAmount),
    currency,
    peopleTotal,
    adults,
    minors,
    babies: 0,
    seatsCount: selectedSeats.length,
    seats: selectedSeats.join(' | '),
    seatType: resolveSeatType(reservation.selectedExtras, selectedSeats),
    status: reservation.status,
    amountPaid: formatMoneyForCsv(paymentSummary.totalPaid),
    pendingDebt: formatMoneyForCsv(Math.max(0, paymentSummary.balance)),
    createdAt: formatDateTime(reservation.createdAt),
  };
}

function escapeCsvCell(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : value;
  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildReservationsCsv(rows: ExportedReservationRow[]): string {
  const headers = [
    'Número reserva',
    'nombre',
    'apellido',
    'dni',
    'fecha de nacimiento',
    'número de teléfono',
    'habitacion',
    'tipo de butaca',
    'ascenso',
    'comentarios',
    'ID Reserva',
    'Codigo Reserva',
    'Paquete',
    'Cliente',
    'Email',
    'Telefono',
    'Check-in',
    'Check-out',
    'Precio Original Paquete',
    'Moneda',
    'Personas Totales',
    'Adultos',
    'Menores',
    'Bebes',
    'Cantidad Butacas',
    'Butacas',
    'Tipo Butaca',
    'Estado Reserva',
    'Monto Total Pagado',
    'Deuda Pendiente',
    'Fecha Creacion',
  ];

  const lines = rows.map((row) =>
    [
      row.numeroReserva,
      row.nombre,
      row.apellido,
      row.dni,
      row.fechaNacimiento,
      row.telefono,
      row.habitacion,
      row.tipoButaca,
      row.ascenso,
      row.comentarios,
      row.reservationId,
      row.reservationCode,
      row.packageTitle,
      row.customerName,
      row.customerEmail,
      row.customerPhone,
      row.checkIn,
      row.checkOut,
      row.packageBaseAmount,
      row.currency,
      row.peopleTotal,
      row.adults,
      row.minors,
      row.babies,
      row.seatsCount,
      row.seats,
      row.seatType,
      row.status,
      row.amountPaid,
      row.pendingDebt,
      row.createdAt,
    ]
      .map((value) => escapeCsvCell(value))
      .join(',')
  );

  return `\uFEFF${headers.map((header) => escapeCsvCell(header)).join(',')}\n${lines.join('\n')}`;
}

async function fetchPackagesMap() {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error('Firebase Admin no está disponible para exportar reservas.');

  const snapshot = await adminDb.collection('paquetes').get();
  const map = new Map<string, Paquete>();
  snapshot.docs.forEach((docSnap) => {
    map.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as Omit<Paquete, 'id'>) } as Paquete);
  });
  return map;
}

async function fetchReservationsPage(
  filters: ReservationExportFilters,
  startAfterCreatedAt?: unknown,
  startAfterId?: string
) {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error('Firebase Admin no está disponible para exportar reservas.');

  let query = adminDb.collection('reservas') as FirebaseFirestore.Query;
  if (filters.statuses.length === 1) {
    query = query.where('status', '==', filters.statuses[0]);
  } else if (filters.statuses.length > 1 && filters.statuses.length <= 10) {
    query = query.where('status', 'in', filters.statuses);
  }
  if (filters.date) {
    query = query.where('date', '==', filters.date);
  }
  query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PAGE_SIZE);

  if (startAfterCreatedAt && startAfterId) {
    query = query.startAfter(startAfterCreatedAt, startAfterId);
  }

  return query.get();
}

async function fetchReservationsMatchingFilters(filters: ReservationExportFilters, packageMap: Map<string, Paquete>) {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error('Firebase Admin no está disponible para exportar reservas.');

  const matched: ReservationExportEntity[] = [];
  let lastCreatedAt: unknown;
  let lastId = '';
  let usedFallback = false;

  try {
    while (true) {
      const snapshot = await fetchReservationsPage(filters, lastCreatedAt, lastId);
      if (snapshot.empty) break;

      snapshot.docs.forEach((docSnap) => {
        const reservation = { id: docSnap.id, ...(docSnap.data() as Omit<ReservationExportEntity, 'id'>) };
        const paquete = packageMap.get(getNormalizedReservationPackageId(reservation));
        const checkOutDate = resolveCheckOutDate(paquete, formatDateOnly(reservation.date));
        if (matchesFilters(reservation, filters, checkOutDate)) {
          matched.push(reservation);
        }
      });

      if (matched.length > MAX_EXPORT_RESERVATIONS) {
        throw new Error(
          `La exportación supera el límite operativo de ${MAX_EXPORT_RESERVATIONS.toLocaleString('es-AR')} reservas. Ajustá los filtros e intentá nuevamente.`
        );
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      lastCreatedAt = lastDoc.get('createdAt');
      lastId = lastDoc.id;
      if (snapshot.size < PAGE_SIZE) break;
    }
  } catch (error) {
    usedFallback = true;
    const message = error instanceof Error ? error.message : '';
    const missingIndex = /index/i.test(message);
    if (!missingIndex) throw error;
  }

  if (usedFallback) {
    let query = adminDb.collection('reservas') as FirebaseFirestore.Query;
    if (filters.statuses.length === 1) {
      query = query.where('status', '==', filters.statuses[0]);
    } else if (filters.statuses.length > 1 && filters.statuses.length <= 10) {
      query = query.where('status', 'in', filters.statuses);
    }
    if (filters.date) {
      query = query.where('date', '==', filters.date);
    }

    const snapshot = await query.get();
    snapshot.docs.forEach((docSnap) => {
      const reservation = { id: docSnap.id, ...(docSnap.data() as Omit<ReservationExportEntity, 'id'>) };
      const paquete = packageMap.get(getNormalizedReservationPackageId(reservation));
      const checkOutDate = resolveCheckOutDate(paquete, formatDateOnly(reservation.date));
      if (matchesFilters(reservation, filters, checkOutDate)) {
        matched.push(reservation);
      }
    });
  }

  return matched;
}

async function fetchPaymentSummaryMap(reservationIds: string[]) {
  const adminDb = getAdminDb();
  if (!adminDb) throw new Error('Firebase Admin no está disponible para exportar reservas.');

  const targetIds = new Set(reservationIds);
  const paymentMap = new Map<string, Array<Record<string, unknown>>>();
  let lastDocId = '';
  let scannedDocs = 0;

  while (true) {
    let query = adminDb
      .collectionGroup('payments')
      .orderBy(FieldPath.documentId(), 'asc')
      .limit(PAGE_SIZE) as FirebaseFirestore.Query;

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    snapshot.docs.forEach((docSnap) => {
      scannedDocs += 1;
      const reservationId = docSnap.ref.parent.parent?.id ?? '';
      if (!reservationId || !targetIds.has(reservationId)) return;
      const bucket = paymentMap.get(reservationId) ?? [];
      bucket.push(docSnap.data() as Record<string, unknown>);
      paymentMap.set(reservationId, bucket);
    });

    if (scannedDocs > MAX_EXPORT_PAYMENT_DOCS) {
      throw new Error(
        `La exportación detectó más de ${MAX_EXPORT_PAYMENT_DOCS.toLocaleString('es-AR')} movimientos financieros. Aplicá filtros más específicos e intentá nuevamente.`
      );
    }

    lastDocId = snapshot.docs[snapshot.docs.length - 1].id;
    if (snapshot.size < PAGE_SIZE) break;
  }

  return paymentMap;
}

export async function exportReservationsCsv(filters: ReservationExportFilters): Promise<ReservationExportResult> {
  const effectiveFilters = {
    ...filters,
    statuses: Array.from(new Set(filters.statuses)).filter(
      (status): status is ReservationStatus =>
        status === 'reserved' || status === 'completed' || status === 'pending' || status === 'cancelled'
    ),
  };

  const normalizedFilters =
    effectiveFilters.statuses.length === 0
      ? { ...effectiveFilters, statuses: DEFAULT_STATUSES }
      : effectiveFilters;

  const packageMap = await fetchPackagesMap();
  const reservations = await fetchReservationsMatchingFilters(normalizedFilters, packageMap);

  if (reservations.length === 0) {
    throw new Error('No hay reservas para exportar con los filtros actuales.');
  }

  const paymentSummaryByReservation = await fetchPaymentSummaryMap(reservations.map((reservation) => reservation.id));
  const rows = reservations.map((reservation) => {
    const paquete = packageMap.get(getNormalizedReservationPackageId(reservation));
    const payments = paymentSummaryByReservation.get(reservation.id) ?? [];
    const paymentSummary = summarizeReservationPayments(Number(reservation.amountTotal ?? 0), payments);
    return buildExportRow({ reservation, paquete, paymentSummary });
  });

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return {
    totalReservations: rows.length,
    generatedAt: new Date().toISOString(),
    csv: buildReservationsCsv(rows),
  };
}
