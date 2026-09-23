import { NextResponse } from 'next/server';
import { requireAdminToken } from '@/lib/adminAuth';
import { getReservas } from '@/lib/reservas';
import { getOrders } from '@/lib/orders';
import { serializeFirestoreData } from '@/lib/utils/serialize';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Autenticación inválida' },
      { status: 401 }
    );
  }

  try {
    const [reservas, orders] = await Promise.all([
      getReservas({ limit: 300 }),
      getOrders({ limit: 300 }),
    ]);

    return NextResponse.json({
      ok: true,
      reservas: serializeFirestoreData(reservas),
      orders: serializeFirestoreData(orders),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar las ventas' },
      { status: 500 }
    );
  }
}
