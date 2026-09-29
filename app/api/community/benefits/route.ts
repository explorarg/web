import { NextResponse } from 'next/server';
import { adminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { evaluateBenefits, type BenefitForEvaluation } from '@/lib/community/engine';

export const runtime = 'nodejs';

function dateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !adminAuth) return NextResponse.json({ error: 'Sesión inválida o vencida.' }, { status: 401 });
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(token)).uid; }
  catch { return NextResponse.json({ error: 'Sesión inválida o vencida.' }, { status: 401 }); }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'El servicio de comunidad no está disponible.' }, { status: 503 });
  const [profileSnap, benefitsSnap, usageSnap] = await Promise.all([
    db.collection('usuarios').doc(uid).get(),
    db.collection('beneficios').where('activo', '==', true).limit(200).get(),
    db.collection('beneficiosUsados').where('usuarioId', '==', uid).get(),
  ]);
  if (!profileSnap.exists) return NextResponse.json({ error: 'No existe un perfil de comunidad.' }, { status: 404 });
  const rawProfile = profileSnap.data() ?? {};
  if (rawProfile.activo === false) return NextResponse.json({ error: 'La cuenta de comunidad está desactivada.' }, { status: 403 });
  const user = {
    totalCompras: Math.max(0, Number(rawProfile.totalCompras ?? 0)),
    totalGastado: Math.max(0, Number(rawProfile.totalGastado ?? 0)),
    cantidadReservas: Math.max(0, Number(rawProfile.cantidadReservas ?? 0)),
    cantidadReferidos: Math.max(0, Number(rawProfile.cantidadReferidos ?? 0)),
    tier: String(rawProfile.tier ?? 'bronce'),
    diasDesdeRegistro: Math.max(0, Math.floor((Date.now() - (dateValue(rawProfile.fechaRegistro)?.getTime() ?? Date.now())) / 86_400_000)),
  };
  const usedByBenefit: Record<string, number> = {};
  for (const usage of usageSnap.docs) {
    const id = String(usage.data().beneficioId ?? '');
    if (id) usedByBenefit[id] = (usedByBenefit[id] ?? 0) + 1;
  }
  const benefits = benefitsSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      fechaInicio: dateValue(data.fechaInicio),
      fechaFin: dateValue(data.fechaFin),
    } as BenefitForEvaluation;
  });
  // Se evalúa a modo de elegibilidad/preview. El importe final se debe recalcular
  // sobre precios autoritativos al crear el checkout.
  const result = evaluateBenefits({
    benefits,
    user,
    usedByBenefit,
    subtotalCents: 1_000_000,
    currency: 'ARS',
    maxBenefits: 1,
  });
  const eligibleIds = new Set(result.descuentos.map(item => item.id));
  const available = benefits.filter(item => eligibleIds.has(item.id)).map(item => ({
    id: item.id,
    nombre: item.nombre,
    descripcion: item.descripcion ?? '',
    tipo: item.tipo,
    tipoDescuento: item.config?.tipoDescuento ?? item.tipoDescuento,
    valorDescuento: item.config?.valorDescuento ?? item.valorDescuento,
    fechaFin: item.fechaFin?.toISOString() ?? null,
  }));
  return NextResponse.json({ beneficios: available });
}
