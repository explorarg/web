import { NextResponse } from 'next/server';
import { getPayment, searchPayments, mapPaymentStatusToReservationStatus, isPaymentApproved, isPaymentRejected } from '@/lib/mercadopago';
import { getFromEmail } from '@/lib/resend';
import { getPaqueteById } from '@/lib/paquetes';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import {
  buildClienteCompraConfirmadaHtml,
  buildClienteCompraConfirmadaText,
  buildClienteVoucher48hsHtml,
  buildClienteVoucher48hsText,
  buildAdminNuevaReservaHtml,
  buildAdminNuevaReservaText,
} from '@/lib/emails/reserva-confirmada';
import { db } from '@/lib/firebase';
import { resolveReferralFromCode, computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import type { SeatLayoutTemplate } from '@/types';
import {
  generateReservationCode,
  normalizeDigits,
  normalizeEmail,
  prepareNextReservationCodeInTransaction,
  reserveNextReservationCodeInTransaction,
} from '@/lib/reservas/code';
import { getReservationExtrasAmount, getReservationOfficialBaseAmount } from '@/lib/reservas/pricing';
import { buildDefaultEmailDelivery, buildQueuedEmailDelivery } from '@/lib/sales/status';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { recordCommunityPurchase } from '@/lib/community/purchases';
import { confirmCommunityRedemption, extendCommunityRedemption, releaseCommunityRedemption } from '@/lib/community/redemptions';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  arrayUnion,
  limit as firestoreLimit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

export const runtime = 'nodejs';

// Tipos de notificaciones de Mercado Pago
type MPNotification = {
  id: number;
  live_mode: boolean;
  type: 'payment' | 'merchant_order' | 'subscription' | 'invoice' | 'point_integration_wh';
  date_created: string;
  user_id: number;
  api_version: string;
  action: 'payment.created' | 'payment.updated' | 'payment.cancelled' | string;
  data: {
    id: string;
  };
};

function buildNotificationFromRequest(params: {
  body: unknown;
  searchParams: URLSearchParams;
}): MPNotification | null {
  const body = (params.body && typeof params.body === 'object' ? params.body : {}) as Record<string, any>;
  const searchParams = params.searchParams;

  const type =
    String(
      body.type ??
        body.topic ??
        searchParams.get('type') ??
        searchParams.get('topic') ??
        ''
    ).trim() || null;

  const paymentId =
    String(
      body?.data?.id ??
        body['data.id'] ??
        searchParams.get('data.id') ??
        searchParams.get('id') ??
        ''
    ).trim() || null;

  if (!type || !paymentId) return null;

  return {
    id: Number(body.id ?? searchParams.get('id') ?? Date.now()),
    live_mode: Boolean(body.live_mode ?? true),
    type: type as MPNotification['type'],
    date_created: String(body.date_created ?? new Date().toISOString()),
    user_id: Number(body.user_id ?? 0),
    api_version: String(body.api_version ?? 'v1'),
    action: String(body.action ?? `${type}.updated`),
    data: {
      id: paymentId,
    },
  };
}

function getPendingPaymentExpiresAt() {
  const raw = process.env.PENDING_HOLD_MINUTES;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const minutes = Number.isFinite(parsed) && parsed >= 5 && parsed <= 1440 ? parsed : 60;
  return new Date(Date.now() + minutes * 60 * 1000);
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  const anyValue = value as any;
  if (typeof anyValue?.toMillis === 'function') return anyValue.toMillis();
  if (typeof anyValue?.seconds === 'number') return anyValue.seconds * 1000;
  return 0;
}

function formatAmount(amountTotal: number, currency: string): string {
  const value = amountTotal / 100;
  const normalized = String(currency || 'ARS').toUpperCase();
  const locale = normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalized, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${normalized} ${value.toFixed(2)}`;
  }
}

function formatDate(date: string): string {
  if (!date || date === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function computeVoucherNextAttemptAt(params: {
  date: string;
  pickupPointTime?: string | null;
  now: Timestamp;
}): Timestamp {
  const date = String(params.date ?? '').trim();
  const time = String(params.pickupPointTime ?? '').trim();
  if (!date || date === 'sin-fecha') return params.now;
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const ts = new Date(`${date}T${hhmm}:00-03:00`).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return params.now;
  const dueMs = ts - 48 * 60 * 60 * 1000;
  const nowMs = params.now.toMillis();
  if (dueMs <= nowMs + 30 * 1000) return params.now;
  return Timestamp.fromMillis(dueMs);
}

function getBaseCapacityForDate(
  paquete: Awaited<ReturnType<typeof getPaqueteById>> | null,
  date: string
): number {
  if (!paquete) return 0;
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

async function recordMPNotification(params: {
  notificationId: string;
  type: string;
  action: string;
  paymentId?: string;
  externalReference?: string;
  status: 'received' | 'processed' | 'ignored' | 'failed';
  reason?: string | null;
  reservationId?: string | null;
  error?: string | null;
}) {
  try {
    await setDoc(
      doc(db, 'mercadoPagoNotifications', params.notificationId),
      {
        ...params,
        processedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch {
    // no-op: no crítico
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => null);
    const notification = buildNotificationFromRequest({ body, searchParams: url.searchParams });

    // Validar que sea una notificación válida
    if (!notification || !notification.type || !notification.data?.id) {
      return NextResponse.json({ error: 'Notificación inválida' }, { status: 400 });
    }

    const notificationId = `mp_${notification.id}_${notification.date_created || Date.now()}`;

    // Solo procesamos notificaciones de tipo payment
    if (notification.type !== 'payment') {
      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        status: 'ignored',
        reason: 'not_payment_type',
      });
      return NextResponse.json({ received: true });
    }

    // Obtener información del pago desde Mercado Pago
    const paymentId = notification.data.id;
    let paymentInfo: any;
    
    try {
      paymentInfo = await getPayment(String(paymentId));
    } catch (error) {
      console.error('[mercadopago-webhook] Error obteniendo pago:', error);
      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        paymentId: String(paymentId),
        status: 'failed',
        reason: 'fetch_payment_error',
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Error obteniendo pago' }, { status: 500 });
    }

    if (!paymentInfo || !paymentInfo.external_reference) {
      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        paymentId: String(paymentId),
        status: 'ignored',
        reason: 'no_external_reference',
      });
      return NextResponse.json({ received: true });
    }

    const externalReference = paymentInfo.external_reference || '';
    const paymentStatus = paymentInfo.status;
    const isApproved = isPaymentApproved(paymentStatus);

    let orderIdFromRef = '';
    const externalRefStr = String(externalReference || '');
    if (externalRefStr.startsWith('order-')) {
      orderIdFromRef = externalRefStr.slice('order-'.length);
    }

    let orderData: any = null;
    if (orderIdFromRef) {
      const orderSnap = await getDoc(doc(db, 'orders', orderIdFromRef));
      if (orderSnap.exists()) {
        orderData = { id: orderSnap.id, ...(orderSnap.data() as any) };
      }
    }

    let intentData: any = null;
    let intentId = '';
    if (orderData?.checkoutIntentId) {
      const iSnap = await getDoc(doc(db, 'checkoutIntents', String(orderData.checkoutIntentId)));
      if (iSnap.exists()) {
        intentId = iSnap.id;
        intentData = iSnap.data();
      }
    }
    
    try {
      if (!intentData) {
        const col = collection(db, 'checkoutIntents');
        const q = query(col, where('externalReference', '==', externalReference), firestoreLimit(1));
        const snap = await getDocs(q);
        const d0 = snap.docs[0];
        if (d0) {
          intentId = d0.id;
          intentData = d0.data();
        }
      }
    } catch {
      // no-op
    }

    if (!intentData) {
      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        paymentId: String(paymentId),
        externalReference,
        status: 'ignored',
        reason: 'intent_not_found',
      });
      return NextResponse.json({ received: true });
    }

    const cartId = orderData?.cartId ?? intentData.cartId;
    const cartItems = Array.isArray(orderData?.items) ? orderData.items : (Array.isArray(intentData.items) ? intentData.items : null);
    const orderId = orderData?.id ? String(orderData.id) : '';
    if (cartId && cartItems && cartItems.length) {
      const reservationStatus = mapPaymentStatusToReservationStatus(paymentStatus);
      const isPixPending = paymentStatus === 'pending' || paymentStatus === 'in_process';
      const isRejected = isPaymentRejected(paymentStatus);

      const payer = paymentInfo.payer;
      // The checkout email is the contact/delivery address. Mercado Pago's payer email
      // may belong to a different account and must only be a fallback for old intents.
      const customerEmail = String(intentData.customerEmail ?? '').trim()
        || String(orderData?.customer?.email ?? '').trim()
        || String(payer?.email ?? '').trim();
      const customerFirstName =
        payer?.first_name ||
        intentData.customerFirstName ||
        (orderData?.customer?.firstName ? String(orderData.customer.firstName) : '') ||
        '';
      const customerLastName =
        payer?.last_name ||
        intentData.customerLastName ||
        (orderData?.customer?.lastName ? String(orderData.customer.lastName) : '') ||
        '';
      const customerName = payer?.first_name
        ? `${payer.first_name} ${payer.last_name || ''}`.trim()
        : intentData.customerName ||
          (customerFirstName && customerLastName ? `${customerFirstName} ${customerLastName}`.trim() : '');
      const customerPhone = payer?.phone?.number || intentData.customerPhone || '';
      const customerDocument = payer?.identification?.number || intentData.customerDocument || '';
      const customerBirthDate =
        (orderData?.customer?.birthDate ? String(orderData.customer.birthDate) : '') ||
        (intentData.customerBirthDate ? String(intentData.customerBirthDate) : '') ||
        null;
      const passengerDetails = Array.isArray(orderData?.passengerDetails)
        ? orderData.passengerDetails
        : (Array.isArray(intentData.passengerDetails) ? intentData.passengerDetails : null);
      const intentComments = intentData.customerComments || null;

      const from = getFromEmail(true);
      const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);
      const now = Timestamp.now();

      const cartRef = doc(db, 'carts', String(cartId));
      const orderRef = orderId ? doc(db, 'orders', orderId) : null;

      const pkgs = new Map<string, Awaited<ReturnType<typeof getPaqueteById>> | null>();
      for (const it of cartItems) {
        const pid = String(it.packageId || '');
        if (!pid || pkgs.has(pid)) continue;
        pkgs.set(pid, await getPaqueteById(pid));
      }

      try {
        await runTransaction(db, async (tx) => {
          const pendingWrites: Array<() => void> = [];
          const queueUpdate = (ref: any, data: any) => {
            pendingWrites.push(() => tx.update(ref, data));
          };
          const queueSet = (ref: any, data: any, options?: any) => {
            pendingWrites.push(() => (options ? tx.set(ref, data, options) : tx.set(ref, data)));
          };
          const queueWrite = (write: () => void) => {
            pendingWrites.push(write);
          };
          const flushWrites = () => {
            for (const write of pendingWrites) write();
          };
          let orderSnap: any = null;
          let order: any = null;
          if (orderRef) {
            orderSnap = await tx.get(orderRef);
            if (!orderSnap.exists()) return;
            order = orderSnap.data();
            const processed = Array.isArray(order.processedPaymentIds) ? order.processedPaymentIds.map(String) : [];
            if (processed.includes(String(paymentId))) {
              return;
            }
            const alreadyPaid = String(order.status ?? '') === 'paid';
            const prevPaymentId = order?.payment?.paymentId ? String(order.payment.paymentId) : '';
            if (alreadyPaid && prevPaymentId && prevPaymentId !== String(paymentId)) {
              return;
            }
          }

          const cartSnap = await tx.get(cartRef);
          if (cartSnap.exists()) {
            const cartData: any = cartSnap.data();
            const alreadyPaid = String(cartData.status ?? '') === 'paid';
            const prevPaymentId = cartData.mercadoPagoPaymentId ? String(cartData.mercadoPagoPaymentId) : '';
            if (alreadyPaid && prevPaymentId && prevPaymentId !== String(paymentId)) {
              return;
            }
            const nextStatus = isApproved ? 'paid' : (isRejected ? 'cancelled' : 'checkout_started');
            queueUpdate(cartRef, {
              status: nextStatus,
              mercadoPagoPaymentId: String(paymentId),
              mercadoPagoStatus: paymentStatus,
              updatedAt: now,
            });
            if (orderRef && orderId && !cartData.orderId) {
              queueUpdate(cartRef, { orderId, updatedAt: now });
            }
          }

          if (orderRef) {
            const pendingRaw = process.env.PENDING_HOLD_MINUTES;
            const pendingParsed = pendingRaw ? parseInt(pendingRaw, 10) : NaN;
            const pendingMinutes = Number.isFinite(pendingParsed) && pendingParsed >= 5 && pendingParsed <= 1440 ? pendingParsed : 60;
            const pendingExpiresAt = Timestamp.fromMillis(now.toMillis() + pendingMinutes * 60 * 1000);
            const nextOrderStatus = isApproved ? 'paid' : (isRejected ? 'cancelled' : (isPixPending ? 'pending' : 'checkout_started'));
            queueUpdate(orderRef, {
              status: nextOrderStatus,
              expiresAt: isPixPending ? pendingExpiresAt : (order?.expiresAt ?? now),
              failureReason: isApproved ? null : (order?.failureReason ?? null),
              failureReasonDetail: isApproved ? null : (order?.failureReasonDetail ?? null),
              processedPaymentIds: arrayUnion(String(paymentId)),
              payment: {
                provider: 'mercadopago',
                externalReference: externalRefStr,
                preferenceId: order?.payment?.preferenceId ?? intentData.mercadoPagoPreferenceId ?? null,
                initPoint: order?.payment?.initPoint ?? intentData.mercadoPagoInitPoint ?? null,
                paymentId: String(paymentId),
                status: isApproved ? 'approved' : (isRejected ? 'rejected' : (isPixPending ? 'pending' : 'unknown')),
                statusDetail: paymentInfo.status_detail ?? null,
                updatedAt: now,
              },
              paidAt: isApproved ? now : (order?.paidAt ?? null),
              updatedAt: now,
            });
          }

          if (orderRef && isApproved) {
            let holdsOk = true;
            let holdValidationFailure: string | null = null;
            for (let idx = 0; idx < cartItems.length; idx += 1) {
              const it = cartItems[idx] as any;
              const holdId = it.holdId ? String(it.holdId) : '';
              const cartItemId = String(it.cartItemId || it.id || `idx_${idx}`);
              const packageId = String(it.packageId || it.experienceId || '');
              const date = String(it.date || '');
              const people = Number(it.people ?? 0);
              if (!holdId || !packageId || !date || !people || people < 1) {
                holdsOk = false;
                holdValidationFailure = 'missing_hold_context';
                break;
              }
              const holdRef = doc(db, 'reservationHolds', holdId);
              const holdSnap = await tx.get(holdRef);
              if (!holdSnap.exists()) {
                holdsOk = false;
                holdValidationFailure = 'hold_not_found';
                break;
              }
              const hold: any = holdSnap.data();
              const holdStatus = String(hold.status ?? '');
              if (holdStatus !== 'active' && holdStatus !== 'released' && holdStatus !== 'consumed') {
                holdsOk = false;
                holdValidationFailure = `hold_status_${holdStatus || 'unknown'}`;
                break;
              }
              const expiresMs = toMillis(hold.expiresAt);
              if (holdStatus === 'active' && expiresMs > 0 && expiresMs <= now.toMillis()) {
                holdValidationFailure = 'hold_expired_recovery';
              }
              const cartItemRef = doc(db, 'carts', String(cartId), 'items', cartItemId);
              const cartItemSnap = await tx.get(cartItemRef);
              if (!cartItemSnap.exists()) {
                holdsOk = false;
                holdValidationFailure = 'cart_item_not_found';
                break;
              }
              const cartItem: any = cartItemSnap.data();
              const cartItemHoldStatus = String(cartItem.holdStatus ?? '');
              if (
                cartItemHoldStatus !== 'active' &&
                cartItemHoldStatus !== 'released' &&
                cartItemHoldStatus !== 'consumed'
              ) {
                holdsOk = false;
                holdValidationFailure = `cart_item_hold_status_${cartItemHoldStatus || 'unknown'}`;
                break;
              }
              const itemExpiresMs = toMillis(cartItem.expiresAt);
              if (cartItemHoldStatus === 'active' && itemExpiresMs > 0 && itemExpiresMs <= now.toMillis()) {
                holdValidationFailure = 'cart_item_expired_recovery';
              }

              const seatLabels = Array.isArray(cartItem.selectedSeats) && cartItem.selectedSeats.length
                ? cartItem.selectedSeats.map((s: any) => String(s))
                : Array.isArray(hold.selectedSeats) && hold.selectedSeats.length
                  ? hold.selectedSeats.map((s: any) => String(s))
                  : [];
              if (seatLabels.length > 0) {
                const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
                const seatResSnap = await tx.get(seatResRef);
                if (!seatResSnap.exists()) {
                  holdsOk = false;
                  holdValidationFailure = 'seat_reservation_missing';
                  break;
                }
                const seatResData: any = seatResSnap.data();
                const seatLayoutId =
                  (typeof cartItem?.seatLayoutId === 'string' ? cartItem.seatLayoutId.trim() : '') ||
                  (typeof hold?.seatLayoutId === 'string' ? hold.seatLayoutId.trim() : '') ||
                  String(seatResData?.seatLayoutId ?? '');
                if (!seatLayoutId) {
                  holdsOk = false;
                  holdValidationFailure = 'seat_layout_missing';
                  break;
                }
                const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                if (!templateSnap.exists()) {
                  holdsOk = false;
                  holdValidationFailure = 'seat_layout_template_missing';
                  break;
                }
                const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
                const seatIds = seatIdsFromLabels(template, seatLabels);
                if (seatIds.length !== seatLabels.length) {
                  holdsOk = false;
                  holdValidationFailure = 'seat_labels_unresolved';
                  break;
                }
                const seatsMap: Record<string, any> = seatResData?.seats ?? {};
                for (const seatId of seatIds) {
                  const seat = seatsMap[seatId];
                  if (!seat) {
                    holdsOk = false;
                    holdValidationFailure = 'seat_not_found';
                    break;
                  }
                  const seatStatus = String(seat.status ?? '');
                  const seatHoldId = String(seat.holdId ?? '');
                  const seatOrderId = String(seat.orderId ?? '');
                  const canRecoverSeat =
                    seatStatus === 'available' ||
                    ((seatStatus === 'held' || seatStatus === 'reserved') && seatHoldId === holdId) ||
                    (seatStatus === 'paid' && seatOrderId === String(orderId));
                  if (!canRecoverSeat) {
                    holdsOk = false;
                    holdValidationFailure =
                      seatStatus === 'paid' && seatOrderId && seatOrderId !== String(orderId)
                        ? 'seat_paid_by_other_order'
                        : seatStatus === 'held' || seatStatus === 'reserved'
                          ? 'seat_hold_mismatch'
                          : `seat_status_${seatStatus || 'unknown'}`;
                    break;
                  }
                }
                if (!holdsOk) break;
              }
            }

            if (!holdsOk) {
              if (orderRef) {
                queueUpdate(orderRef, {
                  status: 'needs_review',
                  failureReason: 'holds_or_seats_invalid',
                  failureReasonDetail: holdValidationFailure ?? 'unknown',
                  updatedAt: now,
                });
              }
              flushWrites();
              return;
            }
          }

          for (let idx = 0; idx < cartItems.length; idx += 1) {
            const it = cartItems[idx] as any;
            const packageId = String(it.packageId || it.experienceId || '');
            const packageSlug = String(it.packageSlug || it.experienceSlug || '');
            const packageTitle = String(it.packageTitle || it.experienceTitle || '');
            const date = String(it.date || 'sin-fecha');
            const people = Number(it.people ?? 0);
            const currency = String(it.currency || intentData.currency || 'ars');
            const amountTotalItem = Number(it.subtotalAmount ?? it.amountTotal ?? 0);
            const baseSubtotalAmount =
              typeof (it as any).baseSubtotalAmount === 'number'
                ? Number((it as any).baseSubtotalAmount)
                : amountTotalItem;
            const extrasTotalAmount =
              typeof (it as any).extrasTotalAmount === 'number'
                ? Number((it as any).extrasTotalAmount)
                : Math.max(0, amountTotalItem - baseSubtotalAmount);
            const unitAmount = Number(it.unitAmount ?? 0);
            const pricingMode = (it as any).pricingMode ? String((it as any).pricingMode) : null;
            const pricingBaseUnitAmount = typeof (it as any).pricingBaseUnitAmount === 'number' ? Number((it as any).pricingBaseUnitAmount) : null;
            const officialPackageAmount = getReservationOfficialBaseAmount({
              pricingBaseUnitAmount,
              people,
              baseSubtotalAmount,
              amountTotal: amountTotalItem,
              extrasTotalAmount,
            });
            const unitAmountAdults = typeof (it as any).unitAmountAdults === 'number' ? Number((it as any).unitAmountAdults) : null;
            const unitAmountMinors = typeof (it as any).unitAmountMinors === 'number' ? Number((it as any).unitAmountMinors) : null;
            const depositPercentAdults = typeof (it as any).depositPercentAdults === 'number' ? Number((it as any).depositPercentAdults) : null;
            const depositPercentMinors = typeof (it as any).depositPercentMinors === 'number' ? Number((it as any).depositPercentMinors) : null;
            const holdId = it.holdId ? String(it.holdId) : null;
            const cartItemId = String(it.cartItemId || it.id || `idx_${idx}`);
            const referralCode = String(it.referralCode || intentData.referral?.code || '');
            const pickupPointTime = (it as any).pickupPointTime ? String((it as any).pickupPointTime).trim() : null;

            if (!packageId || !people || people < 1) continue;

            const pkg = pkgs.get(packageId) ?? null;
            const finalPackageTitle = packageTitle || pkg?.titulo || '';
            const baseCapacity = getBaseCapacityForDate(pkg, date);

            const peopleLabel = people === 1 ? '1 persona' : `${people} personas`;
            const amountFormatted = formatAmount(amountTotalItem || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0), currency);
            const dateFormatted = formatDate(date);

            const reservationId = orderId ? `ord_${orderId}_${cartItemId}` : `mp_${paymentId}_${cartItemId}`;
            const reservaRef = doc(db, 'reservas', reservationId);
            const stockRef = doc(db, 'stockMovimientos', orderId ? `ord_${orderId}_${cartItemId}` : `mp_${reservationId}`);
            const emailClienteConfirmRef = doc(
              db,
              'emailJobs',
              orderId ? `ord_${orderId}_${cartItemId}_cliente_confirm` : `mp_${reservationId}_cliente_confirm`
            );
            const emailClienteVoucherRef = doc(
              db,
              'emailJobs',
              orderId ? `ord_${orderId}_${cartItemId}_cliente_voucher` : `mp_${reservationId}_cliente_voucher`
            );
            const emailAdminRef = doc(db, 'emailJobs', orderId ? `ord_${orderId}_${cartItemId}_admin` : `mp_${reservationId}_admin`);
            const paymentRef = doc(collection(db, 'reservas', reservationId, 'payments'), String(paymentId));

            const reservaSnap = await tx.get(reservaRef);
            const stockSnap = await tx.get(stockRef);
            const emailClienteConfirmSnap = await tx.get(emailClienteConfirmRef);
            const emailClienteVoucherSnap = await tx.get(emailClienteVoucherRef);
            const emailAdminSnap = await tx.get(emailAdminRef);
            const paymentSnap = await tx.get(paymentRef);

            if (!reservaSnap.exists()) {
              const reservationCodeAllocation = await prepareNextReservationCodeInTransaction(tx);
              let referredBy: any = undefined;
              if (referralCode) {
                const resolved = await resolveReferralFromCode(referralCode);
                if (resolved) {
                  const commissionOverride =
                    pkg?.bookingConfig?.referralCommission
                      ? {
                          type: pkg.bookingConfig.referralCommission.type,
                          value: pkg.bookingConfig.referralCommission.value,
                          currency: pkg.bookingConfig.referralCommission.currency,
                        }
                      : undefined;
                  const comm = computeCommission({
                    amountTotal: amountTotalItem || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0),
                    commissionBaseAmount: officialPackageAmount,
                    extrasExcludedAmount: extrasTotalAmount,
                    people,
                    vendor: resolved.vendor,
                    commissionOverride,
                  });
                  const payoutStatus = nextPayoutStatusForReservationStatus(reservationStatus === 'completed' ? 'completed' : 'pending');
                  referredBy = {
                    vendorId: resolved.vendor.id,
                    vendorName: resolved.vendor.name,
                    code: resolved.code,
                    channel: 'link',
                    commissionType: comm.type,
                    commissionValue: comm.value,
                    commissionCurrency: comm.currency,
                    commissionAmount: comm.commissionAmount,
                    commissionBaseAmount: officialPackageAmount,
                    extrasExcludedAmount: extrasTotalAmount,
                    payoutStatus,
                  };
                }
              }

              const reservationCode = reservationCodeAllocation.reservationCode;
              queueWrite(reservationCodeAllocation.commit);
              const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
              const lookupUrl = siteUrl
                ? `${siteUrl}/consultar-reserva?code=${encodeURIComponent(reservationCode)}`
                : undefined;

              const emailData = {
                customerName: customerName || '',
                experienceTitle: finalPackageTitle || SITE_NAME,
                dateFormatted,
                peopleLabel,
                seatsLabel: Array.isArray((it as any).selectedSeats) && (it as any).selectedSeats.length
                  ? (it as any).selectedSeats.map((s: any) => String(s)).join(', ')
                  : undefined,
                amountFormatted,
                discountName: Number((it as any).communityDiscountAmount ?? 0) > 0 ? String((intentData.communityDiscount ?? orderData?.communityDiscount)?.nombre ?? 'Beneficio de comunidad') : '',
                discountAmountFormatted: Number((it as any).communityDiscountAmount ?? 0) > 0 ? formatAmount(Number((it as any).communityDiscountAmount), currency || 'ars') : '',
                promotionCode: String(orderData?.communityPromotionCode ?? intentData.communityPromotionCode ?? ''),
                reservationCode,
                lookupUrl,
                sessionId: reservationId,
                customerEmail: customerEmail || '',
                customerPhone: customerPhone || undefined,
                customerCountry: undefined,
                customerComments: intentComments || undefined,
                pickupPoint: (it as any).pickupPoint ? String((it as any).pickupPoint) : null,
                pickupPointTime,
              };
              const htmlConfirm = buildClienteCompraConfirmadaHtml(emailData);
              const textConfirm = buildClienteCompraConfirmadaText(emailData);
              const htmlVoucher = buildClienteVoucher48hsHtml(emailData);
              const textVoucher = buildClienteVoucher48hsText(emailData);
              const htmlAdmin = buildAdminNuevaReservaHtml(emailData);
              const textAdmin = buildAdminNuevaReservaText(emailData);
              const nextAttemptAtVoucher = computeVoucherNextAttemptAt({ date, pickupPointTime, now });
              const shouldQueueVoucher = Boolean(date && date !== 'sin-fecha');

              queueSet(reservaRef, {
                ...(orderId ? { orderId } : {}),
                cartId: String(cartId),
                cartItemId,
                packageId,
                packageSlug,
                packageTitle: finalPackageTitle,
                experienceId: packageId,
                experienceSlug: packageSlug,
                experienceTitle: finalPackageTitle,
                date,
                people,
                peopleAdults: typeof (it as any).peopleAdults === 'number' ? Number((it as any).peopleAdults) : null,
                peopleMinors: typeof (it as any).peopleMinors === 'number' ? Number((it as any).peopleMinors) : null,
                pickupPoint: (it as any).pickupPoint ? String((it as any).pickupPoint) : null,
                pickupPointTime,
                roomType: (it as any).roomType ? String((it as any).roomType) : null,
                seatLayoutId:
                  (typeof (it as any).seatLayoutId === 'string' ? String((it as any).seatLayoutId).trim() : '') ||
                  (pkg ? resolveDepartureConfig(pkg, date).seatLayoutId : null),
                selectedSeats: Array.isArray((it as any).selectedSeats) ? (it as any).selectedSeats : null,
                pricingMode: pricingMode === 'percent' || pricingMode === 'fixed' ? pricingMode : null,
                pricingBaseUnitAmount: pricingBaseUnitAmount !== null ? pricingBaseUnitAmount : null,
                unitAmountAdults: unitAmountAdults !== null ? unitAmountAdults : null,
                unitAmountMinors: unitAmountMinors !== null ? unitAmountMinors : null,
                depositPercentAdults: depositPercentAdults !== null ? depositPercentAdults : null,
                depositPercentMinors: depositPercentMinors !== null ? depositPercentMinors : null,
                baseSubtotalAmount,
                originalBaseSubtotalAmount: Number((it as any).originalBaseSubtotalAmount ?? baseSubtotalAmount),
                extrasTotalAmount,
                communityDiscountAmount: Number((it as any).communityDiscountAmount ?? 0),
                communityUserId: String(orderData?.communityUserId ?? intentData.communityUserId ?? '') || null,
                communityDiscount: intentData.communityDiscount ?? orderData?.communityDiscount ?? null,
                communityPromotionCode: String(orderData?.communityPromotionCode ?? intentData.communityPromotionCode ?? ''),
                amountTotal: amountTotalItem || Math.round(paymentInfo.transaction_amount * 100),
                currency: currency || paymentInfo.currency_id || 'ars',
                paymentMethod: 'mercadopago',
                mercadoPagoPaymentId: String(paymentId),
                mercadoPagoPreferenceId: intentData.mercadoPagoPreferenceId || null,
                mercadoPagoStatus: paymentStatus,
                mercadoPagoStatusDetail: paymentInfo.status_detail || null,
                externalReference,
                checkoutIntentId: intentId || null,
                customerEmail: customerEmail || '',
                customerEmailLower: normalizeEmail(customerEmail),
                customerName: customerName || '',
                customerNameLower: (customerName || '').trim().toLowerCase() || null,
                customerFirstName: customerFirstName || '',
                customerLastName: customerLastName || '',
                customerPhone: customerPhone || null,
                customerPhoneNormalized: normalizeDigits(customerPhone),
                customerCountry: payer?.address?.country || null,
                customerDocument: customerDocument || null,
                customerDocumentNormalized: normalizeDigits(customerDocument),
                customerBirthDate,
                customerComments: intentComments || null,
                passengerDetails,
                reservationCode,
                status: isPixPending ? 'pending' : reservationStatus,
                createdByAdmin: false,
                attachments: [],
                pricingSnapshot: buildReservationPricingSnapshot({
                  unitAmount:
                    amountTotalItem > 0 && people > 0
                      ? Math.round(amountTotalItem / people)
                      : unitAmount > 0
                        ? unitAmount
                        : null,
                  people,
                  amountTotal: amountTotalItem || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0),
                  baseSubtotalAmount,
                  extrasTotalAmount,
                  currency: currency || paymentInfo.currency_id || 'ars',
                  paymentMethod: 'mercadopago',
                }),
                capacitySnapshot: {
                  date,
                  baseCapacity,
                  maxPeoplePerBooking: pkg ? resolveDepartureConfig(pkg, date).maxPeople : null,
                  hasSpecificDates: Boolean(pkg?.salidas?.length),
                  enabled: pkg ? resolveDepartureConfig(pkg, date).enabled : false,
                },
                packageSnapshot: { id: packageId, slug: packageSlug, title: finalPackageTitle },
                experienceSnapshot: { id: packageId, slug: packageSlug, title: finalPackageTitle },
                statusHistory: [
                  {
                    status: isPixPending ? 'pending' : reservationStatus,
                    actor: 'system',
                    note: isPixPending
                      ? `Pago iniciado en Mercado Pago (estado: ${paymentStatus})`
                      : `Pago confirmado por Mercado Pago (ID: ${paymentId})`,
                    createdAt: now,
                  },
                ],
                paidAt: isApproved ? now : null,
                voucherSent: false,
                voucherSentAt: null,
                voucherScheduledAt: isApproved && shouldQueueVoucher ? nextAttemptAtVoucher : null,
                emailDelivery: isApproved
                  ? buildQueuedEmailDelivery({
                      customerConfirmation: { jobId: emailClienteConfirmRef.id },
                      customerVoucher: shouldQueueVoucher
                        ? { jobId: emailClienteVoucherRef.id }
                        : { status: 'not_sent', jobId: null },
                      adminNotification: { jobId: emailAdminRef.id },
                    })
                  : buildDefaultEmailDelivery(),
                createdAt: now,
                updatedAt: now,
                ...(referredBy ? { referredBy } : {}),
              });
              if (orderRef && orderId) {
                queueUpdate(orderRef, { reservationIds: arrayUnion(reservationId), updatedAt: now });
              }

              if (!emailClienteConfirmSnap.exists() && customerEmail && isApproved) {
                queueSet(emailClienteConfirmRef, {
                  type: 'cliente_confirmacion_compra',
                  status: 'pending',
                  to: customerEmail,
                  from,
                  replyTo,
                  subject: `Compra confirmada: ${finalPackageTitle || SITE_NAME}`,
                  html: htmlConfirm,
                  text: textConfirm,
                  attempts: 0,
                  lastError: null,
                  mercadoPagoPaymentId: String(paymentId),
                  reservationId,
                  nextAttemptAt: now,
                  createdAt: now,
                  updatedAt: now,
                });
              }

              if (!emailClienteVoucherSnap.exists() && customerEmail && isApproved && shouldQueueVoucher) {
                queueSet(emailClienteVoucherRef, {
                  type: 'cliente_voucher_48hs',
                  status: 'pending',
                  to: customerEmail,
                  from,
                  replyTo,
                  subject: `Recordatorio de salida (48 hs): ${finalPackageTitle || SITE_NAME}`,
                  html: htmlVoucher,
                  text: textVoucher,
                  attempts: 0,
                  lastError: null,
                  mercadoPagoPaymentId: String(paymentId),
                  reservationId,
                  nextAttemptAt: nextAttemptAtVoucher,
                  createdAt: now,
                  updatedAt: now,
                });
              }

              if (!emailAdminSnap.exists() && CONTACT_INFO.email && isApproved) {
                queueSet(emailAdminRef, {
                  type: 'admin_aviso',
                  status: 'pending',
                  to: CONTACT_INFO.email,
                  from,
                  replyTo,
                  subject: `Nueva reserva: ${finalPackageTitle || 'Paquete'} — ${customerName || customerEmail}`,
                  html: htmlAdmin,
                  text: textAdmin,
                  attempts: 0,
                  lastError: null,
                  mercadoPagoPaymentId: String(paymentId),
                  reservationId,
                  nextAttemptAt: now,
                  createdAt: now,
                  updatedAt: now,
                });
              }

              if (!paymentSnap.exists()) {
                queueSet(paymentRef, {
                  method: 'mercadopago',
                  status: String(paymentStatus ?? 'unknown'),
                  amount: amountTotalItem || Math.round(paymentInfo.transaction_amount * 100),
                  currency: String(currency || paymentInfo.currency_id || 'ars').toLowerCase(),
                  message: isApproved
                    ? `Pago aprobado (ID: ${paymentId})`
                    : `Pago recibido (estado: ${paymentStatus || 'unknown'})`,
                  mercadoPagoPaymentId: String(paymentId),
                  createdAt: now,
                  updatedAt: now,
                });
              } else {
                queueSet(
                  paymentRef,
                  {
                    method: 'mercadopago',
                    status: String(paymentStatus ?? 'unknown'),
                    amount: amountTotalItem || Math.round(paymentInfo.transaction_amount * 100),
                    currency: String(currency || paymentInfo.currency_id || 'ars').toLowerCase(),
                    message: isApproved
                      ? `Pago aprobado (ID: ${paymentId})`
                      : `Pago recibido (estado: ${paymentStatus || 'unknown'})`,
                    mercadoPagoPaymentId: String(paymentId),
                    updatedAt: now,
                  },
                  { merge: true }
                );
              }
            } else {
              const updates: any = {
                status: reservationStatus,
                mercadoPagoStatus: paymentStatus,
                mercadoPagoStatusDetail: paymentInfo.status_detail || null,
                updatedAt: now,
              };
              if (isApproved) updates.paidAt = now;
              queueUpdate(reservaRef, {
                ...updates,
                statusHistory: arrayUnion({
                  status: reservationStatus,
                  actor: 'system',
                  note: `Actualización de Mercado Pago: ${paymentStatus}`,
                  createdAt: now,
                }),
              });
              queueSet(
                paymentRef,
                {
                  method: 'mercadopago',
                  status: String(paymentStatus ?? 'unknown'),
                  amount: amountTotalItem || Math.round(paymentInfo.transaction_amount * 100),
                  currency: String(currency || paymentInfo.currency_id || 'ars').toLowerCase(),
                  message: isApproved
                    ? `Pago aprobado (ID: ${paymentId})`
                    : `Actualización de pago (estado: ${paymentStatus || 'unknown'})`,
                  mercadoPagoPaymentId: String(paymentId),
                  updatedAt: now,
                  ...(paymentSnap.exists() ? {} : { createdAt: now }),
                },
                { merge: true }
              );
            }

            if (!stockSnap.exists() && date && isApproved) {
              queueSet(stockRef, {
                packageId,
                date,
                type: 'reserva',
                quantity: -people,
                author: 'system',
                referenceId: String(paymentId),
                note: `Reserva Mercado Pago (pago confirmado)`,
                baseCapacityAtThatTime: baseCapacity,
                createdAt: now,
              });
            }

            if (holdId && date) {
              const holdRef = doc(db, 'reservationHolds', holdId);
              const cartItemRef = doc(db, 'carts', String(cartId), 'items', cartItemId);
              if (isApproved) {
                const holdSnap = await tx.get(holdRef);
                const cartItemSnap = await tx.get(cartItemRef);
                const holdData: any = holdSnap.exists() ? holdSnap.data() : null;
                const cartItemData: any = cartItemSnap.exists() ? cartItemSnap.data() : null;
                const holdWasActive = String(holdData?.status ?? '') === 'active';
                const cartItemWasActive = String(cartItemData?.holdStatus ?? '') === 'active';
                if (holdSnap.exists()) queueUpdate(holdRef, { status: 'consumed', consumedAt: now, updatedAt: now });
                if (cartItemSnap.exists()) queueUpdate(cartItemRef, { holdStatus: 'consumed', updatedAt: now });
                if (date !== 'sin-fecha' && (holdWasActive || cartItemWasActive)) {
                  const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
                  const lockSnap = await tx.get(lockRef);
                  const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
                  if (!lockSnap.exists()) {
                    queueSet(lockRef, { packageId, date, heldPeople: 0, updatedAt: now, createdAt: now });
                  } else {
                    queueUpdate(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
                  }
                }

                const seatLabels = Array.isArray(cartItemData?.selectedSeats) && cartItemData.selectedSeats.length
                  ? cartItemData.selectedSeats.map((s: any) => String(s))
                  : Array.isArray(holdData?.selectedSeats) && holdData.selectedSeats.length
                    ? holdData.selectedSeats.map((s: any) => String(s))
                    : [];
                if (seatLabels.length > 0) {
                  const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
                  const seatResSnap = await tx.get(seatResRef);
                  if (seatResSnap.exists()) {
                    const seatResData: any = seatResSnap.data();
                    const seatLayoutId =
                      (typeof cartItemData?.seatLayoutId === 'string' ? cartItemData.seatLayoutId.trim() : '') ||
                      (typeof holdData?.seatLayoutId === 'string' ? holdData.seatLayoutId.trim() : '') ||
                      String(seatResData?.seatLayoutId ?? '');
                    if (seatLayoutId) {
                      const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                      if (templateSnap.exists()) {
                        const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
                        const seatIds = seatIdsFromLabels(template, seatLabels);
                        const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
                        for (const seatId of seatIds) {
                          const seat = seatsMap[seatId];
                          if (!seat) continue;
                          const seatStatus = String(seat.status ?? 'available');
                          const seatHoldId = String(seat.holdId ?? '');
                          const seatOrderId = String(seat.orderId ?? '');
                          const canConsumeSeat =
                            seatStatus === 'available' ||
                            ((seatStatus === 'held' || seatStatus === 'reserved') && seatHoldId === holdId) ||
                            (seatStatus === 'paid' && seatOrderId === String(orderId));
                          if (!canConsumeSeat) continue;
                          seatsMap[seatId] = {
                            status: 'paid',
                            holdId: null,
                            cartId: null,
                            cartItemId: null,
                            orderId,
                            reservationId,
                            expiresAt: null,
                            blockedBy: null,
                            updatedAt: now,
                          };
                        }
                        queueSet(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
                      }
                    }
                  }
                }
              } else if (isRejected) {
                const holdSnap = await tx.get(holdRef);
                const cartItemSnap = await tx.get(cartItemRef);
                if (holdSnap.exists()) queueUpdate(holdRef, { status: 'released', releasedAt: now, updatedAt: now });
                if (cartItemSnap.exists()) queueUpdate(cartItemRef, { holdStatus: 'released', updatedAt: now });
                if (date !== 'sin-fecha') {
                  const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
                  const lockSnap = await tx.get(lockRef);
                  const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
                  if (!lockSnap.exists()) {
                    queueSet(lockRef, { packageId, date, heldPeople: 0, updatedAt: now, createdAt: now });
                  } else {
                    queueUpdate(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
                  }
                }

                const holdData: any = holdSnap.exists() ? holdSnap.data() : null;
                const cartItemData: any = cartItemSnap.exists() ? cartItemSnap.data() : null;
                const seatLabels = Array.isArray(cartItemData?.selectedSeats) && cartItemData.selectedSeats.length
                  ? cartItemData.selectedSeats.map((s: any) => String(s))
                  : Array.isArray(holdData?.selectedSeats) && holdData.selectedSeats.length
                    ? holdData.selectedSeats.map((s: any) => String(s))
                    : [];
                if (seatLabels.length > 0) {
                  const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
                  const seatResSnap = await tx.get(seatResRef);
                  if (seatResSnap.exists()) {
                    const seatResData: any = seatResSnap.data();
                    const seatLayoutId =
                      (typeof cartItemData?.seatLayoutId === 'string' ? cartItemData.seatLayoutId.trim() : '') ||
                      (typeof holdData?.seatLayoutId === 'string' ? holdData.seatLayoutId.trim() : '') ||
                      String(seatResData?.seatLayoutId ?? '');
                    if (seatLayoutId) {
                      const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                      if (templateSnap.exists()) {
                        const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
                        const seatIds = seatIdsFromLabels(template, seatLabels);
                        const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
                        for (const seatId of seatIds) {
                          const seat = seatsMap[seatId];
                          if (!seat) continue;
                          if (String(seat.status ?? '') !== 'held' && String(seat.status ?? '') !== 'reserved') continue;
                          if (String(seat.holdId ?? '') !== holdId) continue;
                          seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, expiresAt: null, blockedBy: null, updatedAt: now };
                        }
                        queueSet(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
                      }
                    }
                  }
                }
              } else if (isPixPending) {
                const pendingRaw = process.env.PENDING_HOLD_MINUTES;
                const pendingParsed = pendingRaw ? parseInt(pendingRaw, 10) : NaN;
                const pendingMinutes = Number.isFinite(pendingParsed) && pendingParsed >= 5 && pendingParsed <= 1440 ? pendingParsed : 60;
                const pendingExpiresAt = Timestamp.fromMillis(now.toMillis() + pendingMinutes * 60 * 1000);

                const holdSnap = await tx.get(holdRef);
                const cartItemSnap = await tx.get(cartItemRef);
                if (holdSnap.exists()) queueUpdate(holdRef, { expiresAt: pendingExpiresAt, updatedAt: now });
                if (cartItemSnap.exists()) queueUpdate(cartItemRef, { expiresAt: pendingExpiresAt, updatedAt: now });

                const holdData: any = holdSnap.exists() ? holdSnap.data() : null;
                const cartItemData: any = cartItemSnap.exists() ? cartItemSnap.data() : null;
                const seatLabels = Array.isArray(cartItemData?.selectedSeats) && cartItemData.selectedSeats.length
                  ? cartItemData.selectedSeats.map((s: any) => String(s))
                  : Array.isArray(holdData?.selectedSeats) && holdData.selectedSeats.length
                    ? holdData.selectedSeats.map((s: any) => String(s))
                    : [];
                if (seatLabels.length > 0) {
                  const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
                  const seatResSnap = await tx.get(seatResRef);
                  if (seatResSnap.exists()) {
                    const seatResData: any = seatResSnap.data();
                    const seatLayoutId =
                      (typeof cartItemData?.seatLayoutId === 'string' ? cartItemData.seatLayoutId.trim() : '') ||
                      (typeof holdData?.seatLayoutId === 'string' ? holdData.seatLayoutId.trim() : '') ||
                      String(seatResData?.seatLayoutId ?? '');
                    if (seatLayoutId) {
                      const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
                      if (templateSnap.exists()) {
                        const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
                        const seatIds = seatIdsFromLabels(template, seatLabels);
                        const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
                        for (const seatId of seatIds) {
                          const seat = seatsMap[seatId];
                          if (!seat) continue;
                          if (String(seat.holdId ?? '') !== holdId) continue;
                          const status = String(seat.status ?? 'available');
                          if (status !== 'held' && status !== 'reserved') continue;
                          seatsMap[seatId] = {
                            status: 'reserved',
                            holdId,
                            cartId: String(cartId),
                            cartItemId,
                            orderId,
                            reservationId,
                            expiresAt: pendingExpiresAt,
                            blockedBy: null,
                            updatedAt: now,
                          };
                        }
                        queueSet(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
                      }
                    }
                  }
                }
              }
            }
          }
          flushWrites();
        });

        if (intentId) {
          await updateDoc(doc(db, 'checkoutIntents', intentId), {
            status: isApproved ? 'completed' : (isPixPending ? 'pending' : 'failed'),
            mercadoPagoPaymentId: String(paymentId),
            mercadoPagoStatus: paymentStatus,
            updatedAt: Timestamp.now(),
          }).catch(() => {});
        }

        const resolvedRedemptionId = String(orderData?.communityRedemptionId ?? intentData.communityRedemptionId ?? '');
        let confirmedReservationIds: string[] = [];
        if (orderRef && resolvedRedemptionId) {
          const finalOrderSnap = await getDoc(orderRef);
          const finalOrder: any = finalOrderSnap.exists() ? finalOrderSnap.data() : {};
          confirmedReservationIds = Array.isArray(finalOrder.reservationIds) ? finalOrder.reservationIds.map(String) : [];
          if (isApproved) await confirmCommunityRedemption(resolvedRedemptionId, String(paymentId), confirmedReservationIds);
          else if (isRejected) await releaseCommunityRedemption(resolvedRedemptionId, 'payment_rejected');
          else if (isPixPending) await extendCommunityRedemption(resolvedRedemptionId, getPendingPaymentExpiresAt());
        }

        if (isApproved && intentData.communityUserId) {
          await recordCommunityPurchase({
            uid: String(intentData.communityUserId),
            orderId: String(orderId || intentId || paymentId),
            paymentId: String(paymentId),
            amountCents: Number(intentData.amountTotal ?? Math.round((paymentInfo.transaction_amount ?? 0) * 100)),
            discountCents: Number(intentData.communityDiscount?.montoDescuento ?? 0),
            discountName: intentData.communityDiscount?.nombre ?? null,
            promotionCode: intentData.communityPromotionCode ?? null,
            originalAmountCents: Number(intentData.communityDiscount?.montoOriginal ?? intentData.amountTotal ?? 0),
            currency: String(intentData.currency ?? paymentInfo.currency_id ?? 'ars'),
            reservationCount: cartItems.filter((item: any) => Boolean(item.packageId || item.experienceId)).length,
            packages: cartItems.map((item: any) => ({ title: String(item.packageTitle ?? item.experienceTitle ?? 'Paquete Explorarg'), date: String(item.date ?? ''), people: Number(item.people ?? 0) })),
          });
        }

        await recordMPNotification({
          notificationId,
          type: notification.type,
          action: notification.action,
          paymentId: String(paymentId),
          externalReference,
          status: 'processed',
        });

        return NextResponse.json({ received: true, processed: true });
      } catch (error) {
        const errorDetail = error instanceof Error ? error.message : String(error);
        console.error('[mercadopago-webhook] Error procesando carrito:', error);
        await recordMPNotification({
          notificationId,
          type: notification.type,
          action: notification.action,
          paymentId: String(paymentId),
          externalReference,
          status: 'failed',
          error: errorDetail,
        });
        return NextResponse.json({ error: 'Error procesando carrito', detail: errorDetail }, { status: 500 });
      }
    }

    // Extraer datos del intent (soportar tanto package* como experience* para compatibilidad)
    const packageId = intentData.packageId || intentData.experienceId;
    const packageSlug = intentData.packageSlug || intentData.experienceSlug;
    const packageTitle = intentData.packageTitle || intentData.experienceTitle || intentData.intentTitle;
    const {
      date,
      people,
      amountTotal,
      currency,
      customerEmail: intentEmail,
      customerName: intentName,
      customerPhone: intentPhone,
      customerDocument: intentDocument,
      customerBirthDate: intentBirthDate,
      customerComments: intentComments,
      passengerDetails: intentPassengerDetails,
      referral,
    } = intentData;

    // Obtener datos actualizados del paquete
    const pkg = packageId ? await getPaqueteById(packageId) : null;
    const finalPackageTitle = packageTitle ?? pkg?.titulo ?? '';
    const baseCapacity = getBaseCapacityForDate(pkg, date);

    // Determinar estado de la reserva
    const reservationStatus = mapPaymentStatusToReservationStatus(paymentStatus);
    const isPixPending = paymentStatus === 'pending' || paymentStatus === 'in_process';

    // Datos del pagador (del pago de MP)
    const payer = paymentInfo.payer;
    // Always deliver to the email entered in checkout; payer.email is the MP account email.
    const customerEmail = String(intentEmail ?? '').trim()
      || String(intentData.customerEmail ?? '').trim()
      || String(payer?.email ?? '').trim();
    const customerFirstName =
        payer?.first_name ||
        intentData.customerFirstName ||
        '';
    const customerLastName =
        payer?.last_name ||
        intentData.customerLastName ||
        '';
    const customerName = payer?.first_name 
      ? `${payer.first_name} ${payer.last_name || ''}`.trim() 
      : intentName ||
        (customerFirstName && customerLastName ? `${customerFirstName} ${customerLastName}`.trim() : '');
    const customerPhone = payer?.phone?.number || intentPhone || '';
    const customerDocument = payer?.identification?.number || intentDocument || '';
    const customerBirthDate = intentBirthDate ? String(intentBirthDate) : null;
    const passengerDetails = Array.isArray(intentPassengerDetails) ? intentPassengerDetails : null;

    // Preparar datos para emails
    const amountFormatted = formatAmount(amountTotal || paymentInfo.transaction_amount * 100, currency || 'ars');
    const dateFormatted = formatDate(date);
    const peopleLabel = people === 1 ? '1 persona' : `${people} personas`;

    const reservationId = `mp_${paymentId}`;
    const reservationCode = generateReservationCode(reservationId, Date.now());
    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
    const lookupUrl = siteUrl
      ? `${siteUrl}/consultar-reserva?code=${encodeURIComponent(reservationCode)}`
      : undefined;

    const emailData = {
      customerName: customerName || '',
      experienceTitle: finalPackageTitle || SITE_NAME,
      dateFormatted,
      peopleLabel,
      amountFormatted,
      discountName: Number(intentData.communityDiscount?.montoDescuento ?? 0) > 0 ? String(intentData.communityDiscount?.nombre ?? 'Beneficio de comunidad') : '',
      discountAmountFormatted: Number(intentData.communityDiscount?.montoDescuento ?? 0) > 0 ? formatAmount(Number(intentData.communityDiscount.montoDescuento), currency || 'ars') : '',
      promotionCode: String(intentData.communityPromotionCode ?? ''),
      reservationCode,
      lookupUrl,
      sessionId: String(paymentId),
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || undefined,
      customerCountry: undefined,
      customerComments: intentComments || undefined,
      pickupPoint: null,
      pickupPointTime: null,
    };

    const htmlConfirm = buildClienteCompraConfirmadaHtml(emailData);
    const textConfirm = buildClienteCompraConfirmadaText(emailData);
    const htmlVoucher = buildClienteVoucher48hsHtml(emailData);
    const textVoucher = buildClienteVoucher48hsText(emailData);
    const htmlAdmin = buildAdminNuevaReservaHtml(emailData);
    const textAdmin = buildAdminNuevaReservaText(emailData);
    const from = getFromEmail(true);
    const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);

    // Crear o actualizar reserva en Firestore
    try {
      const now = Timestamp.now();
      const reservaRef = doc(db, 'reservas', reservationId);
      const stockRef = doc(db, 'stockMovimientos', `mp_${reservationId}`);
      const emailClienteConfirmRef = doc(db, 'emailJobs', `mp_${reservationId}_cliente_confirm`);
      const emailClienteVoucherRef = doc(db, 'emailJobs', `mp_${reservationId}_cliente_voucher`);
      const emailAdminRef = doc(db, 'emailJobs', `mp_${reservationId}_admin`);

      const txResult = await runTransaction(db, async (tx) => {
        const reservaSnap = await tx.get(reservaRef);
        const stockSnap = await tx.get(stockRef);
        const emailClienteConfirmSnap = await tx.get(emailClienteConfirmRef);
        const emailClienteVoucherSnap = await tx.get(emailClienteVoucherRef);
        const emailAdminSnap = await tx.get(emailAdminRef);
        const nextAttemptAtVoucher = computeVoucherNextAttemptAt({ date, pickupPointTime: null, now });
        const shouldQueueVoucher = Boolean(date && date !== 'sin-fecha');

        if (!reservaSnap.exists()) {
          // Crear nueva reserva
          let referredBy: any = undefined;
          const referralCode = referral?.code;
          
          if (referralCode) {
            const resolved = await resolveReferralFromCode(referralCode);
            if (resolved) {
              const reservationCommissionBaseAmount =
                getReservationOfficialBaseAmount({
                  pricingBaseUnitAmount: (intentData as any).pricingBaseUnitAmount,
                  people,
                  baseSubtotalAmount: (intentData as any).baseSubtotalAmount,
                  amountTotal: amountTotal || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0),
                  extrasTotalAmount: (intentData as any).extrasTotalAmount,
                });
              const reservationExtrasTotalAmount =
                getReservationExtrasAmount((intentData as any).extrasTotalAmount);
              const commissionOverride =
                pkg?.bookingConfig?.referralCommission
                  ? {
                      type: pkg.bookingConfig.referralCommission.type,
                      value: pkg.bookingConfig.referralCommission.value,
                      currency: pkg.bookingConfig.referralCommission.currency,
                    }
                  : undefined;
              const comm = computeCommission({ 
                amountTotal: amountTotal || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0), 
                commissionBaseAmount: reservationCommissionBaseAmount,
                extrasExcludedAmount: reservationExtrasTotalAmount,
                people, 
                vendor: resolved.vendor, 
                commissionOverride 
              });
              const payoutStatus = nextPayoutStatusForReservationStatus(reservationStatus === 'completed' ? 'completed' : 'pending');
              referredBy = {
                vendorId: resolved.vendor.id,
                vendorName: resolved.vendor.name,
                code: resolved.code,
                channel: 'link',
                commissionType: comm.type,
                commissionValue: comm.value,
                commissionCurrency: comm.currency,
                commissionAmount: comm.commissionAmount,
                commissionBaseAmount: reservationCommissionBaseAmount,
                extrasExcludedAmount: reservationExtrasTotalAmount,
                payoutStatus,
              };
            }
          }

          const reservationCode = await reserveNextReservationCodeInTransaction(tx);
          tx.set(reservaRef, {
            packageId,
            packageSlug,
            packageTitle: finalPackageTitle,
            // Mantener campos legacy por compatibilidad
            experienceId: packageId,
            experienceSlug: packageSlug,
            experienceTitle: finalPackageTitle,
            date,
            people,
            roomType: intentData.roomType ? String(intentData.roomType) : null,
            selectedExtras: Array.isArray((intentData as any).selectedExtras) ? (intentData as any).selectedExtras : null,
            baseSubtotalAmount:
              typeof (intentData as any).baseSubtotalAmount === 'number'
                ? Number((intentData as any).baseSubtotalAmount)
                : null,
            originalBaseSubtotalAmount: typeof (intentData as any).originalBaseSubtotalAmount === 'number'
              ? Number((intentData as any).originalBaseSubtotalAmount)
              : (intentData as any).baseSubtotalAmount ?? null,
            communityDiscount: intentData.communityDiscount ?? null,
            communityDiscountAmount: Number(intentData.communityDiscount?.montoDescuento ?? 0),
            communityPromotionCode: String(intentData.communityPromotionCode ?? ''),
            communityUserId: intentData.communityUserId ?? null,
            extrasTotalAmount:
              typeof (intentData as any).extrasTotalAmount === 'number'
                ? Number((intentData as any).extrasTotalAmount)
                : null,
            amountTotal: amountTotal || Math.round(paymentInfo.transaction_amount * 100),
            currency: currency || paymentInfo.currency_id || 'ars',
            paymentMethod: 'mercadopago',
            mercadoPagoPaymentId: String(paymentId),
            mercadoPagoPreferenceId: intentData.mercadoPagoPreferenceId || null,
            mercadoPagoStatus: paymentStatus,
            mercadoPagoStatusDetail: paymentInfo.status_detail || null,
            externalReference,
            checkoutIntentId: intentId || null,
            customerEmail: customerEmail || '',
            customerEmailLower: normalizeEmail(customerEmail),
            customerName: customerName || '',
            customerNameLower: (customerName || '').trim().toLowerCase() || null,
            customerFirstName: customerFirstName || '',
            customerLastName: customerLastName || '',
            customerPhone: customerPhone || null,
            customerPhoneNormalized: normalizeDigits(customerPhone),
            customerCountry: payer?.address?.country || null,
            customerDocument: customerDocument || null,
            customerDocumentNormalized: normalizeDigits(customerDocument),
            customerBirthDate,
            customerComments: intentComments || null,
            passengerDetails,
            reservationCode,
            status: isPixPending ? 'pending' : reservationStatus,
            createdByAdmin: false,
            attachments: [],
            pricingSnapshot: buildReservationPricingSnapshot({
              unitAmount:
                amountTotal > 0 && people > 0
                  ? Math.round(amountTotal / people)
                  : typeof intentData?.unitAmount === 'number' && intentData.unitAmount > 0
                    ? Math.round(intentData.unitAmount)
                    : typeof intentData?.unitPrice === 'number' && intentData.unitPrice > 0
                      ? Math.round(intentData.unitPrice)
                      : null,
              people,
              amountTotal: amountTotal || (paymentInfo.transaction_amount ? Math.round(paymentInfo.transaction_amount * 100) : 0),
              baseSubtotalAmount:
                typeof (intentData as any).baseSubtotalAmount === 'number'
                  ? Number((intentData as any).baseSubtotalAmount)
                  : null,
              extrasTotalAmount:
                typeof (intentData as any).extrasTotalAmount === 'number'
                  ? Number((intentData as any).extrasTotalAmount)
                  : null,
              currency: currency || paymentInfo.currency_id || 'ars',
              paymentMethod: 'mercadopago',
            }),
            capacitySnapshot: {
              date,
              baseCapacity,
              maxPeoplePerBooking: pkg ? resolveDepartureConfig(pkg, date).maxPeople : null,
              hasSpecificDates: Boolean(pkg?.salidas?.length),
              enabled: pkg ? resolveDepartureConfig(pkg, date).enabled : false,
            },
            packageSnapshot: {
              id: packageId,
              slug: packageSlug,
              title: finalPackageTitle,
            },
            // Legacy field
            experienceSnapshot: {
              id: packageId,
              slug: packageSlug,
              title: finalPackageTitle,
            },
            statusHistory: [
              {
                status: isPixPending ? 'pending' : reservationStatus,
                actor: 'system',
                note: isPixPending 
                  ? `Pago iniciado en Mercado Pago (estado: ${paymentStatus})` 
                  : `Pago confirmado por Mercado Pago (ID: ${paymentId})`,
                createdAt: now,
              },
            ],
            paidAt: isApproved ? now : null,
            voucherSent: false,
            voucherSentAt: null,
            voucherScheduledAt: isApproved && shouldQueueVoucher ? nextAttemptAtVoucher : null,
            emailDelivery: isApproved
              ? buildQueuedEmailDelivery({
                  customerConfirmation: { jobId: emailClienteConfirmRef.id },
                  customerVoucher: shouldQueueVoucher
                    ? { jobId: emailClienteVoucherRef.id }
                    : { status: 'not_sent', jobId: null },
                  adminNotification: { jobId: emailAdminRef.id },
                })
              : buildDefaultEmailDelivery(),
            createdAt: now,
            updatedAt: now,
            ...(referredBy ? { referredBy } : {}),
          });
        } else {
          // Actualizar reserva existente
          const updates: any = {
            status: reservationStatus,
            mercadoPagoStatus: paymentStatus,
            mercadoPagoStatusDetail: paymentInfo.status_detail || null,
            updatedAt: now,
          };

          if (isApproved) {
            updates.paidAt = now;
          }

          const rawExisting = reservaSnap.data() as any;
          const hasDelivery = Boolean(rawExisting?.emailDelivery);
          if (isApproved && !hasDelivery) {
            updates.emailDelivery = buildQueuedEmailDelivery({
              customerConfirmation: { jobId: emailClienteConfirmRef.id },
              customerVoucher: shouldQueueVoucher
                ? { jobId: emailClienteVoucherRef.id }
                : { status: 'not_sent', jobId: null },
              adminNotification: { jobId: emailAdminRef.id },
            });
            updates.voucherScheduledAt = shouldQueueVoucher ? nextAttemptAtVoucher : null;
          }

          tx.update(reservaRef, {
            ...updates,
            statusHistory: arrayUnion({
              status: reservationStatus,
              actor: 'system',
              note: `Actualización de Mercado Pago: ${paymentStatus}`,
              createdAt: now,
            }),
          });
        }

        // Movimiento de stock (solo si está aprobado)
        if (!stockSnap.exists() && date && isApproved) {
          tx.set(stockRef, {
            packageId,
            date,
            type: 'reserva',
            quantity: -people,
            author: 'system',
            referenceId: String(paymentId),
            note: `Reserva Mercado Pago (pago confirmado)`,
            baseCapacityAtThatTime: baseCapacity,
            createdAt: now,
          });
        }

        // Email al cliente (solo si aprobado)
        if (!emailClienteConfirmSnap.exists() && customerEmail && isApproved) {
          tx.set(emailClienteConfirmRef, {
            type: 'cliente_confirmacion_compra',
            status: 'pending',
            to: customerEmail,
            from,
            replyTo,
            subject: `Compra confirmada: ${finalPackageTitle || SITE_NAME}`,
            html: htmlConfirm,
            text: textConfirm,
            attempts: 0,
            lastError: null,
            mercadoPagoPaymentId: String(paymentId),
            reservationId,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        if (!emailClienteVoucherSnap.exists() && customerEmail && isApproved && shouldQueueVoucher) {
          tx.set(emailClienteVoucherRef, {
            type: 'cliente_voucher_48hs',
            status: 'pending',
            to: customerEmail,
            from,
            replyTo,
            subject: `Recordatorio de salida (48 hs): ${finalPackageTitle || SITE_NAME}`,
            html: htmlVoucher,
            text: textVoucher,
            attempts: 0,
            lastError: null,
            mercadoPagoPaymentId: String(paymentId),
            reservationId,
            nextAttemptAt: nextAttemptAtVoucher,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Email al admin (solo si aprobado)
        if (!emailAdminSnap.exists() && CONTACT_INFO.email && isApproved) {
          tx.set(emailAdminRef, {
            type: 'admin_aviso',
            status: 'pending',
            to: CONTACT_INFO.email,
            from,
            replyTo,
            subject: `Nueva reserva: ${finalPackageTitle || 'Paquete'} — ${customerName || customerEmail}`,
            html: htmlAdmin,
            text: textAdmin,
            attempts: 0,
            lastError: null,
            mercadoPagoPaymentId: String(paymentId),
            reservationId,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          });
        }

        return {
          hadReserva: reservaSnap.exists(),
          hadStock: stockSnap.exists(),
          hadEmailCliente: emailClienteConfirmSnap.exists(),
          hadEmailAdmin: emailAdminSnap.exists(),
        };
      });

      const redemptionOrderId = String(intentData.redemptionOrderId ?? '');
      if (redemptionOrderId) {
        if (isApproved) await confirmCommunityRedemption(redemptionOrderId, String(paymentId), [reservationId]);
        else if (isPaymentRejected(paymentStatus)) await releaseCommunityRedemption(redemptionOrderId, 'payment_rejected');
        else if (isPixPending) await extendCommunityRedemption(redemptionOrderId, getPendingPaymentExpiresAt());
      }

      if (isApproved && intentData.communityUserId) {
        await recordCommunityPurchase({
          uid: String(intentData.communityUserId),
          orderId: String(redemptionOrderId || intentId || paymentId),
          paymentId: String(paymentId),
          amountCents: Number(amountTotal || Math.round((paymentInfo.transaction_amount ?? 0) * 100)),
          discountCents: Number(intentData.communityDiscount?.montoDescuento ?? 0),
          discountName: intentData.communityDiscount?.nombre ?? null,
          promotionCode: intentData.communityPromotionCode ?? null,
          originalAmountCents: Number(intentData.communityDiscount?.montoOriginal ?? amountTotal ?? 0),
          currency: String(currency || paymentInfo.currency_id || 'ars'),
          reservationCount: 1,
          packages: [{ title: String(finalPackageTitle || packageTitle || 'Paquete Explorarg'), date: String(date ?? ''), people: Number(people ?? 1) }],
        });
      }

      console.log('[mercadopago-webhook] Reserva procesada', {
        reservationId,
        paymentId,
        status: reservationStatus,
        isApproved,
        createdNew: !txResult.hadReserva,
      });

      // Actualizar checkout intent
      if (intentId) {
        await updateDoc(doc(db, 'checkoutIntents', intentId), {
          status: isApproved ? 'completed' : (isPixPending ? 'pending' : 'failed'),
          mercadoPagoPaymentId: String(paymentId),
          mercadoPagoStatus: paymentStatus,
          updatedAt: Timestamp.now(),
        });
      }

      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        paymentId: String(paymentId),
        externalReference,
        reservationId,
        status: 'processed',
      });

      return NextResponse.json({ received: true, processed: true });

    } catch (error) {
      console.error('[mercadopago-webhook] Error procesando reserva:', error);
      
      await recordMPNotification({
        notificationId,
        type: notification.type,
        action: notification.action,
        paymentId: String(paymentId),
        externalReference,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json({ error: 'Error procesando reserva' }, { status: 500 });
    }

  } catch (error) {
    console.error('[mercadopago-webhook] Error general:', error);
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
  }
}

// Endpoint GET para verificar que el webhook está funcionando (usado por Mercado Pago)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    // Mercado Pago envía un challenge para verificar el endpoint
    return new Response(challenge, { status: 200 });
  }
  
  return NextResponse.json({ status: 'ok', message: 'Webhook de Mercado Pago activo' });
}
