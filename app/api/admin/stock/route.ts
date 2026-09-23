import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPaqueteById } from '@/lib/paquetes';
import { requireAdminToken } from '@/lib/adminAuth';
import {
  getMovimientosStock,
  getStockDisponible,
  registrarMovimientoStock,
  StockMovementType,
} from '@/lib/stock';

const querySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
});

const bodySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  type: z.enum(['entrada', 'salida', 'ajuste', 'reserva']),
  quantity: z.number(),
  note: z.string().max(500).optional(),
});

function getBaseCapacity(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, date: string): number {
  if (!paquete) return 0;
  const bookings = paquete.bookingConfig?.dates ?? [];
  const match = bookings.find((item) => item.date === date);
  if (match) return Math.max(0, match.capacity);
  const salidaMatch = (paquete.salidas ?? []).find((s) => s.fecha === date);
  if (typeof salidaMatch?.cupo === 'number') return Math.max(0, salidaMatch.cupo);
  if (paquete.bookingConfig?.maxPeoplePerBooking) {
    return paquete.bookingConfig.maxPeoplePerBooking;
  }
  if (typeof paquete.capacidadMaxima === 'number') {
    return Math.max(0, paquete.capacidadMaxima);
  }
  return 0;
}

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/stock] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
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

  const paquete = await getPaqueteById(parsed.data.packageId);
  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
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

export async function POST(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/stock] Token inválido', error);
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const type = payload.type as StockMovementType;
  const signedQuantity =
    type === 'entrada'
      ? payload.quantity
      : type === 'salida' || type === 'reserva'
        ? -Math.abs(payload.quantity)
        : payload.quantity;

  try {
    await registrarMovimientoStock({
      packageId: payload.packageId,
      date: payload.date,
      type,
      quantity: signedQuantity,
      author: adminUser.email ?? 'admin',
      note: payload.note,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/stock] Error registrando movimiento:', error);
    return NextResponse.json({ error: 'No se pudo registrar el movimiento' }, { status: 500 });
  }
}
