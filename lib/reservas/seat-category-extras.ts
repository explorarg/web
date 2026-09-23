import type { ReservationExtraSelection } from '@/types';
import { SEAT_CATEGORY_CODES } from '@/lib/seats/categories';
import { getReservationExtraTotalAmount } from '@/lib/packages/resolve-departure';

export type SeatCategoryExtraSummary = {
  code: string;
  label: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function isSeatCategoryExtra(extra: ReservationExtraSelection | null | undefined): extra is ReservationExtraSelection {
  if (!extra) return false;
  const code = normalizeText(extra.code);
  const categoryCode = normalizeText(extra.categoryCode);
  const source = normalizeText(extra.source).toLowerCase();
  return (
    SEAT_CATEGORY_CODES.includes(code as any) ||
    SEAT_CATEGORY_CODES.includes(categoryCode as any) ||
    source === 'seatcategory' ||
    source === 'seatCategory'.toLowerCase()
  );
}

export function getSeatCategoryExtraSummaries(
  selectedExtras: ReservationExtraSelection[] | null | undefined
): SeatCategoryExtraSummary[] {
  return (selectedExtras ?? [])
    .filter(isSeatCategoryExtra)
    .map((extra) => {
      const quantity = Math.max(1, Number(extra.quantity ?? 1) || 1);
      return {
        code: normalizeText(extra.categoryCode || extra.code),
        label: normalizeText(extra.label) || normalizeText(extra.code),
        quantity,
        unitAmount: Math.max(0, Number(extra.amount ?? 0) || 0),
        totalAmount: getReservationExtraTotalAmount(extra, 1),
      };
    });
}

export function getSeatCategoryTotalAmount(
  selectedExtras: ReservationExtraSelection[] | null | undefined
): number {
  return getSeatCategoryExtraSummaries(selectedExtras).reduce((sum, item) => sum + item.totalAmount, 0);
}

export function getSeatTypeLabel(
  selectedExtras: ReservationExtraSelection[] | null | undefined,
  selectedSeatsCount = 0
): string {
  const labels = Array.from(
    new Set(
      getSeatCategoryExtraSummaries(selectedExtras)
        .map((extra) => normalizeText(extra.label).replace(/\sx\d+$/i, '').trim())
        .filter(Boolean)
    )
  );

  if (labels.length > 0) return labels.join(' | ');
  if (selectedSeatsCount > 0) return 'Estándar';
  return '';
}
