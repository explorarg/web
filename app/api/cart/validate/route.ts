import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { getPaqueteById } from '@/lib/paquetes';
import {
  CART_COOKIE_NAME,
  computeBaseCapacity,
  getHeldPeople,
  getHoldMinutes,
  getStockDelta,
  toMillis,
} from '@/lib/cart/server';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  cartId: z.string().min(1).optional(),
});

function isExpired(expiresAt: unknown): boolean {
  const ms = toMillis(expiresAt);
  return ms > 0 && ms <= Date.now();
}

async function getCartItems(cartId: string) {
  const itemsCol = collection(db, 'carts', cartId, 'items');
  const q = query(itemsCol, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const cartId = parsed.data.cartId || request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (!cartId) {
    return NextResponse.json({ ok: false, error: 'Carrito no encontrado.' }, { status: 404 });
  }

  const now = Timestamp.now();
  const nowMs = now.toMillis();
  const cartRef = doc(db, 'carts', cartId);
  const cartSnap = await getDoc(cartRef);
  if (!cartSnap.exists()) {
    return NextResponse.json({ ok: false, error: 'Carrito no encontrado.' }, { status: 404 });
  }
  const cart: any = { id: cartSnap.id, ...(cartSnap.data() as any) };
  const items = await getCartItems(cartId);

  const invalid: Array<{ itemId: string; reason: string }> = [];

  for (const it of items) {
    const holdStatus = String(it.holdStatus ?? 'active');
    const expired = isExpired(it.expiresAt);
    if (holdStatus !== 'active') {
      invalid.push({ itemId: it.id, reason: 'hold_not_active' });
      continue;
    }
    if (expired) {
      invalid.push({ itemId: it.id, reason: 'hold_expired' });
      const holdId = it.holdId as string | undefined;
      const packageId = it.packageId as string | undefined;
      const date = it.date as string | undefined;
      const people = Number(it.people ?? 0);
      if (holdId && packageId && date && people > 0) {
        const holdRef = doc(db, 'reservationHolds', holdId);
        const itemRef = doc(db, 'carts', cartId, 'items', it.id);
        await runTransaction(db, async (tx) => {
          const itemSnap = await tx.get(itemRef);
          if (!itemSnap.exists()) return;
          const current: any = itemSnap.data();
          if (String(current.holdStatus ?? 'active') !== 'active') return;
          let lockSnap = null;
          if (date !== 'sin-fecha') {
            const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
            lockSnap = await tx.get(lockRef);
          }

          const selectedSeatLabels = Array.isArray(current.selectedSeats)
            ? current.selectedSeats.map((s: any) => String(s))
            : [];
          let seatResSnap = null;
          let templateSnap = null;
          let seatResRef = null;
          if (selectedSeatLabels.length > 0) {
            seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
            seatResSnap = await tx.get(seatResRef);
            if (seatResSnap.exists()) {
              const seatResData: any = seatResSnap.data();
              const seatLayoutId =
                (typeof current?.seatLayoutId === 'string' ? current.seatLayoutId.trim() : '') || String(seatResData?.seatLayoutId ?? '');
              if (seatLayoutId) {
                templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
              }
            }
          }

          tx.update(holdRef, { status: 'expired', updatedAt: now });
          tx.update(itemRef, { holdStatus: 'expired', updatedAt: now });
          if (date !== 'sin-fecha' && lockSnap?.exists()) {
            const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
            const heldPeople = Number((lockSnap.data() as any)?.heldPeople ?? 0);
            tx.update(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
          }
          if (seatResRef && seatResSnap?.exists() && templateSnap?.exists()) {
            const seatResData: any = seatResSnap.data();
            const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
            const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
            const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
            for (const seatId of seatIds) {
              const seat = seatsMap[seatId];
              if (!seat) continue;
              if (String(seat.status ?? '') !== 'held' && String(seat.status ?? '') !== 'reserved') continue;
              if (String(seat.holdId ?? '') !== holdId) continue;
              seatsMap[seatId] = {
                status: 'available',
                holdId: null,
                cartId: null,
                cartItemId: null,
                expiresAt: null,
                blockedBy: null,
                updatedAt: now,
              };
            }
            tx.set(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
          }
        });
      }
      continue;
    }

    const packageId = it.packageId as string | undefined;
    const date = it.date as string | undefined;
    const people = Number(it.people ?? 0);
    if (!packageId || !date || !people) {
      invalid.push({ itemId: it.id, reason: 'invalid_item_shape' });
      continue;
    }
    const paquete = await getPaqueteById(packageId);
    if (!paquete) {
      invalid.push({ itemId: it.id, reason: 'package_not_found' });
      continue;
    }

    const selected = Array.isArray(it.selectedSeats) ? it.selectedSeats : [];
    if (date === 'sin-fecha') {
      const departureConfig = resolveDepartureConfig(paquete, date);
      if (departureConfig.seatsEnabled && selected.length !== people) {
        invalid.push({ itemId: it.id, reason: 'seats_missing' });
        continue;
      }
      continue;
    }

    const departureConfig = resolveDepartureConfig(paquete, date);
    if (!departureConfig.exists || !departureConfig.enabled) {
      invalid.push({ itemId: it.id, reason: 'date_disabled' });
      continue;
    }
    if (departureConfig.seatsEnabled && selected.length !== people) {
      invalid.push({ itemId: it.id, reason: 'seats_missing' });
      continue;
    }
    const baseCapacity = computeBaseCapacity(paquete, date);
    if (baseCapacity > 0) {
      const delta = await getStockDelta(packageId, date);
      const held = await getHeldPeople(packageId, date);
      const remaining = baseCapacity + delta - held;
      if (remaining < 0) {
        invalid.push({ itemId: it.id, reason: 'overbooked' });
        continue;
      }
    }
  }

  const refreshedItems = await getCartItems(cartId);
  const activeItemExpires = refreshedItems
    .filter((it) => String(it.holdStatus ?? 'active') === 'active' && !isExpired(it.expiresAt))
    .map((it) => toMillis(it.expiresAt))
    .filter((ms) => ms > 0);

  const currentCartExpiresMs = toMillis(cart.expiresAt) || nowMs;
  const computedExpiresAtMs = activeItemExpires.length ? Math.min(...activeItemExpires) : currentCartExpiresMs;
  const noActiveItems = refreshedItems.length > 0 && activeItemExpires.length === 0;
  const cartExpired =
    isExpired(cart.expiresAt) ||
    noActiveItems ||
    (computedExpiresAtMs > 0 && computedExpiresAtMs <= Date.now());

  const updates: any = {
    expiresAt: Timestamp.fromMillis(computedExpiresAtMs),
    updatedAt: now,
  };
  if (cartExpired && cart.status !== 'expired') updates.status = 'expired';

  await updateDoc(cartRef, updates).catch(() => {});

  const amountTotal = refreshedItems.reduce((sum, it) => sum + (typeof it.subtotalAmount === 'number' ? it.subtotalAmount : 0), 0);
  const canCheckout = !cartExpired && invalid.length === 0 && refreshedItems.length > 0;

  return NextResponse.json({
    ok: canCheckout,
    cart: { ...cart, ...updates, id: cartId, amountTotal, expiresAtMs: computedExpiresAtMs },
    items: refreshedItems.map((it) => ({
      ...it,
      expiresAtMs: toMillis(it.expiresAt),
      isExpired: isExpired(it.expiresAt),
      isInvalid: String(it.holdStatus ?? 'active') !== 'active' || isExpired(it.expiresAt),
    })),
    invalid,
  });
}

