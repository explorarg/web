import { NextResponse } from 'next/server';
import { z } from 'zod';
import { collection, getDocs, limit as firestoreLimit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeDigits } from '@/lib/reservas/code';
import { buildVentaStatuses } from '@/lib/sales/status';

export const runtime = 'nodejs';

const schema = z.object({
  document: z.string().min(5).max(40),
});

type RateState = { count: number; resetAt: number };

function getRateMap(): Map<string, RateState> {
  const g = globalThis as { __exploarg_res_by_document_rate?: Map<string, RateState> };
  if (!g.__exploarg_res_by_document_rate) g.__exploarg_res_by_document_rate = new Map<string, RateState>();
  return g.__exploarg_res_by_document_rate;
}

function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwardedFor.split(',')[0]?.trim();
  if (ip) return ip;
  const realIp = request.headers.get('x-real-ip') ?? '';
  if (realIp) return realIp.trim();
  return 'unknown';
}

function allowRequest(request: Request): boolean {
  const key = getClientKey(request);
  const map = getRateMap();
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 20;
  const current = map.get(key);

  if (!current || current.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) return false;
  current.count += 1;
  map.set(key, current);
  return true;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (value as { seconds?: number }).seconds === 'number') {
    return ((value as { seconds: number }).seconds ?? 0) * 1000;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

function formatCode(reservation: Record<string, unknown>, fallbackId: string): string {
  const code = String(reservation.reservationCode ?? '').trim();
  return code || fallbackId;
}

export async function GET(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Demasiadas consultas. Intentá nuevamente en unos minutos.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    document: searchParams.get('document') ?? '',
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const digits = normalizeDigits(parsed.data.document);
  if (!digits || digits.length < 5) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const snap = await getDocs(
    query(collection(db, 'reservas'), where('customerDocumentNormalized', '==', digits), firestoreLimit(30))
  ).catch(() => null);

  if (!snap || snap.empty) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const results = snap.docs
    .map((docSnap) => {
      const reservation: Record<string, unknown> = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) };
      const statuses = buildVentaStatuses(reservation as any);
      const paid =
        statuses.commercialStatus === 'confirmed' ||
        statuses.paymentStatus === 'paid' ||
        statuses.paymentStatus === 'approved' ||
        String(reservation['status'] ?? '').toLowerCase() === 'completed';

      if (!paid) return null;

      return {
        id: docSnap.id,
        code: formatCode(reservation, docSnap.id),
        packageTitle: String(reservation['packageTitle'] ?? reservation['experienceTitle'] ?? 'Paquete'),
        packageSlug: reservation['packageSlug'] ? String(reservation['packageSlug']) : null,
        departureDate: String(reservation['date'] ?? 'sin-fecha'),
        people: Number(reservation['people'] ?? 0),
        paymentStatusLabel: statuses.paymentStatusLabel,
        createdAt: reservation['createdAt'] ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => toMillis((b as any)?.createdAt) - toMillis((a as any)?.createdAt))
    .slice(0, 6);

  return NextResponse.json({ ok: true, results });
}
