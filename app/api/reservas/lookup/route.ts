import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit as firestoreLimit, query, where } from 'firebase/firestore';
import { normalizeDigits, normalizeEmail } from '@/lib/reservas/code';
import { buildVentaStatuses } from '@/lib/sales/status';

export const runtime = 'nodejs';

const schema = z.object({
  code: z.string().min(1).max(80),
  email: z.string().email().optional(),
  document: z.string().min(3).max(40).optional(),
});

type RateState = { count: number; resetAt: number };

function getRateMap(): Map<string, RateState> {
  const g = globalThis as any;
  if (!g.__exploarg_res_lookup_rate) g.__exploarg_res_lookup_rate = new Map<string, RateState>();
  return g.__exploarg_res_lookup_rate as Map<string, RateState>;
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
  const limit = 12;
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

function maskEmail(email: string): string {
  const e = String(email ?? '').trim();
  const parts = e.split('@');
  if (parts.length !== 2) return '***';
  const [u, d] = parts;
  const u2 = u.length <= 2 ? `${u[0] ?? '*'}*` : `${u.slice(0, 2)}***`;
  const dParts = d.split('.');
  const d0 = dParts[0] ?? '';
  const dMasked = d0.length <= 2 ? `${d0[0] ?? '*'}*` : `${d0.slice(0, 2)}***`;
  return `${u2}@${dMasked}.${dParts.slice(1).join('.') || '*'}`;
}

function maskName(name: string): string {
  const n = String(name ?? '').trim();
  if (!n) return '—';
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const f = first ? `${first[0]}***` : '***';
  const l = last ? `${last[0]}***` : '';
  return l ? `${f} ${l}` : f;
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

export async function POST(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json({ ok: false, error: 'No pudimos verificar la reserva. Revisá los datos.' }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'No pudimos verificar la reserva. Revisá los datos.' }, { status: 400 });
  }

  const code = parsed.data.code.trim();
  const email = normalizeEmail(parsed.data.email);
  const docDigits = normalizeDigits(parsed.data.document);

  const reserva = await findReservationByCodeOrId(code);
  if (!reserva) {
    return NextResponse.json({ ok: false, error: 'No pudimos verificar la reserva. Revisá los datos.' }, { status: 200 });
  }

  const emailLower = normalizeEmail(reserva.customerEmailLower ?? reserva.customerEmail);
  const documentNormalized = normalizeDigits(reserva.customerDocumentNormalized ?? reserva.customerDocument);
  const hasIdentityFilter = Boolean(email || docDigits);
  const emailOk = email ? emailLower === email : false;
  const docOk = docDigits ? documentNormalized === docDigits : false;
  if (hasIdentityFilter && !emailOk && !docOk) {
    return NextResponse.json({ ok: false, error: 'No pudimos verificar la reserva. Revisá los datos.' }, { status: 200 });
  }

  const codeOut = String(reserva.reservationCode ?? '').trim() || null;
  const reservationId = String(reserva.id ?? '');
  const packageTitle = String(reserva.packageTitle ?? reserva.experienceTitle ?? 'Paquete');
  const departureDate = String(reserva.date ?? 'sin-fecha');
  const people = Number(reserva.people ?? 0);
  const selectedSeats = Array.isArray(reserva.selectedSeats) ? reserva.selectedSeats.map((s: any) => String(s)) : null;
  const amountTotal = Number(reserva.amountTotal ?? 0);
  const currency = String(reserva.currency ?? 'ARS').toUpperCase();
  const pricingBaseUnitAmount =
    typeof (reserva as any).pricingBaseUnitAmount === 'number' &&
    Number.isFinite((reserva as any).pricingBaseUnitAmount) &&
    Number((reserva as any).pricingBaseUnitAmount) > 0
      ? Math.round(Number((reserva as any).pricingBaseUnitAmount))
      : null;
  const originalPackageAmount =
    pricingBaseUnitAmount !== null && people > 0 ? pricingBaseUnitAmount * people : null;
  const ventaStatuses = buildVentaStatuses(reserva as any);

  return NextResponse.json({
    ok: true,
    reservation: {
      code: codeOut || reservationId,
      status: String(reserva.status ?? 'unknown'),
      paymentStatus: ventaStatuses.paymentStatus,
      paymentStatusLabel: ventaStatuses.paymentStatusLabel,
      commercialStatus: ventaStatuses.commercialStatus,
      commercialStatusLabel: ventaStatuses.commercialStatusLabel,
      operationalStatus: ventaStatuses.operationalStatus,
      operationalStatusLabel: ventaStatuses.operationalStatusLabel,
      voucherStatus: ventaStatuses.voucherStatus,
      customerEmailStatus: ventaStatuses.customerEmailStatus,
      publicState: ventaStatuses.publicState,
      packageTitle,
      departureDate,
      people,
      selectedSeats,
      pickupPoint: reserva.pickupPoint ? String(reserva.pickupPoint) : null,
      pickupPointTime: reserva.pickupPointTime ? String(reserva.pickupPointTime) : null,
      roomType: reserva.roomType ? String(reserva.roomType) : null,
      roomSelection: Array.isArray((reserva as any).roomSelection)
        ? (reserva as any).roomSelection.map((item: any) => ({
            roomType: String(item?.roomType ?? ''),
            quantity: Number(item?.quantity ?? 0),
          }))
        : [],
      selectedExtras: Array.isArray((reserva as any).selectedExtras)
        ? (reserva as any).selectedExtras.map((item: any) => ({
            code: String(item?.code ?? ''),
            label: String(item?.label ?? ''),
            amount: Number(item?.amount ?? 0),
            quantity: Number(item?.quantity ?? 1),
            categoryCode: item?.categoryCode ? String(item.categoryCode) : null,
            source: item?.source ? String(item.source) : null,
          }))
        : [],
      originalPackageAmount,
      amountTotal,
      currency,
      customerMasked: {
        name: maskName(String(reserva.customerName ?? '')),
        email: maskEmail(String(reserva.customerEmail ?? '')),
      },
      orderId: reserva.orderId ? String(reserva.orderId) : null,
      createdAt: reserva.createdAt ?? null,
    },
  });
}
