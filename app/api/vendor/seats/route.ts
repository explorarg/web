import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { getPaqueteById } from '@/lib/paquetes';
import { Timestamp, doc, getDoc, runTransaction } from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';
import { buildBaseSeatReservationSeats, getSeatDepartureId, toDepartureSeats, type SeatReservationDoc } from '@/lib/seats/server';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import { requireVendorToken, vendorHasPackageAccess } from '@/lib/vendorAuth';

export const runtime = 'nodejs';

const querySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
});

async function loadTemplate(seatLayoutId: string) {
  const templateRef = doc(db, 'seatLayouts', seatLayoutId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) return null;
  return { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
}

export async function GET(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
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
  if (!vendorHasPackageAccess(vendor, packageId)) {
    return NextResponse.json({ error: 'No tenés permiso para este paquete.' }, { status: 403 });
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
