import type { Reservation, ReservationPaymentMethod, ReservationPricingSnapshot } from '@/components/landing-reserva/types';

export function normalizeReservationPaymentMethod(input: unknown): ReservationPaymentMethod {
  const value = String(input ?? '').trim().toLowerCase();
  if (value === 'mercadopago') return 'mercadopago';
  if (value === 'admin') return 'admin';
  return 'mercadopago';
}

export function buildReservationPricingSnapshot(input: {
  unitAmount?: number | null;
  unitPrice?: number | null;
  people: number;
  amountTotal: number;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  currency?: string | null;
  paymentMethod: unknown;
}): ReservationPricingSnapshot {
  const unitAmount =
    typeof input.unitAmount === 'number' && Number.isFinite(input.unitAmount) && input.unitAmount > 0
      ? Math.round(input.unitAmount)
      : null;
  const unitPrice =
    typeof input.unitPrice === 'number' && Number.isFinite(input.unitPrice) && input.unitPrice > 0
      ? input.unitPrice
      : unitAmount !== null
        ? unitAmount / 100
        : null;

  return {
    unitPrice,
    unitAmount,
    people: Math.max(0, Number(input.people) || 0),
    amountTotal: Math.max(0, Number(input.amountTotal) || 0),
    baseSubtotalAmount:
      typeof input.baseSubtotalAmount === 'number' && Number.isFinite(input.baseSubtotalAmount)
        ? Math.max(0, Math.round(input.baseSubtotalAmount))
        : null,
    extrasTotalAmount:
      typeof input.extrasTotalAmount === 'number' && Number.isFinite(input.extrasTotalAmount)
        ? Math.max(0, Math.round(input.extrasTotalAmount))
        : null,
    currency: String(input.currency || 'ARS').toUpperCase(),
    paymentMethod: normalizeReservationPaymentMethod(input.paymentMethod),
  };
}

export function deriveReservationPaymentStatus(reservation: Partial<Reservation> & Record<string, unknown>): string {
  const reservationStatus = String(reservation.status ?? '').toLowerCase();
  const mercadoPagoStatus = String(reservation.mercadoPagoStatus ?? '').toLowerCase();
  const paymentMethod = normalizeReservationPaymentMethod(
    reservation.pricingSnapshot && typeof reservation.pricingSnapshot === 'object'
      ? (reservation.pricingSnapshot as { paymentMethod?: string }).paymentMethod ?? reservation.paymentMethod
      : reservation.paymentMethod
  );

  if (paymentMethod === 'mercadopago' && mercadoPagoStatus) return mercadoPagoStatus;
  if (reservationStatus === 'completed') return 'paid';
  if (reservationStatus === 'reserved') return paymentMethod === 'admin' ? 'manual_confirmed' : 'reserved';
  if (reservationStatus === 'pending') return paymentMethod === 'admin' ? 'manual_pending' : 'pending';
  if (reservationStatus === 'cancelled') return 'cancelled';
  return mercadoPagoStatus || reservationStatus || 'unknown';
}
