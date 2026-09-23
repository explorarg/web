import type { Paquete, CartCurrency } from '@/types';
import { db } from '@/lib/firebase';
import { getMovimientosStock } from '@/lib/stock';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';

export const CART_COOKIE_NAME = 'exploarg_cart_id';

export function getHoldMinutes(): number {
  const raw = process.env.CART_HOLD_MINUTES;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) return 15;
  return parsed;
}

export function getPendingHoldMinutes(): number {
  const raw = process.env.PENDING_HOLD_MINUTES;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 5 || parsed > 1440) return 60;
  return parsed;
}

export function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isNaN(n) ? 0 : n;
  }
  const anyValue = value as any;
  if (typeof anyValue?.toMillis === 'function') return anyValue.toMillis();
  return 0;
}

export function computeBaseCapacity(paquete: Paquete, date: string): number {
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

export function computeMaxPeople(paquete: Paquete, date: string): number {
  return resolveDepartureConfig(paquete, date).maxPeople;
}

export function computeUnitAmount(paquete: Paquete, date: string): number {
  return resolveDepartureConfig(paquete, date).unitAmount;
}

export function computeCurrency(paquete: Paquete, date: string): CartCurrency | null {
  return resolveDepartureConfig(paquete, date).currency;
}

export async function getHeldPeople(packageId: string, date: string): Promise<number> {
  if (!packageId || !date || date === 'sin-fecha') return 0;
  const ref = doc(db, 'stockHolds', `${packageId}_${date}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  const data: any = snap.data();
  return typeof data?.heldPeople === 'number' ? Math.max(0, data.heldPeople) : 0;
}

export async function getStockDelta(packageId: string, date: string): Promise<number> {
  const movements = await getMovimientosStock(packageId, { date });
  return movements.reduce((sum, m) => sum + (typeof m.quantity === 'number' ? m.quantity : 0), 0);
}

export async function getAvailableForPackageDate(paquete: Paquete, date: string): Promise<number> {
  if (!date || date === 'sin-fecha') return 0;
  const baseCapacity = computeBaseCapacity(paquete, date);
  const delta = await getStockDelta(paquete.id, date);
  const held = await getHeldPeople(paquete.id, date);
  return Math.max(0, baseCapacity + delta - held);
}

export function addMinutes(ts: Timestamp, minutes: number): Timestamp {
  const ms = ts.toMillis() + minutes * 60 * 1000;
  return Timestamp.fromMillis(ms);
}

