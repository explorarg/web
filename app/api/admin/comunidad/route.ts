import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const benefitSchema = z.object({
  kind: z.literal('benefit'),
  nombre: z.string().trim().min(2).max(100),
  descripcion: z.string().trim().max(500).default(''),
  tipo: z.enum(['bienvenida', 'fidelidad', 'volumen', 'temporal', 'segunda_compra', 'tier', 'referido', 'exclusivo', 'personalizado']),
  tipoDescuento: z.enum(['porcentaje', 'monto_fijo']),
  valorDescuento: z.number().positive().max(100000000),
  prioridad: z.number().int().min(0).max(100).default(50),
  usosMaximos: z.number().int().positive().nullable().default(null),
  usosPorUsuario: z.number().int().positive().max(100).default(1),
  condiciones: z.array(z.object({
    campo: z.enum(['totalCompras', 'totalGastado', 'cantidadReservas', 'diasDesdeRegistro', 'cantidadReferidos', 'tier', 'primeraCompra', 'esSegundoPaquete']),
    operador: z.enum(['==', '!=', '>', '<', '>=', '<=', 'in']),
    valor: z.union([z.string().max(30), z.number().finite(), z.boolean()]),
  })).max(5).default([]),
  fechaInicio: z.string().datetime().nullable().default(null),
  fechaFin: z.string().datetime().nullable().default(null),
});

const couponSchema = z.object({
  kind: z.literal('coupon'),
  codigo: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/),
  descripcion: z.string().trim().max(500).default(''),
  tipoDescuento: z.enum(['porcentaje', 'monto_fijo']),
  valor: z.number().positive().max(100000000),
  usosTotales: z.number().int().positive().nullable().default(null),
  usosPorUsuario: z.number().int().positive().max(100).default(1),
  montoMinimoCompra: z.number().nonnegative().nullable().default(null),
  fechaInicio: z.string().datetime().nullable().default(null),
  fechaFin: z.string().datetime().nullable().default(null),
});

const updateSchema = z.object({
  kind: z.enum(['benefit', 'coupon']),
  id: z.string().min(1),
  activo: z.boolean().optional(),
  nombre: z.string().trim().min(2).max(100).optional(),
  codigo: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  descripcion: z.string().trim().max(500).optional(),
  tipo: z.enum(['bienvenida', 'fidelidad', 'volumen', 'temporal', 'segunda_compra', 'tier', 'referido', 'exclusivo', 'personalizado']).optional(),
  tipoDescuento: z.enum(['porcentaje', 'monto_fijo']).optional(),
  valorDescuento: z.number().positive().max(100000000).optional(),
  valor: z.number().positive().max(100000000).optional(),
  prioridad: z.number().int().min(0).max(100).optional(),
  usosMaximos: z.number().int().positive().nullable().optional(),
  usosTotales: z.number().int().positive().nullable().optional(),
  usosPorUsuario: z.number().int().positive().max(100).optional(),
  condiciones: z.array(z.object({
    campo: z.enum(['totalCompras', 'totalGastado', 'cantidadReservas', 'diasDesdeRegistro', 'cantidadReferidos', 'tier', 'primeraCompra', 'esSegundoPaquete']),
    operador: z.enum(['==', '!=', '>', '<', '>=', '<=', 'in']),
    valor: z.union([z.string().max(30), z.number().finite(), z.boolean()]),
  })).max(5).optional(),
  montoMinimoCompra: z.number().nonnegative().nullable().optional(),
});

async function authorize(request: Request) {
  try {
    await requireAdminToken(request);
    return null;
  } catch {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
}

function serializeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const raw = doc.data();
  return {
    id: doc.id,
    ...raw,
    fechaCreacion: raw.fechaCreacion?.toDate?.().toISOString?.() ?? null,
    fechaInicio: raw.fechaInicio?.toDate?.().toISOString?.() ?? null,
    fechaFin: raw.fechaFin?.toDate?.().toISOString?.() ?? null,
  };
}

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });

  const [benefitSnap, couponSnap, usersCount] = await Promise.all([
    db.collection('beneficios').orderBy('fechaCreacion', 'desc').limit(200).get(),
    db.collection('cupones').orderBy('fechaCreacion', 'desc').limit(200).get(),
    db.collection('usuarios').count().get(),
  ]);
  return NextResponse.json({
    beneficios: benefitSnap.docs.map(serializeDoc),
    cupones: couponSnap.docs.map(serializeDoc),
    usuarios: usersCount.data().count,
  });
}

