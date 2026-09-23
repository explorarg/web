import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const schema = z.object({
  reservationIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (e) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const ids = parsed.data.reservationIds;
  try {
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(db, 'reservas', id), {
          'referredBy.payoutStatus': 'paid',
          'referredBy.payoutAt': Timestamp.now(),
          updatedAt: Timestamp.now(),
        }).catch(() => null)
      )
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }
}
