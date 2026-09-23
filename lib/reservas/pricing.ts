function toRoundedCents(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

function normalizePeople(value: unknown): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(1, Math.floor(numeric));
}

export function getOriginalPackageAmountFromUnit(pricingBaseUnitAmount: unknown, people: unknown): number | null {
  const unitAmount = toRoundedCents(pricingBaseUnitAmount);
  const peopleCount = normalizePeople(people);
  if (!unitAmount || peopleCount <= 0) return null;
  return unitAmount * peopleCount;
}

export function getReservationOfficialBaseAmount(input: {
  pricingBaseUnitAmount?: unknown;
  people?: unknown;
  baseSubtotalAmount?: unknown;
  amountTotal?: unknown;
  extrasTotalAmount?: unknown;
}): number {
  const officialAmount = getOriginalPackageAmountFromUnit(input.pricingBaseUnitAmount, input.people);
  if (officialAmount && officialAmount > 0) return officialAmount;

  const baseSubtotalAmount = toRoundedCents(input.baseSubtotalAmount);
  if (baseSubtotalAmount && baseSubtotalAmount > 0) return baseSubtotalAmount;

  const amountTotal = toRoundedCents(input.amountTotal) ?? 0;
  const extrasTotalAmount = toRoundedCents(input.extrasTotalAmount) ?? 0;
  return Math.max(0, amountTotal - extrasTotalAmount);
}

export function getReservationExtrasAmount(extrasTotalAmount: unknown): number {
  return toRoundedCents(extrasTotalAmount) ?? 0;
}