export async function POST(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });

  const payload = await request.json().catch(() => null);
  const parsed = payload?.kind === 'coupon' ? couponSchema.safeParse(payload) : benefitSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }, { status: 400 });

  const now = Timestamp.now();
  if (parsed.data.kind === 'benefit') {
    if (parsed.data.tipoDescuento === 'porcentaje' && parsed.data.valorDescuento > 100) {
      return NextResponse.json({ error: 'El porcentaje debe ser como máximo 100.' }, { status: 400 });
    }
    const { kind: _kind, fechaInicio, fechaFin, ...data } = parsed.data;
    const ref = db.collection('beneficios').doc();
    await ref.create({
      ...data,
      activo: false,
      visible: true,
      usosActuales: 0,
      usosReservados: 0,
      condiciones: data.condiciones,
      fechaInicio: fechaInicio ? Timestamp.fromDate(new Date(fechaInicio)) : null,
      fechaFin: fechaFin ? Timestamp.fromDate(new Date(fechaFin)) : null,
      fechaCreacion: now,
      ultimaModificacion: now,
    });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  }

  if (parsed.data.tipoDescuento === 'porcentaje' && parsed.data.valor > 100) {
    return NextResponse.json({ error: 'El porcentaje debe ser como máximo 100.' }, { status: 400 });
  }
  const { kind: _kind, fechaInicio, fechaFin, codigo, ...data } = parsed.data;
  const normalizedCode = codigo.toUpperCase();
  const ref = db.collection('cupones').doc(normalizedCode);
  const existing = await ref.get();
  if (existing.exists) return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 409 });
  await ref.create({
    ...data,
    codigo: normalizedCode,
    activo: false,
    usosActuales: 0,
    usosReservados: 0,
    fechaInicio: fechaInicio ? Timestamp.fromDate(new Date(fechaInicio)) : now,
    fechaFin: fechaFin ? Timestamp.fromDate(new Date(fechaFin)) : null,
    fechaCreacion: now,
  });
  return NextResponse.json({ id: ref.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });

  const collectionName = parsed.data.kind === 'benefit' ? 'beneficios' : 'cupones';
  const ref = db.collection(collectionName).doc(parsed.data.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: 'No se encontró el registro.' }, { status: 404 });
  const { kind, id, ...changes } = parsed.data;
  if (changes.tipoDescuento === 'porcentaje') {
    const percentage = changes.valorDescuento ?? changes.valor;
    if (percentage !== undefined && percentage > 100) return NextResponse.json({ error: 'El porcentaje debe ser como máximo 100.' }, { status: 400 });
  }
  if (kind === 'coupon' && changes.codigo && changes.codigo.toUpperCase() !== id) {
    return NextResponse.json({ error: 'El código del cupón no se puede cambiar después de crearlo.' }, { status: 400 });
  }
  await ref.update({ ...changes, ...(kind === 'coupon' && changes.codigo ? { codigo: changes.codigo.toUpperCase() } : {}), ultimaModificacion: Timestamp.now() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'Firebase Admin no está disponible.' }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = z.object({ kind: z.enum(['benefit', 'coupon']), id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  const collectionName = parsed.data.kind === 'benefit' ? 'beneficios' : 'cupones';
  const ref = db.collection(collectionName).doc(parsed.data.id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: 'No se encontró el registro.' }, { status: 404 });
  if (Number(snapshot.data()?.usosActuales ?? 0) > 0 || Number(snapshot.data()?.usosReservados ?? 0) > 0) return NextResponse.json({ error: 'No se puede eliminar una promoción usada o reservada por un pago pendiente; desactivalo para conservar su historial.' }, { status: 409 });
  await ref.delete();
  return NextResponse.json({ ok: true });
}
