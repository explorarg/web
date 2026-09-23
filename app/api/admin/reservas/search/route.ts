import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit as firestoreLimit, query, where } from 'firebase/firestore';
import { normalizeDigits, normalizeEmail } from '@/lib/reservas/code';
import { buildVentaStatuses } from '@/lib/sales/status';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().min(2).max(120),
  packageId: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  paymentMethod: z.string().min(1).optional(),
  seat: z.string().min(1).optional(),
});

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/reservas/search] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    packageId: url.searchParams.get('packageId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    paymentMethod: url.searchParams.get('paymentMethod') ?? undefined,
    seat: url.searchParams.get('seat') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos.', details: parsed.error }, { status: 400 });
  }

  const qText = parsed.data.q.trim();
  const qLower = qText.toLowerCase();
  const packageId = parsed.data.packageId ? String(parsed.data.packageId) : '';
  const date = parsed.data.date ? String(parsed.data.date) : '';
  const statusFilter = parsed.data.status ? String(parsed.data.status) : '';
  const paymentMethodFilter = parsed.data.paymentMethod ? String(parsed.data.paymentMethod) : '';
  const seatFilter = parsed.data.seat ? String(parsed.data.seat).trim() : '';

  const col = collection(db, 'reservas');
  const out: any[] = [];

  const qUpper = qText.toUpperCase();
  const qDigits = normalizeDigits(qText);
  const email = qLower.includes('@') ? normalizeEmail(qText) : null;

  const isReservationCode = qUpper.startsWith('EXPL-') || qUpper.startsWith('EXP-');
  const looksLikeOrderId = qText.startsWith('ord_') || (qText.length >= 20 && qText.includes('-'));

  const direct = await getDocs(query(col, where('reservationCode', '==', qUpper), firestoreLimit(10))).catch(() => null);
  if (direct && !direct.empty) {
    for (const d of direct.docs) out.push({ id: d.id, ...(d.data() as any) });
  }

  if (out.length === 0) {
    if (isReservationCode) {
      const snap = await getDocs(query(col, where('reservationCode', '==', qUpper), firestoreLimit(10)));
      for (const d of snap.docs) out.push({ id: d.id, ...(d.data() as any) });
    } else if (looksLikeOrderId) {
      const snap = await getDocs(query(col, where('orderId', '==', qText), firestoreLimit(20)));
      for (const d of snap.docs) out.push({ id: d.id, ...(d.data() as any) });
    } else if (email) {
      const snap1 = await getDocs(query(col, where('customerEmailLower', '==', email), firestoreLimit(40))).catch(() => null);
      if (snap1 && !snap1.empty) for (const d of snap1.docs) out.push({ id: d.id, ...(d.data() as any) });
      if (!snap1 || snap1.empty) {
        const snap2 = await getDocs(query(col, where('customerEmail', '==', email), firestoreLimit(40))).catch(() => null);
        if (snap2 && !snap2.empty) for (const d of snap2.docs) out.push({ id: d.id, ...(d.data() as any) });
      }
    } else if (qDigits && qDigits.length >= 6) {
      const snap1 = await getDocs(query(col, where('customerDocumentNormalized', '==', qDigits), firestoreLimit(40))).catch(() => null);
      if (snap1 && !snap1.empty) for (const d of snap1.docs) out.push({ id: d.id, ...(d.data() as any) });
      if (!snap1 || snap1.empty) {
        const snap2 = await getDocs(query(col, where('customerPhoneNormalized', '==', qDigits), firestoreLimit(40))).catch(() => null);
        if (snap2 && !snap2.empty) for (const d of snap2.docs) out.push({ id: d.id, ...(d.data() as any) });
      }
      if (out.length === 0) {
        const snap3 = await getDocs(query(col, where('mercadoPagoPaymentId', '==', qDigits), firestoreLimit(40))).catch(() => null);
        if (snap3 && !snap3.empty) for (const d of snap3.docs) out.push({ id: d.id, ...(d.data() as any) });
      }
    } else {
      const end = `${qText}\uf8ff`;
      const snap = await getDocs(query(col, where('customerName', '>=', qText), where('customerName', '<=', end), firestoreLimit(60))).catch(
        () => null
      );
      if (snap && !snap.empty) for (const d of snap.docs) out.push({ id: d.id, ...(d.data() as any) });
    }
  }

  const filtered = out
    .filter((r) => (packageId ? String(r.packageId ?? r.experienceId ?? '') === packageId : true))
    .filter((r) => (date ? String(r.date ?? '') === date : true))
    .filter((r) => (statusFilter ? String(r.status ?? '') === statusFilter : true))
    .filter((r) => (paymentMethodFilter ? String(r.paymentMethod ?? '') === paymentMethodFilter : true))
    .filter((r) => (seatFilter ? (Array.isArray(r.selectedSeats) ? r.selectedSeats.map((s: any) => String(s)).includes(seatFilter) : false) : true))
    .slice(0, 50)
    .map((r) => {
      const ventaStatuses = buildVentaStatuses(r as any);
      return {
        id: String(r.id),
        reservationCode: String(r.reservationCode ?? ''),
        customerName: String(r.customerName ?? ''),
        customerEmail: String(r.customerEmail ?? ''),
        status: String(r.status ?? ''),
        commercialStatus: ventaStatuses.commercialStatus,
        commercialStatusLabel: ventaStatuses.commercialStatusLabel,
        operationalStatus: ventaStatuses.operationalStatus,
        operationalStatusLabel: ventaStatuses.operationalStatusLabel,
        packageTitle: String(r.packageTitle ?? r.experienceTitle ?? ''),
        date: String(r.date ?? ''),
        people: Number(r.people ?? 0),
        paymentMethod: String(r.paymentMethod ?? ''),
        paymentStatus: ventaStatuses.paymentStatus,
        paymentStatusLabel: ventaStatuses.paymentStatusLabel,
        selectedSeats: Array.isArray(r.selectedSeats) ? r.selectedSeats.map((s: any) => String(s)) : null,
        amountTotal: Number(r.amountTotal ?? 0),
        currency: String(r.currency ?? ''),
        orderId: r.orderId ? String(r.orderId) : null,
        mercadoPagoPaymentId: r.mercadoPagoPaymentId ? String(r.mercadoPagoPaymentId) : null,
        vendorName: r.referredBy?.vendorName ? String(r.referredBy.vendorName) : null,
      };
    });

  return NextResponse.json({ items: filtered });
}
