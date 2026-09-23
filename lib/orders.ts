import { db } from '@/lib/firebase';
import type { Order, OrderItemSnapshot, OrderStatus } from '@/types';
import type { QueryConstraint } from 'firebase/firestore';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';

export function orderExternalReference(orderId: string): string {
  return `order-${orderId}`;
}

export function normalizeOrderStatus(status: unknown): OrderStatus {
  const s = String(status ?? '');
  if (
    s === 'created' ||
    s === 'checkout_started' ||
    s === 'pending' ||
    s === 'paid' ||
    s === 'failed' ||
    s === 'cancelled' ||
    s === 'expired' ||
    s === 'needs_review'
  ) {
    return s;
  }
  return 'created';
}

export function computeOrderTotals(items: OrderItemSnapshot[]) {
  const amountTotal = (items ?? []).reduce(
    (sum, it) => sum + (typeof it.subtotalAmount === 'number' ? it.subtotalAmount : 0),
    0
  );
  return { amountTotal };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const ref = doc(db, 'orders', orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Order;
}

export async function getOrders(opts?: { limit?: number }): Promise<Order[]> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (opts?.limit && opts.limit > 0) {
    constraints.push(limitDocs(opts.limit));
  }

  const snap = await getDocs(query(collection(db, 'orders'), ...constraints));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) } as Order));
}

export async function markOrderUpdated(orderId: string): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), { updatedAt: Timestamp.now() }).catch(() => {});
}
