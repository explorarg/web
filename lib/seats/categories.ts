import type {
  SeatCategoryCode,
  SeatCategoryPricingConfig,
  SeatLayoutAmenities,
  SeatLayoutCategoryPricing,
  SeatLayoutTemplate,
} from '@/types';

export const SEAT_CATEGORY_CODES: SeatCategoryCode[] = ['cocheCama', 'panoramicos', 'cafeteras'];

export const SEAT_CATEGORY_DEFINITIONS: Record<
  SeatCategoryCode,
  {
    label: string;
    shortLabel: string;
    accent: string;
    activeAccent: string;
    surfaceClass: string;
    ringClass: string;
    pricingEnabled: boolean;
  }
> = {
  cocheCama: {
    label: 'Cama',
    shortLabel: 'CA',
    accent: 'text-[#D97706]',
    activeAccent: 'bg-[#D97706]',
    surfaceClass: 'border-[#F6D6A8] bg-[linear-gradient(180deg,#FFF8EC_0%,#FFF2D9_100%)] text-[#B95D03]',
    ringClass: 'ring-[#D97706]',
    pricingEnabled: true,
  },
  panoramicos: {
    label: 'Panorámica',
    shortLabel: 'PA',
    accent: 'text-[#0E90A8]',
    activeAccent: 'bg-[#0E90A8]',
    surfaceClass: 'border-[#A6DDE7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F0FDFF_100%)] text-[#117C93]',
    ringClass: 'ring-[#0E90A8]',
    pricingEnabled: true,
  },
  cafeteras: {
    label: 'Cafetería',
    shortLabel: 'CF',
    accent: 'text-[#7C3AED]',
    activeAccent: 'bg-[#7C3AED]',
    surfaceClass: 'border-[#D9C8FF] bg-[linear-gradient(180deg,#FCFAFF_0%,#F3EEFF_100%)] text-[#6D28D9]',
    ringClass: 'ring-[#7C3AED]',
    pricingEnabled: true,
  },
};

export const SEAT_CATEGORY_LABELS: Record<SeatCategoryCode, string> = {
  cocheCama: SEAT_CATEGORY_DEFINITIONS.cocheCama.label,
  panoramicos: SEAT_CATEGORY_DEFINITIONS.panoramicos.label,
  cafeteras: SEAT_CATEGORY_DEFINITIONS.cafeteras.label,
};

function normalizeAmount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Number(parsed) || 0);
}

function normalizePricingEntry(raw: unknown): SeatCategoryPricingConfig {
  const amount = normalizeAmount((raw as any)?.amount);
  return { amount };
}

export function normalizeSeatCategoryPricing(
  pricing?: SeatLayoutCategoryPricing | SeatLayoutAmenities | null,
  legacyAmenities?: SeatLayoutAmenities | null
): SeatLayoutCategoryPricing {
  const source = pricing && typeof pricing === 'object' ? pricing : legacyAmenities ?? {};
  const out = {} as SeatLayoutCategoryPricing;
  for (const code of SEAT_CATEGORY_CODES) {
    out[code] = normalizePricingEntry((source as any)?.[code]);
  }
  return out;
}

export function getSeatCategoryLabel(code: SeatCategoryCode): string {
  return SEAT_CATEGORY_LABELS[code];
}

export function getSeatCategoryPricingFromTemplate(
  template: Pick<SeatLayoutTemplate, 'categoryPricing' | 'amenities'> | null | undefined
): SeatLayoutCategoryPricing {
  return normalizeSeatCategoryPricing(template?.categoryPricing ?? null, template?.amenities ?? null);
}

export function isSeatCategoryCode(value: unknown): value is SeatCategoryCode {
  return SEAT_CATEGORY_CODES.includes(String(value ?? '').trim() as SeatCategoryCode);
}
