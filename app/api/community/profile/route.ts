import { NextResponse } from 'next/server';
import { adminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import type { CommunityProfile } from '@/lib/community/types';

export const runtime = 'nodejs';

async function authenticate(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !adminAuth) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const decoded = await authenticate(request);
  if (!decoded) return NextResponse.json({ error: 'Sesión inválida o vencida.' }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'El servicio de perfiles no está disponible.' }, { status: 503 });

  const ref = db.collection('usuarios').doc(decoded.uid);
  const [snapshot, purchaseSnapshot, benefitSnapshot] = await Promise.all([
    ref.get(),
    db.collection('communityPurchaseEvents').where('uid', '==', decoded.uid).limit(100).get(),
    db.collection('beneficiosUsados').where('usuarioId', '==', decoded.uid).limit(100).get(),
  ]);
  if (!snapshot.exists) return NextResponse.json({ profile: null });
  const timestamp = (value: any) => {
    if (!value) return null;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };
  const purchases = purchaseSnapshot.docs.map((item) => {
    const data = item.data();
    const amountCents = Math.max(0, Number(data.amountCents ?? 0));
    const discountCents = Math.max(0, Number(data.discountCents ?? 0));
    return {
      id: item.id,
      orderId: String(data.orderId ?? ''),
      paymentId: String(data.paymentId ?? ''),
      amountCents,
      discountCents,
      discountName: data.discountName ? String(data.discountName) : null,
      promotionCode: data.promotionCode ? String(data.promotionCode) : null,
      originalAmountCents: discountCents > 0 ? amountCents + discountCents : amountCents,
      currency: String(data.currency ?? 'ARS'),
      reservationCount: Math.max(1, Number(data.reservationCount ?? 1)),
      packages: Array.isArray(data.packages) ? data.packages : [],
      recordedAt: timestamp(data.recordedAt),
    };
  }).sort((a, b) => String(b.recordedAt ?? '').localeCompare(String(a.recordedAt ?? '')));
  const purchaseByOrder = new Map(purchases.map((purchase) => [purchase.orderId, purchase]));
  const benefitsUsed = benefitSnapshot.docs.map((item) => {
    const data = item.data();
    const purchase = purchaseByOrder.get(String(data.pedidoId ?? ''));
    return {
      id: item.id,
      tipo: String(data.tipo ?? ''),
      nombre: String(data.nombre ?? data.detalle ?? 'Beneficio Explorarg'),
      codigo: data.codigo ? String(data.codigo) : null,
      montoOriginal: Math.max(0, Number(data.montoOriginal ?? 0)),
      montoDescuento: Math.max(0, Number(data.montoDescuento ?? 0)),
      montoFinal: Math.max(0, Number(data.montoFinal ?? 0)),
      moneda: String(data.moneda ?? 'ARS'),
      paquetes: Array.isArray(data.paquetes) ? data.paquetes : [],
      fechaUso: timestamp(data.fechaUso),
      // Redemption totals cover only the eligible package subtotal. Expose the
      // actual captured purchase total alongside it so the account history
      // agrees with the receipt, order and reservation views.
      compraTotalCents: purchase?.amountCents ?? null,
      compraMoneda: purchase?.currency ?? null,
    };
  }).sort((a, b) => String(b.fechaUso ?? '').localeCompare(String(a.fechaUso ?? '')));
  return NextResponse.json({ profile: snapshot.data(), purchases, benefitsUsed });
}

export async function POST(request: Request) {
  const decoded = await authenticate(request);
  if (!decoded) return NextResponse.json({ error: 'Sesión inválida o vencida.' }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'El servicio de perfiles no está disponible.' }, { status: 503 });

  let input: { nombre?: unknown; apellido?: unknown; telefono?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim().slice(0, 100) : '';
  const apellido = typeof input.apellido === 'string' ? input.apellido.trim().slice(0, 100) : '';
  const telefono = typeof input.telefono === 'string' ? input.telefono.trim().slice(0, 30) : '';
  if (nombre.length < 2) return NextResponse.json({ error: 'Ingresá tu nombre.' }, { status: 400 });
  if (apellido.length > 0 && apellido.length < 2) return NextResponse.json({ error: 'El apellido debe tener al menos 2 caracteres.' }, { status: 400 });

  const ref = db.collection('usuarios').doc(decoded.uid);
  const deletedProfile = await db.collection('communityDeletedUsers').doc(decoded.uid).get();
  if (deletedProfile.exists) return NextResponse.json({ error: 'Esta cuenta fue eliminada. Creá una cuenta nueva para volver a usar la comunidad.' }, { status: 410 });
  const snapshot = await ref.get();
  if (snapshot.exists) {
    // No permitir que el registro reescriba métricas, tier, rol ni fecha de alta.
    const existing = snapshot.data() as CommunityProfile;
    return NextResponse.json({ profile: existing });
  }

  const profile: CommunityProfile = {
    uid: decoded.uid,
    email: String(decoded.email ?? '').toLowerCase(),
    nombre,
    apellido,
    telefono: telefono || null,
    rol: 'cliente',
    activo: true,
    fechaRegistro: new Date().toISOString(),
    totalCompras: 0,
    totalGastado: 0,
    tier: 'bronce',
  };
  await ref.create(profile);
  return NextResponse.json({ profile }, { status: 201 });
}

export async function PATCH(request: Request) {
  const decoded = await authenticate(request);
  if (!decoded) return NextResponse.json({ error: 'Sesión inválida o vencida.' }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'El servicio de perfiles no está disponible.' }, { status: 503 });
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const apellido = typeof input.apellido === 'string' ? input.apellido.trim() : '';
  const telefono = typeof input.telefono === 'string' ? input.telefono.trim() : '';
  if (nombre.length < 2 || nombre.length > 100) return NextResponse.json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' }, { status: 400 });
  if (apellido.length < 2 || apellido.length > 100) return NextResponse.json({ error: 'El apellido debe tener entre 2 y 100 caracteres.' }, { status: 400 });
  if (telefono.length > 30) return NextResponse.json({ error: 'El teléfono no puede superar 30 caracteres.' }, { status: 400 });
  const ref = db.collection('usuarios').doc(decoded.uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: 'No existe el perfil de comunidad.' }, { status: 404 });
  if (snapshot.data()?.activo === false) return NextResponse.json({ error: 'La cuenta de comunidad está desactivada.' }, { status: 403 });
  await ref.update({ nombre, apellido, telefono: telefono || null, perfilActualizadoAt: new Date().toISOString() });
  const updated = await ref.get();
  return NextResponse.json({ profile: updated.data() });
}
