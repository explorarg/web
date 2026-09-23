import { NextResponse } from 'next/server';

import { requireAdminToken } from '@/lib/adminAuth';
import {
  exportReservationsCsv,
  normalizeReservationExportFilters,
} from '@/lib/admin/reservations-export';

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
    const { searchParams } = new URL(request.url);
    const filters = normalizeReservationExportFilters(searchParams);
    const result = await exportReservationsCsv(filters);
    const fileDate = new Date().toISOString().slice(0, 10);

    return new Response(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reservas-${fileDate}.csv"`,
        'Cache-Control': 'no-store',
        'X-Exported-Reservations': String(result.totalReservations),
        'X-Exported-At': result.generatedAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudieron exportar las reservas';
    const status = /no hay reservas/i.test(message)
      ? 404
      : /límite operativo|movimientos financieros/i.test(message)
        ? 413
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
