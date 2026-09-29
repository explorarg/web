import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';

/** Idempotently synchronizes paid reservation counts into the community profile. */
export async function recordCommunityPurchase(input: {
  uid?: string | null;
  orderId: string;
  paymentId: string;
  amountCents: number;
  discountCents?: number;
  discountName?: string | null;
  promotionCode?: string | null;
  originalAmountCents?: number;
  currency: string;
  reservationCount: number;
  packages?: Array<{ title: string; date?: string; people?: number }>;
}) {
  const uid = String(input.uid ?? '').trim();
  if (!uid) return { recorded: false, reason: 'not-a-member' as const };
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no está disponible para registrar la compra comunitaria.');
  const orderId = String(input.orderId || input.paymentId).trim();
  const eventId = createHash('sha256').update(`${uid}:${orderId}`).digest('hex');
  const profileRef = db.collection('usuarios').doc(uid);
  const eventRef = db.collection('communityPurchaseEvents').doc(eventId);
  const currency = String(input.currency || 'ars').toUpperCase();
  const amount = Math.max(0, Math.round(input.amountCents || 0));
  const count = Math.max(1, Math.floor(input.reservationCount || 1));
  const recordedAt = Timestamp.now();

  return db.runTransaction(async transaction => {
    const [eventSnap, profileSnap] = await Promise.all([transaction.get(eventRef), transaction.get(profileRef)]);
    if (eventSnap.exists) return { recorded: false, reason: 'already-recorded' as const };
    if (!profileSnap.exists) return { recorded: false, reason: 'profile-not-found' as const };
    const profile = profileSnap.data() ?? {};
    const byCurrency: Record<string, number> = profile.totalGastadoPorMoneda && typeof profile.totalGastadoPorMoneda === 'object'
      ? { ...profile.totalGastadoPorMoneda }
      : {};
    byCurrency[currency] = Math.max(0, Number(byCurrency[currency] ?? 0)) + amount;
    transaction.update(profileRef, {
      totalCompras: Math.max(0, Number(profile.totalCompras ?? 0)) + count,
      cantidadReservas: Math.max(0, Number(profile.cantidadReservas ?? 0)) + count,
      totalGastadoPorMoneda: byCurrency,
      // Keep the legacy aggregate in ARS only; never sum incomparable currencies.
      ...(currency === 'ARS' ? { totalGastado: Math.max(0, Number(profile.totalGastado ?? 0)) + amount } : {}),
      ultimaCompraAt: recordedAt,
    });
    transaction.create(eventRef, {
      uid,
      orderId,
      paymentId: String(input.paymentId),
      amountCents: amount,
      discountCents: Math.max(0, Math.round(input.discountCents ?? 0)),
      discountName: String(input.discountName ?? '').trim() || null,
      promotionCode: String(input.promotionCode ?? '').trim().toUpperCase() || null,
      originalAmountCents: Math.max(amount, Math.round(input.originalAmountCents ?? amount)),
      currency,
      reservationCount: count,
      packages: (input.packages ?? []).slice(0, 50),
      recordedAt,
    });
    return { recorded: true, reason: 'recorded' as const };
  });
}
