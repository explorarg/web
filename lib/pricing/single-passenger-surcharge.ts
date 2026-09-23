import type { ReservationExtraSelection } from '@/types';

export type SinglePassengerSurchargeExtraLike = {
  code?: ReservationExtraSelection['code'] | null;
  label?: string | null;
  amount?: number | null;
  source?: ReservationExtraSelection['source'];
  scope?: ReservationExtraSelection['scope'];
  quantity?: number | null;
};

export function isSinglePassengerSurchargeCode(code: unknown): boolean {
  return String(code ?? '') === 'singlePassengerSurcharge';
}

export function isSinglePassengerSurchargeExtra(
  extra: Pick<SinglePassengerSurchargeExtraLike, 'code'> | null | undefined
): boolean {
  return isSinglePassengerSurchargeCode(extra?.code);
}

export function getSinglePassengerSurchargeSelection(
  baseSubtotalAmount: number,
  people: number
): ReservationExtraSelection | null {
  if (Math.max(0, Number(people) || 0) !== 1) return null;
  const normalizedBase = Math.max(0, Number(baseSubtotalAmount) || 0);
  if (normalizedBase <= 0) return null;

  return {
    code: 'singlePassengerSurcharge',
    label: 'Recargo por pasajero individual (50%)',
    amount: Math.round(normalizedBase * 0.5),
    source: 'pricing' as const,
    scope: 'per_booking' as const,
  };
}

export function getSinglePassengerSurchargeAmount(
  baseSubtotalAmount: number,
  people: number
): number {
  const selection = getSinglePassengerSurchargeSelection(baseSubtotalAmount, people);
  return selection ? Math.max(0, Number(selection.amount ?? 0) || 0) : 0;
}

export function getSinglePassengerSurchargeSummary(params: {
  people: number;
  baseSubtotalAmount: number;
  selectedExtras?: SinglePassengerSurchargeExtraLike[] | null;
}) {
  const people = Math.max(0, Number(params.people) || 0);
  const normalizedBase = Math.max(0, Number(params.baseSubtotalAmount) || 0);
  const extras = Array.isArray(params.selectedExtras) ? params.selectedExtras : [];
  const explicitExtra = extras.find((extra) => isSinglePassengerSurchargeExtra(extra)) ?? null;
  const amount = explicitExtra
    ? Math.max(0, Number(explicitExtra.amount ?? 0) || 0)
    : getSinglePassengerSurchargeAmount(normalizedBase, people);

  return {
    applies: amount > 0 && people === 1,
    label: explicitExtra?.label || 'Recargo por pasajero individual (50%)',
    title: 'Recargo tarifa individual',
    description: 'Aplicado por reserva de un solo pasajero.',
    amount,
  };
}
