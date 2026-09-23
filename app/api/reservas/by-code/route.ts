import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit as firestoreLimit, orderBy, query, where } from 'firebase/firestore';
import { buildVentaStatuses } from '@/lib/sales/status';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().min(1).max(80),
});

type RateState = { count: number; resetAt: number };

function getRateMap(): Map<string, RateState> {
  const g = globalThis as any;
  if (!g.__exploarg_res_by_code_rate) g.__exploarg_res_by_code_rate = new Map<string, RateState>();
  return g.__exploarg_res_by_code_rate as Map<string, RateState>;
}

function getClientKey(request: Request): string {
  const xf = request.headers.get('x-forwarded-for') ?? '';
  const ip = xf.split(',')[0]?.trim();
  if (ip) return ip;
  const real = request.headers.get('x-real-ip') ?? '';
  if (real) return real.trim();
  return 'unknown';
}

function allowRequest(request: Request): boolean {
  const key = getClientKey(request);
  const map = getRateMap();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 18;
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  map.set(key, current);
  return true;
}

function normalizeCode(input: string): string {
  return String(input ?? '').trim().toUpperCase();
}

async function findReservationByCodeOrId(raw: string) {
  const code = String(raw ?? '').trim();
  if (!code) return null;
  const codeUp = normalizeCode(code);

  const direct = await getDoc(doc(db, 'reservas', code));
  if (direct.exists()) return { id: direct.id, ...(direct.data() as any) };

  const col = collection(db, 'reservas');

  const byCode = await getDocs(query(col, where('reservationCode', '==', codeUp), firestoreLimit(1)));
  if (!byCode.empty) return { id: byCode.docs[0].id, ...(byCode.docs[0].data() as any) };

  const byOrder = await getDocs(query(col, where('orderId', '==', code), firestoreLimit(1)));
  if (!byOrder.empty) return { id: byOrder.docs[0].id, ...(byOrder.docs[0].data() as any) };

  const byPayment = await getDocs(query(col, where('mercadoPagoPaymentId', '==', code), firestoreLimit(1)));
  if (!byPayment.empty) return { id: byPayment.docs[0].id, ...(byPayment.docs[0].data() as any) };

  return null;
}

/** Búsqueda por prefijo: permite encontrar la reserva con el código incompleto. */
async function findReservationsByPrefix(raw: string) {
  const term = normalizeCode(raw);
  if (!term) return [];

  const col = collection(db, 'reservas');
  const end = `${term}\uf8ff`;
  const found = new Map<string, any>();

  try {
    const byCode = await getDocs(
      query(
        col,
        orderBy('reservationCode'),
        where('reservationCode', '>=', term),
        where('reservationCode', '<=', end),
        firestoreLimit(10)
      )
    );
    byCode.docs.forEach((d) => found.set(d.id, { id: d.id, ...(d.data() as any) }));
  } catch {
    // sin índice disponible: se ignora el tramo por prefijo
  }

  if (found.size === 0 && raw.includes('@')) {
    const email = String(raw).trim().toLowerCase();
    try {
      const byEmail = await getDocs(query(col, where('email', '==', email), firestoreLimit(10)));
      byEmail.docs.forEach((d) => found.set(d.id, { id: d.id, ...(d.data() as any) }));
    } catch {
      // ignorado
    }
  }

  return Array.from(found.values());
}

function toResult(reserva: any) {
  const statuses = buildVentaStatuses(reserva);
  const reservationId = String(reserva?.id ?? '');
  return {
    id: reservationId,
    code: String(reserva?.reservationCode ?? '').trim() || reservationId,
    packageTitle: String(reserva?.packageTitle ?? reserva?.experienceTitle ?? 'Paquete'),
    packageSlug: reserva?.packageSlug ? String(reserva.packageSlug) : null,
    departureDate: String(reserva?.date ?? 'sin-fecha'),
    people: Number(reserva?.people ?? 0),
    paymentStatus: statuses.paymentStatus,
    paymentStatusLabel: statuses.paymentStatusLabel,
  };
}

export async function GET(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Demasiadas consultas. Intentá nuevamente en unos minutos.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    code: searchParams.get('code') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const code = parsed.data.code.trim();
  if (!code || code.length < 3) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const exact = await findReservationByCodeOrId(code);
  const candidates = exact ? [exact] : await findReservationsByPrefix(code);
  const results = candidates.map(toResult);

  return NextResponse.json({ ok: true, results });
}

