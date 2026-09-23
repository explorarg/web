import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { getPaqueteById } from '@/lib/paquetes';
import { Timestamp, doc, getDoc, runTransaction } from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';
import { buildBaseSeatReservationSeats, getSeatDepartureId, toDepartureSeats, type SeatReservationDoc } from '@/lib/seats/server';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';

export const runtime = 'nodejs';

const querySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
});

const actionSchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  seatIds: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(['block', 'unblock', 'assign', 'free', 'free-paid']),
  reason: z.string().max(200).optional(),
  reservationId: z.string().min(1).optional(),
  assignStatus: z.enum(['reserved', 'paid']).optional(),
});

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/seats] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

async function loadTemplate(seatLayoutId: string) {
  const templateRef = doc(db, 'seatLayouts', seatLayoutId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) return null;
  return { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    packageId: url.searchParams.get('packageId') ?? '',
    date: url.searchParams.get('date') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const { packageId, date } = parsed.data;
  const pkg = await getPaqueteById(packageId);
  if (!pkg) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

  const departureConfig = resolveDepartureConfig(pkg, date);
  const enabled = departureConfig.seatsEnabled && departureConfig.enabled && departureConfig.exists;
  const seatLayoutId = departureConfig.seatLayoutId ?? '';
  if (!enabled || !seatLayoutId) {
    return NextResponse.json({ enabled: false, seatLayoutId: seatLayoutId || null });
  }

  const template = await loadTemplate(seatLayoutId);
  if (!template) {
    return NextResponse.json({ error: 'Plantilla de micro no encontrada' }, { status: 404 });
  }

  const departureId = getSeatDepartureId(packageId, date);
  const seatResRef = doc(db, 'seatReservations', departureId);

  const seatReservation = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seatResRef);
    if (snap.exists()) {
      const data = { id: snap.id, ...(snap.data() as any) } as SeatReservationDoc;
      if (String(data.seatLayoutId || '') !== seatLayoutId) {
        const now = Timestamp.now();
        const seats = buildBaseSeatReservationSeats(template);
        tx.set(seatResRef, { packageId, date, seatLayoutId, seats, updatedAt: now }, { merge: true });
        return { id: departureId, packageId, date, seatLayoutId, seats, createdAt: now, updatedAt: now } as SeatReservationDoc;
      }
      return data;
    }
    const now = Timestamp.now();
    const seats = buildBaseSeatReservationSeats(template);
    tx.set(seatResRef, { packageId, date, seatLayoutId, seats, createdAt: now, updatedAt: now });
    return { id: departureId, packageId, date, seatLayoutId, seats, createdAt: now, updatedAt: now } as SeatReservationDoc;
  });

  return NextResponse.json({
    enabled: true,
    seatLayoutId,
    template,
    seats: toDepartureSeats(template, seatReservation),
  });
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const { packageId, date, seatIds, action } = parsed.data;
  const reason = parsed.data.reason?.trim() || null;
  const reservationId = parsed.data.reservationId?.trim() || '';
  const assignStatus = parsed.data.assignStatus ?? 'reserved';
  const pkg = await getPaqueteById(packageId);
  if (!pkg) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }
  const departureConfig = resolveDepartureConfig(pkg, date);
  const enabled = departureConfig.seatsEnabled && departureConfig.enabled && departureConfig.exists;
  const seatLayoutId = departureConfig.seatLayoutId ?? '';
  if (!enabled || !seatLayoutId) {
    return NextResponse.json({ error: 'La salida no tiene selección de butacas habilitada.' }, { status: 400 });
  }

  const template = await loadTemplate(seatLayoutId);
  if (!template) {
    return NextResponse.json({ error: 'Plantilla de micro no encontrada' }, { status: 404 });
  }

  const departureId = getSeatDepartureId(packageId, date);
  const seatResRef = doc(db, 'seatReservations', departureId);

  try {
    const seatReservation = await runTransaction(db, async (tx) => {
      const snap = await tx.get(seatResRef);
      const now = Timestamp.now();
      const baseSeats = buildBaseSeatReservationSeats(template);
      const current = snap.exists()
        ? ({ id: snap.id, ...(snap.data() as any) } as SeatReservationDoc)
        : ({ id: departureId, packageId, date, seatLayoutId, seats: baseSeats, createdAt: now, updatedAt: now } as SeatReservationDoc);

      const toMillis = (v: any): number => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const n = Date.parse(v);
          return Number.isNaN(n) ? 0 : n;
        }
        if (typeof v?.toMillis === 'function') return v.toMillis();
        if (typeof v?.toDate === 'function') return v.toDate().getTime();
        if (typeof v?.seconds === 'number') return v.seconds * 1000;
        return 0;
      };

      let reservationDoc: any = null;
      if (action === 'assign' || action === 'free' || action === 'free-paid') {
        if (!reservationId) throw new Error('Falta reservationId.');
        const resSnap = await tx.get(doc(db, 'reservas', reservationId));
        if (!resSnap.exists()) throw new Error('Reserva no encontrada.');
        reservationDoc = { id: resSnap.id, ...(resSnap.data() as any) };
        const resPkgId = String(reservationDoc.packageId ?? reservationDoc.experienceId ?? '');
        const resDate = String(reservationDoc.date ?? '');
        if (resPkgId !== packageId || resDate !== date) {
          throw new Error('La reserva no corresponde a este paquete/fecha.');
        }
      }

      for (const seatId of seatIds) {
        const state = current.seats?.[seatId] ?? baseSeats[seatId];
        if (!state) continue;
        if (action === 'block') {
          const status = String((state as any).status ?? 'available');
          if (status !== 'available') {
            if (status === 'held' || status === 'reserved') {
              const exp = toMillis((state as any).expiresAt);
              if (!(exp > 0 && exp <= now.toMillis())) {
                throw new Error('Una o más butacas no están disponibles para bloquear.');
              }
            } else {
              throw new Error('Una o más butacas no están disponibles para bloquear.');
            }
          }
          current.seats[seatId] = {
            status: 'blocked',
            blockedBy: 'admin',
            blockReason: reason,
            holdId: null,
            cartId: null,
            cartItemId: null,
            orderId: null,
            reservationId: null,
            expiresAt: null,
            updatedAt: now,
          };
        } else if (action === 'unblock') {
          if (String((state as any).status ?? '') !== 'blocked') {
            throw new Error('Una o más butacas no están bloqueadas.');
          }
          current.seats[seatId] = {
            status: 'available',
            blockedBy: null,
            blockReason: null,
            holdId: null,
            cartId: null,
            cartItemId: null,
            orderId: null,
            reservationId: null,
            expiresAt: null,
            updatedAt: now,
          };
        } else if (action === 'assign') {
          if (String((state as any).status ?? '') !== 'available') {
            throw new Error('Una o más butacas no están disponibles para asignar.');
          }
          current.seats[seatId] = {
            status: assignStatus,
            blockedBy: null,
            blockReason: null,
            holdId: null,
            cartId: null,
            cartItemId: null,
            orderId: reservationDoc?.orderId ?? null,
            reservationId,
            expiresAt: null,
            updatedAt: now,
          };
        } else if (action === 'free') {
          if (String((state as any).status ?? '') !== 'reserved') {
            throw new Error('Solo se pueden liberar butacas en estado reserved.');
          }
          if (String((state as any).reservationId ?? '') !== reservationId) {
            throw new Error('La butaca no pertenece a esa reserva.');
          }
          current.seats[seatId] = {
            status: 'available',
            blockedBy: null,
            blockReason: null,
            holdId: null,
            cartId: null,
            cartItemId: null,
            orderId: null,
            reservationId: null,
            expiresAt: null,
            updatedAt: now,
          };
        } else if (action === 'free-paid') {
          if (String((state as any).status ?? '') !== 'paid') {
            throw new Error('Solo se pueden liberar butacas en estado paid con esta acción.');
          }
          if (String((state as any).reservationId ?? '') !== reservationId) {
            throw new Error('La butaca no pertenece a esa reserva.');
          }
          current.seats[seatId] = {
            status: 'available',
            blockedBy: null,
            blockReason: null,
            holdId: null,
            cartId: null,
            cartItemId: null,
            orderId: null,
            reservationId: null,
            expiresAt: null,
            updatedAt: now,
          };
        }
      }

      if (!snap.exists()) {
        tx.set(seatResRef, { packageId, date, seatLayoutId, seats: current.seats, createdAt: now, updatedAt: now });
      }
      tx.set(seatResRef, { seats: current.seats, updatedAt: now }, { merge: true });
      return current;
    });

    return NextResponse.json({
      ok: true,
      enabled: true,
      seatLayoutId,
      template,
      seats: toDepartureSeats(template, seatReservation),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo actualizar butacas.' },
      { status: 400 }
    );
  }
}
