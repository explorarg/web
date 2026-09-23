import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { CART_COOKIE_NAME } from '@/lib/cart/server';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  holdId: z.string().min(1).optional(),
  cartId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const now = Timestamp.now();
  const cartId = parsed.data.cartId || request.cookies.get(CART_COOKIE_NAME)?.value || null;
  const holdId = parsed.data.holdId || null;

  const holds: Array<{ id: string; cartId: string; cartItemId: string; packageId: string; date: string; people: number; seatLayoutId?: string | null }> = [];

  if (holdId) {
    const holdRef = doc(db, 'reservationHolds', holdId);
    const snap = await getDoc(holdRef);
    if (snap.exists()) holds.push({ id: snap.id, ...(snap.data() as any) });
  } else if (cartId) {
    const col = collection(db, 'reservationHolds');
    const q = query(col, where('cartId', '==', cartId), where('status', '==', 'active'));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => holds.push({ id: d.id, ...(d.data() as any) }));
  } else {
    return NextResponse.json({ ok: true, released: 0 });
  }

  let released = 0;
  for (const h of holds) {
    const holdRef = doc(db, 'reservationHolds', h.id);
    const lockRef = doc(db, 'stockHolds', `${h.packageId}_${h.date}`);
    const itemRef = h.cartId && h.cartItemId ? doc(db, 'carts', h.cartId, 'items', h.cartItemId) : null;
    try {
      await runTransaction(db, async (tx) => {
        const holdSnap = await tx.get(holdRef);
        if (!holdSnap.exists()) return;
        const holdData: any = holdSnap.data();
        if (String(holdData.status ?? 'active') !== 'active') return;
        const lockSnap = await tx.get(lockRef);
        const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
        const itemSnap = itemRef ? await tx.get(itemRef) : null;

        const selectedSeatLabels = Array.isArray(holdData.selectedSeats)
          ? holdData.selectedSeats.map((s: any) => String(s))
          : [];
        let seatResSnap = null;
        let templateSnap = null;
        let seatResRef = null;
        if (selectedSeatLabels.length > 0 && h.packageId && h.date && h.date !== 'sin-fecha') {
          seatResRef = doc(db, 'seatReservations', getSeatDepartureId(h.packageId, h.date));
          seatResSnap = await tx.get(seatResRef);
          if (seatResSnap.exists()) {
            const seatResData: any = seatResSnap.data();
            const seatLayoutId =
              (typeof holdData?.seatLayoutId === 'string' ? holdData.seatLayoutId.trim() : '') ||
              (typeof h.seatLayoutId === 'string' ? h.seatLayoutId.trim() : '') ||
              String(seatResData?.seatLayoutId ?? '');
            if (seatLayoutId) {
              templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
            }
          }
        }

        tx.update(holdRef, { status: 'released', releasedAt: now, updatedAt: now });
        if (itemRef && itemSnap?.exists()) {
          tx.update(itemRef, { holdStatus: 'released', updatedAt: now });
        }
        if (!lockSnap.exists()) {
          tx.set(lockRef, { packageId: h.packageId, date: h.date, heldPeople: 0, updatedAt: now, createdAt: now });
        } else {
          tx.update(lockRef, { heldPeople: Math.max(0, heldPeople - Number(h.people ?? 0)), updatedAt: now });
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
            if (String(seat.holdId ?? '') !== h.id) continue;
            seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, expiresAt: null, blockedBy: null, updatedAt: now };
          }
          tx.set(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
        }
      });
      released += 1;
    } catch {
      // no-op
    }
  }

  return NextResponse.json({ ok: true, released });
}

