import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { adminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { ADMIN_EMAIL } from '@/lib/constants';
import { releaseCommunityRedemption } from '@/lib/community/redemptions';

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

async function deleteMatchingDocuments(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  field: string,
  value: string,
) {
  let deleted = 0;
  while (true) {
    const snapshot = await db.collection(collectionName).where(field, '==', value).limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
}

export async function DELETE(request: Request) {
  const authError = await denied(request);
  if (authError) return authError;
  const db = getAdminDb();
  if (!db || !adminAuth) return NextResponse.json({ error: 'El servicio de comunidad no está disponible.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ uid: z.string().trim().min(1).max(128) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });

  const { uid } = parsed.data;
  const profileRef = db.collection('usuarios').doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) return NextResponse.json({ error: 'Miembro no encontrado.' }, { status: 404 });
  if (String(profileSnap.data()?.email ?? '').trim().toLowerCase() === ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No se puede eliminar la cuenta administradora desde el directorio de miembros.' }, { status: 403 });
  }

  const redemptions = await db.collection('communityRedemptions').where('uid', '==', uid).get();
  const activeRedemptions = redemptions.docs.filter((document) => document.data().status === 'reserved');
  const pendingRedemptions = activeRedemptions.filter((document) => {
    const expiry = document.data().expiresAt;
    const expiryMs = typeof expiry?.toMillis === 'function' ? expiry.toMillis() : new Date(expiry ?? 0).getTime();
    return Number.isFinite(expiryMs) && expiryMs > Date.now();
  });
  if (pendingRedemptions.length) {
    return NextResponse.json({
      error: 'No se puede eliminar todavía: el miembro tiene un pago pendiente con un beneficio reservado. Esperá a que el intento venza o se resuelva.',
      pendingPayments: pendingRedemptions.length,
    }, { status: 409 });
  }
  for (const redemption of activeRedemptions) {
    await releaseCommunityRedemption(redemption.id, 'member_deleted');
  }

  // Tombstone prevents an already-issued Firebase token from recreating this profile.
  const tombstoneRef = db.collection('communityDeletedUsers').doc(uid);
  await tombstoneRef.set({ deletedAt: Timestamp.now(), deletedBy: 'admin' });

  try {
    await adminAuth.deleteUser(uid);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code !== 'auth/user-not-found') {
      await tombstoneRef.delete().catch(() => {});
      return NextResponse.json({ error: 'No se pudo eliminar la cuenta de acceso. No se borraron los datos del miembro.' }, { status: 500 });
    }
  }

  try {
    await deleteMatchingDocuments(db, 'communityPurchaseEvents', 'uid', uid);
    await deleteMatchingDocuments(db, 'beneficiosUsados', 'usuarioId', uid);
    await deleteMatchingDocuments(db, 'communityPromotionUsage', 'uid', uid);
    await deleteMatchingDocuments(db, 'communityRedemptions', 'uid', uid);
    await profileRef.delete();
  } catch (error) {
    console.error('[admin/community-members] Partial member cleanup; retry deletion to finish.', { uid, error });
    return NextResponse.json({ error: 'La cuenta fue eliminada, pero no se pudieron limpiar todos los datos comunitarios. Volvé a intentar la eliminación para completar el proceso.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
