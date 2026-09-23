import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cartId: string }> }
) {
  const { cartId } = await params;
  const id = String(cartId || '').trim();
  if (!id) return NextResponse.json({ error: 'Carrito inválido.' }, { status: 400 });

  const cartSnap = await getDoc(doc(db, 'carts', id));
  if (!cartSnap.exists()) {
    return NextResponse.json({ error: 'Carrito no encontrado.' }, { status: 404 });
  }

  const cart: any = cartSnap.data();
  const orderId = cart.orderId ? String(cart.orderId) : '';
  if (!orderId) {
    return NextResponse.json({ error: 'No hay order asociada a este carrito.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, orderId });
}

