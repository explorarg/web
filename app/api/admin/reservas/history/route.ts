import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getReservasByCustomerEmail } from '@/lib/reservas';
import { requireAdminToken } from '@/lib/adminAuth';

const querySchema = z.object({
  email: z.string().email(),
});

export async function GET(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/reservas/history] Token inválido', error);
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = querySchema.safeParse({
    email: url.searchParams.get('email') ?? '',
  });
  if (!result.success) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  try {
    const reservations = await getReservasByCustomerEmail(result.data.email);
    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('[admin/reservas/history] Error consultando historial:', error);
    return NextResponse.json({ error: 'No pudimos obtener el historial' }, { status: 500 });
  }
}
