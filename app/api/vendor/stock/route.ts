import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPaqueteById } from '@/lib/paquetes';
import { getMovimientosStock, getStockDisponible } from '@/lib/stock';
import { requireVendorToken, vendorHasPackageAccess } from '@/lib/vendorAuth';

const querySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
});

function getBaseCapacity(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, date: string): number {
  if (!paquete) return 0;
  const bookings = paquete.bookingConfig?.dates ?? [];
  const match = bookings.find((item) => item.date === date);
  if (match) return Math.max(0, match.capacity);
  const salidaMatch = (paquete.salidas ?? []).find((s) => s.fecha === date);
  if (typeof salidaMatch?.cupo === 'number') return Math.max(0, salidaMatch.cupo);
  if (paquete.bookingConfig?.maxPeoplePerBooking) return paquete.bookingConfig.maxPeoplePerBooking;
  if (typeof paquete.capacidadMaxima === 'number') return Math.max(0, paquete.capacidadMaxima);
  return 0;
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

  const paquete = await getPaqueteById(parsed.data.packageId);
  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }
  if (!vendorHasPackageAccess(vendor, parsed.data.packageId)) {
    return NextResponse.json({ error: 'No tenés permiso para este paquete.' }, { status: 403 });
  }

  const baseCapacity = getBaseCapacity(paquete, parsed.data.date);
  const movements = await getMovimientosStock(parsed.data.packageId, {
    date: parsed.data.date,
    limit: 40,
  });
  const available = await getStockDisponible(parsed.data.packageId, parsed.data.date, baseCapacity);
  return NextResponse.json({
    baseCapacity,
    available,
    movements,
  });
}
