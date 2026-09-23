import { NextResponse } from 'next/server';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/seat-layouts/:id] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }
  const snap = await getDoc(doc(db, 'seatLayouts', id));
  if (!snap.exists()) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  return NextResponse.json({ item: { id: snap.id, ...(snap.data() as any) } });
}

