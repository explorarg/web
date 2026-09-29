import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function denied(request: Request) {
  try { await requireAdminToken(request); return null; }
  catch { return NextResponse.json({ error: 'No autorizado.' }, { status: 401 }); }
}

export async function GET(request: Request) {
  const authError = await denied(request);
  if (authError) return authError;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });
  const snapshot = await db.collection('usuarios').orderBy('fechaRegistro', 'desc').limit(500).get();
  const miembros = snapshot.docs.map(doc => {
    const data = doc.data();
    const fecha = typeof data.fechaRegistro?.toDate === 'function'
      ? data.fechaRegistro.toDate()
      : data.fechaRegistro ? new Date(data.fechaRegistro) : null;
    return {
      uid: doc.id,
      email: String(data.email ?? ''),
      nombre: String(data.nombre ?? ''),
      apellido: String(data.apellido ?? ''),
      telefono: data.telefono ? String(data.telefono) : null,
      activo: data.activo !== false,
      tier: ['bronce', 'plata', 'oro', 'platino'].includes(data.tier) ? data.tier : 'bronce',
      tierAsignadoManual: data.tierAsignadoManual === true,
      totalCompras: Math.max(0, Number(data.totalCompras ?? 0)),
      totalGastado: Math.max(0, Number(data.totalGastado ?? 0)),
      fechaRegistro: fecha instanceof Date ? fecha.toISOString() : null,
    };
  });
  return NextResponse.json({ miembros });
}

export async function PATCH(request: Request) {
  const authError = await denied(request);
  if (authError) return authError;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({
    uid: z.string().min(1),
    activo: z.boolean().optional(),
    tier: z.enum(['bronce', 'plata', 'oro', 'platino']).optional(),
  }).refine(value => value.activo !== undefined || value.tier !== undefined).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const ref = db.collection('usuarios').doc(parsed.data.uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: 'Miembro no encontrado.' }, { status: 404 });
  await ref.update({
    ...(parsed.data.activo !== undefined ? { activo: parsed.data.activo } : {}),
    ...(parsed.data.tier ? { tier: parsed.data.tier, tierAsignadoManual: true } : {}),
    ultimaModificacion: Timestamp.now(),
  });
  return NextResponse.json({ ok: true });
}
