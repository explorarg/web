import type { Vendor } from '@/types/vendor';
import type { Reservation } from '@/components/landing-reserva/types';
import { getReferralByCode, getVendorById } from '@/lib/vendors';

export function computeCommission(params: {
  amountTotal?: number;
  commissionBaseAmount?: number | null;
  extrasExcludedAmount?: number | null;
  people: number;
  vendor: Vendor;
  commissionOverride?: { type: 'percent' | 'fixed'; value: number; currency: 'ars' | 'brl' | 'usd' } | null;
}): { type: 'percent' | 'fixed'; value: number; currency: 'ars' | 'brl' | 'usd'; commissionAmount: number } {
  const def = params.commissionOverride ?? params.vendor.defaultCommission;
  const commissionBaseAmount =
    typeof params.commissionBaseAmount === 'number' && Number.isFinite(params.commissionBaseAmount)
      ? Math.max(0, Math.round(params.commissionBaseAmount))
      : Math.max(0, Math.round(params.amountTotal ?? 0));
  if (def.type === 'percent') {
    const amount = Math.round(commissionBaseAmount * (def.value / 100));
    return { type: 'percent', value: def.value, currency: def.currency, commissionAmount: amount };
  }
  const amount = Math.round(def.value * 100);
  return { type: 'fixed', value: def.value, currency: def.currency, commissionAmount: amount };
}

export async function resolveReferralFromCode(code: string): Promise<{ vendor: Vendor; code: string } | null> {
  const ref = await getReferralByCode(code);
  if (!ref) return null;
  const vendor = await getVendorById(ref.vendorId);
  if (!vendor || !vendor.active) return null;
  return { vendor, code: ref.code };
}

export function nextPayoutStatusForReservationStatus(status: Reservation['status']): 'pending' | 'accrued' | 'paid' | 'cancelled' {
  if (status === 'completed') return 'accrued';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}
