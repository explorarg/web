import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { POST as processMercadoPagoWebhook } from '@/app/api/mercadopago/webhook/route';
import { searchPayments } from '@/lib/mercadopago';

export const runtime = 'nodejs';

const payloadSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().trim().optional(),
});

function getSearchResults(payload: any): any[] {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const orderId = String(parsed.data.orderId).trim();
  const requestedPaymentId = String(parsed.data.paymentId ?? '').trim();

  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) {
    return NextResponse.json({ error: 'Order no encontrada.' }, { status: 404 });
  }

  const order = { id: orderSnap.id, ...(orderSnap.data() as any) };
  if (String(order?.status ?? '') === 'paid') {
    return NextResponse.json({ ok: true, alreadyPaid: true, orderId });
  }

  let paymentId = requestedPaymentId || String(order?.payment?.paymentId ?? '').trim();
  const externalReference = String(order?.payment?.externalReference ?? '').trim();

  if (!paymentId && externalReference) {
    const payments = await searchPayments(externalReference).catch(() => null);
    const candidates = getSearchResults(payments);
    const approved = candidates.find((item) => String(item?.status ?? '').toLowerCase() === 'approved');
    const latest = approved ?? candidates[0];
    paymentId = String(latest?.id ?? '').trim();
  }

  if (!paymentId) {
    return NextResponse.json(
      { error: 'No encontramos un pago asociado para reconciliar esta orden.' },
      { status: 404 }
    );
  }

  const webhookRequest = new Request(new URL('/api/mercadopago/webhook', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: Date.now(),
      live_mode: true,
      type: 'payment',
      date_created: new Date().toISOString(),
      user_id: 0,
      api_version: 'v1',
      action: 'payment.updated',
      data: {
        id: paymentId,
      },
    }),
  });

  const response = await processMercadoPagoWebhook(webhookRequest);
  const result = await response.json().catch(() => null);
  return NextResponse.json(
    {
      ok: response.ok,
      orderId,
      paymentId,
      result,
    },
    { status: response.ok ? 200 : response.status }
  );
}
