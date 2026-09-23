import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
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

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    packageId: request.nextUrl.searchParams.get('packageId') ?? '',
    date: request.nextUrl.searchParams.get('date') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  const { packageId, date } = parsed.data;
  const pkg = await getPaqueteById(packageId);
  if (!pkg) {
    return NextResponse.json({ error: 'Paquete no encontrado.' }, { status: 404 });
  }

  const departureConfig = resolveDepartureConfig(pkg, date);
  const enabled = departureConfig.seatsEnabled && departureConfig.enabled && departureConfig.exists;
  const seatLayoutId = departureConfig.seatLayoutId ?? '';

  if (!enabled || !seatLayoutId) {
    return NextResponse.json({ enabled: false, seatLayoutId: seatLayoutId || null });
  }

  const templateRef = doc(db, 'seatLayouts', seatLayoutId);
  const templateSnap = await getDoc(templateRef);
  if (!templateSnap.exists()) {
    return NextResponse.json({ error: 'Plantilla de micro no encontrada.' }, { status: 404 });
  }
  const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;

  const departureId = getSeatDepartureId(packageId, date);
  const seatResRef = doc(db, 'seatReservations', departureId);

  const seatReservation = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seatResRef);
    if (snap.exists()) {
      const data = { id: snap.id, ...(snap.data() as any) } as SeatReservationDoc;
      if (String(data.seatLayoutId || '') !== seatLayoutId) {
        tx.set(
          seatResRef,
          {
            packageId,
            date,
            seatLayoutId,
            seats: buildBaseSeatReservationSeats(template),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
        return {
          id: departureId,
          packageId,
          date,
          seatLayoutId,
          seats: buildBaseSeatReservationSeats(template),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        } as SeatReservationDoc;
      }
      return data;
    }

    const now = Timestamp.now();
    const seats = buildBaseSeatReservationSeats(template);
    tx.set(seatResRef, {
      packageId,
      date,
      seatLayoutId,
      seats,
      createdAt: now,
      updatedAt: now,
    });
    return { id: departureId, packageId, date, seatLayoutId, seats, createdAt: now, updatedAt: now } as SeatReservationDoc;
  });

  const departureSeats = toDepartureSeats(template, seatReservation);
  return NextResponse.json({
    enabled: true,
    seatLayoutId,
    template: {
      id: template.id,
      name: template.name,
      busType: template.busType,
      floors: template.floors,
      rows: template.rows,
      cols: template.cols,
      aisleCols: template.aisleCols ?? [],
      startNumber: template.startNumber ?? 1,
      seats: template.seats ?? [],
      specialCells: template.specialCells ?? [],
      amenities: template.amenities ?? {},
      categoryPricing: template.categoryPricing ?? template.amenities ?? {},
    },
    seats: departureSeats,
  });
}
