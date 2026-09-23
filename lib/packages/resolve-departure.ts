import type {
  CartCurrency,
  Paquete,
  PickupPointItem,
  ReservationExtraCode,
  ReservationExtraSelection,
  Salida,
  SeatCategoryCode,
  SeatLayoutTemplate,
} from '@/types';
import { SEAT_CATEGORY_CODES, getSeatCategoryPricingFromTemplate } from '@/lib/seats/categories';
import {
  getSinglePassengerSurchargeAmount,
  getSinglePassengerSurchargeSelection,
  getSinglePassengerSurchargeSummary,
  isSinglePassengerSurchargeExtra,
} from '@/lib/pricing/single-passenger-surcharge';
import { getPackageRoomTypes } from '@/lib/reservas/room-types';

export {
  getSinglePassengerSurchargeAmount,
  getSinglePassengerSurchargeSelection,
  getSinglePassengerSurchargeSummary,
  isSinglePassengerSurchargeExtra,
} from '@/lib/pricing/single-passenger-surcharge';

export type ResolvedDepartureConfig = {
  date: string;
  isNoDate: boolean;
  exists: boolean;
  enabled: boolean;
  salida: Salida | null;
  isFullDay: boolean;
  /** Precio base (por persona) en centavos. Usado para reglas por porcentaje. */
  baseUnitAmount: number;
  unitAmount: number;
  currency: CartCurrency | null;
  displayCurrency: 'USD' | 'ARS' | 'EUR' | null;
  baseCapacity: number;
  maxPeople: number;
  seatsEnabled: boolean;
  seatLayoutId: string | null;
  pickupPoints: string[];
  pickupPointsConfig: PickupPointItem[];
};

export type ReservationPricingMode = 'fixed' | 'percent';

export type ReservationPricingConfig = {
  mode: ReservationPricingMode;
  /**
   * Si mode = fixed, este es el precio unitario (por persona) a cobrar como reserva (en centavos).
   * Si no está, se usa bookingConfig.depositAmount (si existe) o el precio base del paquete/salida.
   */
  fixedUnitAmount?: number | null;
  /**
   * Regla cuando la reserva es para 1 persona (en porcentaje 0-100).
   */
  single?: { adultPercent: number; minorPercent?: number | null } | null;
  /**
   * Regla cuando la reserva es para 2+ personas (en porcentaje 0-100).
   */
  group?: { adultPercent: number; minorPercent?: number | null } | null;
  /** Si true, se permite override de % por adultos/menores desde el carrito/admin. */
  allowCustomPercent?: boolean | null;
};

export type ComputedReservationPricing = {
  pricingMode: ReservationPricingMode;
  currency: CartCurrency | null;
  displayCurrency: 'USD' | 'ARS' | 'EUR' | null;
  baseUnitAmount: number;
  people: number;
  peopleAdults: number | null;
  peopleMinors: number | null;
  depositPercentAdults: number | null;
  depositPercentMinors: number | null;
  unitAmountAdults: number;
  unitAmountMinors: number;
  /** Compat: unitAmount se mantiene como "unitario adultos". */
  unitAmount: number;
  baseSubtotalAmount: number;
  extrasTotalAmount: number;
  subtotalAmount: number;
};

