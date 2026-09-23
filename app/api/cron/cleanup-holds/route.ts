import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit as firestoreLimit,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';

export const runtime = 'nodejs';

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  const anyValue = value as any;
  if (typeof anyValue?.toMillis === 'function') return anyValue.toMillis();
  if (typeof anyValue?.seconds === 'number') return anyValue.seconds * 1000;
  return 0;
}

type HoldDoc = {
  cartId: string;
  cartItemId: string;
  packageId: string;
  date: string;
  people: number;
  status: 'active' | 'released' | 'consumed' | 'expired';
  expiresAt: unknown;
  seatLayoutId?: string | null;
  selectedSeats?: string[] | null;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = Timestamp.now();
  const nowMs = now.toMillis();
  const batchSize = 200;
  const maxBatches = 6;
  const pendingRaw = process.env.PENDING_HOLD_MINUTES;
  const pendingParsed = pendingRaw ? parseInt(pendingRaw, 10) : NaN;
  const pendingMinutes = Number.isFinite(pendingParsed) && pendingParsed >= 5 && pendingParsed <= 1440 ? pendingParsed : 60;
  const pendingWindowMs = pendingMinutes * 60 * 1000;

  let expired = 0;
  const processed: string[] = [];
  const touchedKeys = new Set<string>();

  for (let batch = 0; batch < maxBatches; batch += 1) {
    let docs: Array<{ id: string; data: HoldDoc }> = [];
    try {
      const col = collection(db, 'reservationHolds');
      const q = query(col, where('status', '==', 'active'), where('expiresAt', '<=', now), firestoreLimit(batchSize));
      const snap = await getDocs(q);
      docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
    } catch {
      const col = collection(db, 'reservationHolds');
      const q = query(col, where('status', '==', 'active'), firestoreLimit(batchSize));
      const snap = await getDocs(q);
      docs = snap.docs
        .map((d) => ({ id: d.id, data: d.data() as any }))
        .filter(({ data }) => {
          const ms = toMillis((data as any).expiresAt);
          return ms > 0 && ms <= nowMs;
        });
    }

    if (docs.length === 0) break;

    for (const h of docs) {
      const holdRef = doc(db, 'reservationHolds', h.id);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(holdRef);
          if (!snap.exists()) return;
          const data = snap.data() as any as HoldDoc;
          if (String(data.status ?? 'active') !== 'active') return;
          const expiresMs = toMillis(data.expiresAt);
          if (!(expiresMs > 0 && expiresMs <= nowMs)) return;

          const packageId = String(data.packageId || '');
          const date = String(data.date || '');
          const people = Number(data.people ?? 0);
          const cartId = String(data.cartId || '');
          const cartItemId = String(data.cartItemId || '');

          const lockRef = packageId && date ? doc(db, 'stockHolds', `${packageId}_${date}`) : null;
          const itemRef = cartId && cartItemId ? doc(db, 'carts', cartId, 'items', cartItemId) : null;
          const cartRef = cartId ? doc(db, 'carts', cartId) : null;

          tx.update(holdRef, { status: 'expired', updatedAt: now });

          if (itemRef) {
            const itemSnap = await tx.get(itemRef);
            if (itemSnap.exists()) {
              tx.update(itemRef, { holdStatus: 'expired', updatedAt: now });
            }
          }

          if (cartRef) {
            const cartSnap = await tx.get(cartRef);
            if (cartSnap.exists()) {
              const cart: any = cartSnap.data();
              if (String(cart.status ?? 'active') === 'active' && toMillis(cart.expiresAt) <= nowMs) {
                tx.update(cartRef, { status: 'expired', updatedAt: now });
              } else {
                tx.update(cartRef, { updatedAt: now });
              }
            }
          }

          if (lockRef && people > 0) {
            const lockSnap = await tx.get(lockRef);
            const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
            if (!lockSnap.exists()) {
              tx.set(lockRef, { packageId, date, heldPeople: 0, updatedAt: now, createdAt: now });
            } else {
              tx.update(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
            }
          }

          const selectedSeatLabels = Array.isArray((data as any).selectedSeats)
            ? (data as any).selectedSeats.map((s: any) => String(s))
            : [];
          if (selectedSeatLabels.length > 0 && packageId && date && date !== 'sin-fecha') {
            const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
            const seatResSnap = await tx.get(seatResRef);
            if (seatResSnap.exists()) {
              const seatResData: any = seatResSnap.data();
              const seatLayoutId =
                (typeof data?.seatLayoutId === 'string' ? data.seatLayoutId.trim() : '') || String(seatResData?.seatLayoutId ?? '');
              if (seatLayoutId) {
                const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                if (templateSnap.exists()) {
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
              }
            }
          }
        });
        expired += 1;
        processed.push(h.id);
        const packageId = String(h.data.packageId || '');
        const date = String(h.data.date || '');
        if (packageId && date && date !== 'sin-fecha') touchedKeys.add(`${packageId}_${date}`);
      } catch {
        processed.push(h.id);
      }
    }
  }

  let reconciled = 0;
  for (const key of touchedKeys) {
    const [packageId, ...rest] = key.split('_');
    const date = rest.join('_');
    if (!packageId || !date) continue;

    let activeHolds: HoldDoc[] = [];
    try {
      const col = collection(db, 'reservationHolds');
      const q = query(
        col,
        where('status', '==', 'active'),
        where('packageId', '==', packageId),
        where('date', '==', date),
        where('expiresAt', '>', now),
        firestoreLimit(1000)
      );
      const snap = await getDocs(q);
      activeHolds = snap.docs.map((d) => d.data() as any);
    } catch {
      const col = collection(db, 'reservationHolds');
      const q = query(col, where('status', '==', 'active'), where('packageId', '==', packageId), where('date', '==', date), firestoreLimit(1000));
      const snap = await getDocs(q);
      activeHolds = snap.docs
        .map((d) => d.data() as any)
        .filter((h) => {
          const ms = toMillis((h as any).expiresAt);
          return ms > nowMs;
        });
    }

    const sum = activeHolds.reduce((s, h) => s + (typeof (h as any).people === 'number' ? Number((h as any).people) : 0), 0);
    await setDoc(
      doc(db, 'stockHolds', key),
      { packageId, date, heldPeople: Math.max(0, sum), updatedAt: now, createdAt: now },
      { merge: true }
    );
    reconciled += 1;
  }

  let expiredOrders = 0;
  const expiredOrderIds: string[] = [];

  const ordersBatchSize = 200;
  const maxOrderBatches = 6;
  for (let batch = 0; batch < maxOrderBatches; batch += 1) {
    const ordersCol = collection(db, 'orders');
    const ordersQ = query(ordersCol, where('status', 'in', ['pending', 'checkout_started']), firestoreLimit(ordersBatchSize));
    const snap = await getDocs(ordersQ);
    if (snap.docs.length === 0) break;

    const candidates = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as any }))
      .filter(({ data }) => {
        const status = String(data.status ?? '');
        const exp = toMillis(data.expiresAt);
        if (status === 'pending') {
          const paymentUpdated = toMillis(data?.payment?.updatedAt ?? data.updatedAt ?? data.createdAt);
          return (exp > 0 && exp <= nowMs) || (paymentUpdated > 0 && paymentUpdated + pendingWindowMs <= nowMs);
        }
        return exp > 0 && exp <= nowMs;
      });

    if (candidates.length === 0) break;

    for (const ord of candidates) {
      const orderRef = doc(db, 'orders', ord.id);
      try {
        await runTransaction(db, async (tx) => {
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists()) return;
          const order: any = orderSnap.data();
          const status = String(order.status ?? '');
          if (status === 'paid' || status === 'cancelled' || status === 'failed' || status === 'expired' || status === 'needs_review') return;
          const exp = toMillis(order.expiresAt);
          const paymentUpdated = toMillis(order?.payment?.updatedAt ?? order.updatedAt ?? order.createdAt);
          const shouldExpire =
            status === 'pending'
              ? (exp > 0 && exp <= nowMs) || (paymentUpdated > 0 && paymentUpdated + pendingWindowMs <= nowMs)
              : exp > 0 && exp <= nowMs;
          if (!shouldExpire) return;

          tx.update(orderRef, {
            status: 'expired',
            failureReason: status === 'pending' ? 'pending_timeout' : 'checkout_timeout',
            updatedAt: now,
          });

          const cartId = String(order.cartId ?? '');
          if (cartId) {
            const cartRef = doc(db, 'carts', cartId);
            const cartSnap = await tx.get(cartRef);
            if (cartSnap.exists()) {
              const cart: any = cartSnap.data();
              if (String(cart.status ?? 'active') === 'active') {
                tx.update(cartRef, { status: 'expired', updatedAt: now });
              } else {
                tx.update(cartRef, { updatedAt: now });
              }
            }
          }

          const items: any[] = Array.isArray(order.items) ? order.items : [];
          for (const it of items) {
            const holdId = String(it.holdId ?? '');
            const packageId = String(it.packageId ?? '');
            const date = String(it.date ?? '');
            const people = Number(it.people ?? 0);
            const cartItemId = String(it.cartItemId ?? '');
            const selectedSeatLabels = Array.isArray(it.selectedSeats) ? it.selectedSeats.map((s: any) => String(s)) : [];
            if (!holdId || !packageId || !date || date === 'sin-fecha' || !people) continue;

            const holdRef = doc(db, 'reservationHolds', holdId);
            const holdSnap = await tx.get(holdRef);
            if (holdSnap.exists()) {
              const hold: any = holdSnap.data();
              if (String(hold.status ?? 'active') === 'active') {
                tx.update(holdRef, { status: 'expired', updatedAt: now });
              }
            }

            if (cartId && cartItemId) {
              const itemRef = doc(db, 'carts', cartId, 'items', cartItemId);
              const itemSnap = await tx.get(itemRef);
              if (itemSnap.exists()) {
                tx.update(itemRef, { holdStatus: 'expired', updatedAt: now });
              }
            }

            const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
            const lockSnap = await tx.get(lockRef);
            const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
            if (!lockSnap.exists()) {
              tx.set(lockRef, { packageId, date, heldPeople: 0, updatedAt: now, createdAt: now });
            } else {
              tx.update(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
            }

            if (selectedSeatLabels.length > 0) {
              const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
              const seatResSnap = await tx.get(seatResRef);
              if (seatResSnap.exists()) {
                const seatResData: any = seatResSnap.data();
                const seatLayoutId =
                  (typeof it?.seatLayoutId === 'string' ? String(it.seatLayoutId).trim() : '') || String(seatResData?.seatLayoutId ?? '');
                if (seatLayoutId) {
                  const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                  if (templateSnap.exists()) {
                    const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
                    const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
                    const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
                    for (const seatId of seatIds) {
                      const seat = seatsMap[seatId];
                      if (!seat) continue;
                      if (String(seat.status ?? '') !== 'held' && String(seat.status ?? '') !== 'reserved') continue;
                      if (String(seat.holdId ?? '') !== holdId) continue;
                      seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, expiresAt: null, blockedBy: null, updatedAt: now };
                    }
                    tx.set(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
                  }
                }
              }
            }
          }

          const reservationIds: string[] = Array.isArray(order.reservationIds)
            ? order.reservationIds.map((s: any) => String(s)).filter(Boolean)
            : [];
          for (const reservationId of reservationIds) {
            const reservaRef = doc(db, 'reservas', reservationId);
            const reservaSnap = await tx.get(reservaRef);
            if (!reservaSnap.exists()) continue;
            const reserva: any = reservaSnap.data();
            const reservaStatus = String(reserva.status ?? '');
            if (reservaStatus === 'completed' || reservaStatus === 'cancelled') continue;
            if (String(reserva.paymentMethod ?? '') !== 'mercadopago') continue;
            if (String(reserva.orderId ?? '') !== ord.id) continue;
            tx.update(reservaRef, {
              status: 'cancelled',
              updatedAt: now,
              statusHistory: arrayUnion({
                status: 'cancelled',
                actor: 'system',
                note: 'Orden vencida (pago pendiente excedió la ventana de espera).',
                createdAt: now,
              }),
            });
          }
        });

        expiredOrders += 1;
        expiredOrderIds.push(ord.id);
      } catch {
        // no-op
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    expired,
    reconciled,
    expiredOrders,
    expiredOrderIds,
    ids: processed,
  });
}
