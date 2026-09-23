import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const id = String(orderId || '').trim();
  if (!id) return NextResponse.json({ error: 'Order inválida.' }, { status: 400 });

  const orderSnap = await getDoc(doc(db, 'orders', id));
  if (!orderSnap.exists()) {
    // #region debug-point E:order-read-miss
    fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'mp-webhook-order', runId: 'pre-fix', hypothesisId: 'E', location: 'app/api/orders/[orderId]/route.ts:GET:missing', msg: '[DEBUG] order read miss', data: { orderId: id }, ts: Date.now() }) }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: 'Order no encontrada.' }, { status: 404 });
  }

  const order = { id: orderSnap.id, ...(orderSnap.data() as any) };
  // #region debug-point E:order-read-hit
  fetch('http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'mp-webhook-order', runId: 'pre-fix', hypothesisId: 'E', location: 'app/api/orders/[orderId]/route.ts:GET:hit', msg: '[DEBUG] order read hit', data: { orderId: id, status: String((order as any)?.status ?? ''), paymentStatus: String((order as any)?.payment?.status ?? '') }, ts: Date.now() }) }).catch(() => {});
  // #endregion
  return NextResponse.json({ ok: true, order });
}