const EXTRA_LABELS: Record<ReservationExtraCode, string> = {
  cocheCama: 'Cama',
  panoramicos: 'Panorámica',
  cafeteras: 'Cafetería',
  pickupPoint: 'Lugar de ascenso',
  administrativeFee: 'Gastos Administrativos',
  singlePassengerSurcharge: 'Recargo por pasajero individual',
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStoredMoney(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function toAmountCents(value: unknown): number {
  const normalized = normalizeStoredMoney(value);
  if (normalized <= 0) return 0;
  return Math.round(normalized * 100);
}

function normalizeDate(value: string): string {
  const next = normalizeText(value);
  return next || 'sin-fecha';
}

function normalizePickupPoints(paquete: Paquete): string[] {
  return getPickupPointItems(paquete).map((item) => item.label);
}

function normalizePickupPointItem(raw: any): PickupPointItem | null {
  const label = String(raw?.label ?? '').trim();
  if (!label) return null;
  return {
    label,
    time: String(raw?.time ?? '').trim(),
    hasExtra: Boolean(raw?.hasExtra),
    extraAmount: typeof raw?.extraAmount === 'number' ? Math.max(0, Number(raw.extraAmount) || 0) : 0,
  };
}

export function getPickupPointItems(paquete: Paquete): PickupPointItem[] {
  const config = (paquete as any).pickupPointsConfig;
  if (Array.isArray(config)) {
    return config.map((item: any) => normalizePickupPointItem(item)).filter(Boolean) as PickupPointItem[];
  }
  if (!Array.isArray(paquete.pickupPoints)) return [];
  return paquete.pickupPoints
    .map((point) => normalizePickupPointItem({ label: point, time: '', hasExtra: false, extraAmount: 0 }))
    .filter(Boolean) as PickupPointItem[];
}

export function getPickupPointExtraSelection(paquete: Paquete, pickupPoint: string): ReservationExtraSelection | null {
  const point = getPickupPointItems(paquete).find((item) => item.label === pickupPoint);
  if (!point || !point.hasExtra || !point.extraAmount || point.extraAmount <= 0) return null;
  return {
    code: 'pickupPoint',
    label: `${EXTRA_LABELS.pickupPoint}: ${point.label}`,
    amount: toAmountCents(point.extraAmount),
    source: 'pickupPoint',
    scope: 'per_person',
  };
}

export function getAdministrativeFeeExtraSelection(paquete: Paquete): ReservationExtraSelection | null {
  const rawAmount =
    typeof (paquete as any)?.gastosAdministrativos === 'number'
      ? Number((paquete as any).gastosAdministrativos)
      : typeof (paquete as any)?.precioDescuentoPrimerosCupos === 'number'
        ? Number((paquete as any).precioDescuentoPrimerosCupos)
        : 0;
  const amount = toAmountCents(rawAmount);
  if (amount <= 0) return null;
  return {
    code: 'administrativeFee',
    label: EXTRA_LABELS.administrativeFee,
    amount,
    source: 'package',
    scope: 'per_person',
  };
}

export function getSeatLayoutExtraOptions(
  template: Pick<SeatLayoutTemplate, 'amenities'> | null | undefined
): ReservationExtraSelection[] {
  const options: ReservationExtraSelection[] = [];
  const pricing = getSeatCategoryPricingFromTemplate(template as Pick<SeatLayoutTemplate, 'categoryPricing' | 'amenities'> | null | undefined);
  SEAT_CATEGORY_CODES.forEach((code) => {
    const amount = typeof (pricing as any)?.[code]?.amount === 'number' ? Math.max(0, Number((pricing as any)[code].amount) || 0) : 0;
    if (!amount || amount <= 0) return;
    options.push({
      code,
      label: EXTRA_LABELS[code],
      amount: toAmountCents(amount),
      quantity: 1,
      categoryCode: code,
      source: 'seatCategory',
      scope: 'per_selected_seat',
    });
  });
  return options;
}

function normalizeSeatLookupValue(value: string): string {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^([^(|]+)\s*(?:\(|$)/);
  return (match ? match[1] : raw).trim();
}

function getSeatCategoryExtraSelections(params: {
  selectedSeats?: string[] | null;
  seatLayoutTemplate?: Pick<SeatLayoutTemplate, 'seats' | 'categoryPricing' | 'amenities'> | null;
}): ReservationExtraSelection[] {
  const template = params.seatLayoutTemplate;
  const selectedSeats = Array.isArray(params.selectedSeats) ? params.selectedSeats.map((item) => String(item).trim()).filter(Boolean) : [];
  if (!template || !Array.isArray(template.seats) || selectedSeats.length === 0) return [];

  const pricing = getSeatCategoryPricingFromTemplate(template);
  const seatBySeatId = new Map<string, (typeof template.seats)[number]>();
  const seatByLabel = new Map<string, (typeof template.seats)[number]>();
  for (const seat of template.seats) {
    if (seat?.seatId) seatBySeatId.set(String(seat.seatId).trim(), seat);
    if (seat?.label) seatByLabel.set(String(seat.label).trim(), seat);
  }

  const counts = new Map<SeatCategoryCode, number>();
  for (const seatValue of selectedSeats) {
    const normalized = normalizeSeatLookupValue(seatValue);
    const seat = seatBySeatId.get(seatValue) ?? seatBySeatId.get(normalized) ?? seatByLabel.get(normalized);
    const category = String(seat?.category ?? '').trim() as SeatCategoryCode;
    if (!SEAT_CATEGORY_CODES.includes(category)) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).flatMap(([code, quantity]) => {
    const amount = typeof (pricing as any)?.[code]?.amount === 'number' ? Math.max(0, Number((pricing as any)[code].amount) || 0) : 0;
    if (!amount || quantity <= 0) return [];
    return [{
      code,
      label: quantity > 1 ? `${EXTRA_LABELS[code]} x${quantity}` : EXTRA_LABELS[code],
      amount: toAmountCents(amount),
      quantity,
      categoryCode: code,
      source: 'seatCategory',
      scope: 'per_selected_seat',
    }];
  });
}

export function getReservationExtraTotalAmount(extra: ReservationExtraSelection | null | undefined, people: number): number {
  const amount = Math.max(0, Number(extra?.amount ?? 0) || 0);
  if (amount <= 0) return 0;
  const scope = String(extra?.scope ?? 'per_person');
  if (scope === 'per_booking') return amount;
  if (scope === 'per_selected_seat') {
    return amount * Math.max(1, Number(extra?.quantity ?? 0) || 0);
  }
  return amount * Math.max(1, people);
}

export function withSinglePassengerSurcharge(params: {
  selectedExtras?: ReservationExtraSelection[] | null;
  baseSubtotalAmount: number;
  people: number;
}): ReservationExtraSelection[] {
  const extras = Array.isArray(params.selectedExtras) ? [...params.selectedExtras] : [];
  const filtered = extras.filter((extra) => !isSinglePassengerSurchargeExtra(extra));
  const surcharge = getSinglePassengerSurchargeSelection(params.baseSubtotalAmount, params.people);
  if (surcharge) filtered.push(surcharge);
  return filtered;
}

export function resolveReservationExtraSelections(params: {
  paquete: Paquete;
  pickupPoint?: string | null;
  selectedExtraCodes?: Array<string | ReservationExtraCode> | null;
  selectedSeats?: string[] | null;
  seatLayoutTemplate?: Pick<SeatLayoutTemplate, 'seats' | 'amenities' | 'categoryPricing'> | null;
}): ReservationExtraSelection[] {
  const requested = new Set(
    Array.isArray(params.selectedExtraCodes)
      ? params.selectedExtraCodes.map((code) => String(code).trim()).filter(Boolean)
      : []
  );
  const selections: ReservationExtraSelection[] = [];
  const pickupPoint = String(params.pickupPoint ?? '').trim();
  if (pickupPoint) {
    const pickupExtra = getPickupPointExtraSelection(params.paquete, pickupPoint);
    if (pickupExtra) selections.push(pickupExtra);
  }
  const automaticSeatSelections = getSeatCategoryExtraSelections({
    selectedSeats: params.selectedSeats,
    seatLayoutTemplate: params.seatLayoutTemplate ?? null,
  });
  if (automaticSeatSelections.length > 0) {
    selections.push(...automaticSeatSelections);
  } else {
    getSeatLayoutExtraOptions(params.seatLayoutTemplate).forEach((option) => {
      if (requested.has(option.code)) selections.push(option);
    });
  }
  const administrativeFeeExtra = getAdministrativeFeeExtraSelection(params.paquete);
  if (administrativeFeeExtra) selections.push(administrativeFeeExtra);
  return selections;
}

function toDisplayCurrency(paquete: Paquete, salida: Salida | null): 'USD' | 'ARS' | 'EUR' | null {
  const moneda = paquete.moneda ?? salida?.moneda ?? null;
  if (moneda === 'USD' || moneda === 'ARS' || moneda === 'EUR') return moneda;
  return null;
}

function toCartCurrency(paquete: Paquete, salida: Salida | null): CartCurrency | null {
  const bookingCurrency = paquete.bookingConfig?.currency;
  if (bookingCurrency === 'ars' || bookingCurrency === 'brl' || bookingCurrency === 'usd') return bookingCurrency;
  const moneda = toDisplayCurrency(paquete, salida);
  if (moneda === 'ARS') return 'ars';
  if (moneda === 'USD') return 'usd';
  if (moneda === 'EUR') return 'usd';
  return null;
}

function normalizePercent(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, n));
  return clamped;
}

function resolvePackagePricingConfig(paquete: Paquete): ReservationPricingConfig | null {
  const raw = (paquete as any)?.reservationPricing;
  if (!raw || typeof raw !== 'object') return null;
  const mode = String((raw as any).mode ?? '').trim().toLowerCase();
  const normalizedMode: ReservationPricingMode | null = mode === 'percent' ? 'percent' : mode === 'fixed' ? 'fixed' : null;
  if (!normalizedMode) return null;
  const fixedUnitAmount =
    typeof (raw as any).fixedUnitAmount === 'number' && Number.isFinite((raw as any).fixedUnitAmount)
      ? toAmountCents((raw as any).fixedUnitAmount)
      : null;
  const singleAdult = normalizePercent((raw as any)?.single?.adultPercent);
  const singleMinor = normalizePercent((raw as any)?.single?.minorPercent);
  const groupAdult = normalizePercent((raw as any)?.group?.adultPercent);
  const groupMinor = normalizePercent((raw as any)?.group?.minorPercent);

  const single = singleAdult !== null ? { adultPercent: singleAdult, minorPercent: singleMinor } : null;
  const group = groupAdult !== null ? { adultPercent: groupAdult, minorPercent: groupMinor } : null;
  const allowCustomPercent = Boolean((raw as any).allowCustomPercent);
  return {
    mode: normalizedMode,
    fixedUnitAmount,
    single,
    group,
    allowCustomPercent,
  };
}

export function computeReservationPricing(paquete: Paquete, rawDate: string, input?: {
  people?: number | null;
  peopleAdults?: number | null;
  peopleMinors?: number | null;
  depositPercentAdults?: number | null;
  depositPercentMinors?: number | null;
  selectedExtras?: ReservationExtraSelection[] | null;
  roomType?: string | null;
}): ComputedReservationPricing {
  const departure = resolveDepartureConfig(paquete, rawDate);
  const adultsRaw = typeof input?.peopleAdults === 'number' ? Math.max(0, Math.floor(input!.peopleAdults)) : null;
  const minorsRaw = typeof input?.peopleMinors === 'number' ? Math.max(0, Math.floor(input!.peopleMinors)) : null;
  const derivedPeople = (adultsRaw ?? 0) + (minorsRaw ?? 0);
  const people = derivedPeople > 0 ? derivedPeople : Math.max(1, Math.floor(Number(input?.people ?? 1) || 1));
  const adults = derivedPeople > 0 ? Math.min(people, adultsRaw ?? 0) : people;
  const minors = derivedPeople > 0 ? Math.min(people - adults, minorsRaw ?? 0) : 0;

  const pricingCfg = resolvePackagePricingConfig(paquete);
  const baseUnitAmount = departure.baseUnitAmount;
  const fixedFallback =
    typeof paquete.bookingConfig?.depositAmount === 'number' && paquete.bookingConfig.depositAmount > 0
      ? toAmountCents(paquete.bookingConfig.depositAmount)
      : departure.unitAmount > 0
        ? Math.round(departure.unitAmount)
        : baseUnitAmount;

  if (!pricingCfg || pricingCfg.mode === 'fixed') {
    const fixedUnitAmount =
      pricingCfg?.fixedUnitAmount && pricingCfg.fixedUnitAmount > 0
        ? Math.round(pricingCfg.fixedUnitAmount)
        : fixedFallback;
    const unitAmountAdults = Math.max(0, fixedUnitAmount);
    const unitAmountMinors = Math.max(0, fixedUnitAmount);
    const baseSubtotalAmount = unitAmountAdults * adults + unitAmountMinors * minors;
    const selectedExtras = withSinglePassengerSurcharge({
      selectedExtras: input?.selectedExtras,
      baseSubtotalAmount,
      people,
    });
    const extrasTotalAmount = selectedExtras.reduce((sum, extra) => sum + getReservationExtraTotalAmount(extra, people), 0);
    const subtotalAmount = baseSubtotalAmount + extrasTotalAmount;
    return {
      pricingMode: 'fixed',
      currency: departure.currency,
      displayCurrency: departure.displayCurrency,
      baseUnitAmount,
      people,
      peopleAdults: derivedPeople > 0 ? adults : null,
      peopleMinors: derivedPeople > 0 ? minors : null,
      depositPercentAdults: null,
      depositPercentMinors: null,
      unitAmountAdults,
      unitAmountMinors,
      unitAmount: unitAmountAdults,
      baseSubtotalAmount,
      extrasTotalAmount,
      subtotalAmount,
    };
  }

  const rule = people <= 1 ? pricingCfg.single : pricingCfg.group;
  const fallbackRule = rule ?? pricingCfg.group ?? pricingCfg.single;
  const baseAdultPercent = fallbackRule ? fallbackRule.adultPercent : 0;
  const baseMinorPercent =
    fallbackRule && fallbackRule.minorPercent != null ? fallbackRule.minorPercent : baseAdultPercent;

  const overrideAdults = normalizePercent(input?.depositPercentAdults);
  const overrideMinors = normalizePercent(input?.depositPercentMinors);
  const configuredDepositPercentAdults = overrideAdults !== null ? overrideAdults : baseAdultPercent;
  const configuredDepositPercentMinors = overrideMinors !== null ? overrideMinors : baseMinorPercent;

  // Las reservas deben respetar el precio oficial completo del paquete.
  // Conservamos los porcentajes legacy solo como metadata histórica, pero
  // dejamos de usarlos para recortar el monto efectivo a cobrar.
  const depositPercentAdults = 100;
  const depositPercentMinors = 100;
  const unitAmountAdults = Math.max(0, Math.round(baseUnitAmount));
  const unitAmountMinors = Math.max(0, Math.round(baseUnitAmount));
  const baseSubtotalAmount = unitAmountAdults * adults + unitAmountMinors * minors;
  const selectedExtras = withSinglePassengerSurcharge({
    selectedExtras: input?.selectedExtras,
    baseSubtotalAmount,
    people,
  });
  const extrasTotalAmount = selectedExtras.reduce((sum, extra) => sum + getReservationExtraTotalAmount(extra, people), 0);
  const subtotalAmount = baseSubtotalAmount + extrasTotalAmount;
  return {
    pricingMode: 'percent',
    currency: departure.currency,
    displayCurrency: departure.displayCurrency,
    baseUnitAmount,
    people,
    peopleAdults: derivedPeople > 0 ? adults : null,
    peopleMinors: derivedPeople > 0 ? minors : null,
    depositPercentAdults: configuredDepositPercentAdults !== null ? depositPercentAdults : null,
    depositPercentMinors: configuredDepositPercentMinors !== null ? depositPercentMinors : null,
    unitAmountAdults,
    unitAmountMinors,
    unitAmount: unitAmountAdults,
    baseSubtotalAmount,
    extrasTotalAmount,
    subtotalAmount,
  };
}

export function getOperationalSalidas(paquete: Paquete): Salida[] {
  if (!Array.isArray(paquete.salidas)) return [];

  const uniqueByDate = new Map<string, Salida>();
  for (const salida of paquete.salidas) {
    const fecha = normalizeText(salida?.fecha);
    if (!fecha) continue;
    if (!uniqueByDate.has(fecha)) {
      uniqueByDate.set(fecha, {
        ...salida,
        fecha,
        fechaVuelta: normalizeText(salida?.fechaVuelta),
        ciudadSalida: normalizeText(salida?.ciudadSalida),
        observaciones: normalizeText(salida?.observaciones),
        seatLayoutId: normalizeText(salida?.seatLayoutId),
      });
    }
  }

  return Array.from(uniqueByDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function getOperationalDepartureDates(paquete: Paquete): string[] {
  return getOperationalSalidas(paquete).map((salida) => salida.fecha);
}

export function isFullDayDeparture(paquete: Pick<Paquete, 'roomTypes'>): boolean {
  return getPackageRoomTypes(paquete).length === 0;
}

export function resolveDepartureConfig(paquete: Paquete, rawDate: string): ResolvedDepartureConfig {
  const date = normalizeDate(rawDate);
  const isNoDate = date === 'sin-fecha';
  const salida = isNoDate
    ? null
    : getOperationalSalidas(paquete).find((item) => item.fecha === date) ?? null;
  const globalEnabled = paquete.bookingConfig?.enabled !== false;
  const packageSeatsEnabled = Boolean(paquete.seatSelectionEnabled);
  const packageSeatLayoutId = normalizeText(paquete.seatLayoutId);
  const seatsEnabled = salida ? (salida.seatSelectionEnabled ?? packageSeatsEnabled) : packageSeatsEnabled;
  const seatLayoutId = seatsEnabled ? normalizeText(salida?.seatLayoutId) || packageSeatLayoutId : '';
  const displayCurrency = toDisplayCurrency(paquete, salida);
  const currency = toCartCurrency(paquete, salida);
  const baseUnitAmount =
    typeof salida?.precio === 'number' && salida.precio > 0
      ? toAmountCents(salida.precio)
      : typeof paquete.precio === 'number' && paquete.precio > 0
        ? toAmountCents(paquete.precio)
        : 0;
  const unitAmount =
    typeof paquete.bookingConfig?.depositAmount === 'number' && paquete.bookingConfig.depositAmount > 0
      ? toAmountCents(paquete.bookingConfig.depositAmount)
      : typeof paquete.precio === 'number' && paquete.precio > 0
          ? toAmountCents(paquete.precio)
        : typeof salida?.precio === 'number' && salida.precio > 0
          ? toAmountCents(salida.precio)
          : 0;
  const baseCapacity =
    typeof salida?.cupo === 'number' && salida.cupo > 0
      ? salida.cupo
      : typeof paquete.capacidadMaxima === 'number' && paquete.capacidadMaxima > 0
        ? paquete.capacidadMaxima
        : 0;
  const maxPeople =
    typeof paquete.bookingConfig?.maxPeoplePerBooking === 'number' && paquete.bookingConfig.maxPeoplePerBooking > 0
      ? paquete.bookingConfig.maxPeoplePerBooking
      : baseCapacity > 0
        ? baseCapacity
        : 50;

  return {
    date,
    isNoDate,
    exists: isNoDate ? true : Boolean(salida),
    enabled: globalEnabled && (isNoDate ? true : Boolean(salida)),
    salida,
    isFullDay: isFullDayDeparture(paquete),
    baseUnitAmount,
    unitAmount,
    currency,
    displayCurrency,
    baseCapacity,
    maxPeople,
    seatsEnabled,
    seatLayoutId: seatLayoutId || null,
    pickupPoints: normalizePickupPoints(paquete),
    pickupPointsConfig: getPickupPointItems(paquete),
  };
}
