import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/firebase';
import { CART_COOKIE_NAME, getHoldMinutes, toMillis } from '@/lib/cart/server';
import { CART_TERMS_COOKIE_NAME, hasAcceptedCartTerms } from '@/lib/cart/terms';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

export const runtime = 'nodejs';

function isExpired(expiresAt: unknown): boolean {
  const ms = toMillis(expiresAt);
  return ms > 0 && ms <= Date.now();
}

async function getCartItems(cartId: string) {
  const itemsCol = collection(db, 'carts', cartId, 'items');
  const q = query(itemsCol, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function GET(request: NextRequest) {
  const cartIdFromCookie = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  const now = Timestamp.now();
  const holdMinutes = getHoldMinutes();

  if (!cartIdFromCookie) {
    const newRef = doc(collection(db, 'carts'));
    await setDoc(newRef, {
      status: 'active',
      currency: 'ars',
      referral: null,
      expiresAt: Timestamp.fromMillis(now.toMillis() + holdMinutes * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const res = NextResponse.json({
      cart: { id: newRef.id, status: 'active', expiresAtMs: now.toMillis() + holdMinutes * 60 * 1000, termsAccepted: false },
      items: [],
    });
    res.cookies.set(CART_COOKIE_NAME, newRef.id, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res;
  }

  const cartRef = doc(db, 'carts', cartIdFromCookie);
  const cartSnap = await getDoc(cartRef);
  if (!cartSnap.exists()) {
    const newRef = doc(collection(db, 'carts'));
    await setDoc(newRef, {
      status: 'active',
      currency: 'ars',
      referral: null,
      expiresAt: Timestamp.fromMillis(now.toMillis() + holdMinutes * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const res = NextResponse.json({
      cart: { id: newRef.id, status: 'active', expiresAtMs: now.toMillis() + holdMinutes * 60 * 1000, termsAccepted: false },
      items: [],
    });
    res.cookies.set(CART_COOKIE_NAME, newRef.id, { httpOnly: true, sameSite: 'lax', path: '/' });
    return res;
  }

  const cart = { id: cartSnap.id, ...(cartSnap.data() as any) };
  const items = await getCartItems(cart.id);

  const activeItemExpires = items
    .filter((it) => (it.holdStatus ?? 'active') === 'active' && !isExpired(it.expiresAt))
    .map((it) => toMillis(it.expiresAt))
    .filter((ms) => ms > 0);
  const computedExpiresAtMs = activeItemExpires.length ? Math.min(...activeItemExpires) : toMillis(cart.expiresAt);
  const cartExpired = isExpired(cart.expiresAt) || (computedExpiresAtMs > 0 && computedExpiresAtMs <= Date.now());

  if (cartExpired && cart.status !== 'expired') {
    await updateDoc(cartRef, { status: 'expired', updatedAt: now });
    cart.status = 'expired';
  }

  if (computedExpiresAtMs > 0 && computedExpiresAtMs !== toMillis(cart.expiresAt)) {
    await updateDoc(cartRef, { expiresAt: Timestamp.fromMillis(computedExpiresAtMs), updatedAt: now });
    cart.expiresAt = Timestamp.fromMillis(computedExpiresAtMs);
  }

  const amountTotal = items.reduce((sum, it) => sum + (typeof it.subtotalAmount === 'number' ? it.subtotalAmount : 0), 0);

  return NextResponse.json({
    cart: {
      ...cart,
      amountTotal,
      expiresAtMs: toMillis(cart.expiresAt),
      termsAccepted: hasAcceptedCartTerms(request.cookies.get(CART_TERMS_COOKIE_NAME)?.value, cart.id),
    },
    items: items.map((it) => ({
      ...it,
      expiresAtMs: toMillis(it.expiresAt),
      isExpired: isExpired(it.expiresAt),
      isInvalid: (it.holdStatus ?? 'active') !== 'active' || isExpired(it.expiresAt),
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const cartId = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (!cartId) {
    return NextResponse.json({ ok: true });
  }
  const cartRef = doc(db, 'carts', cartId);
  const now = Timestamp.now();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(cartRef);
    if (!snap.exists()) return;
    tx.update(cartRef, { status: 'cancelled', updatedAt: now });
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CART_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set(CART_TERMS_COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}

