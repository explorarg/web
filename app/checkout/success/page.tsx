import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, MessageCircle, ArrowRight, Clock, AlertTriangle, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getPaqueteBySlug } from '@/lib/paquetes';
import ClearCheckoutStorage from '@/components/checkout/ClearCheckoutStorage';
import SuccessVerification from '@/components/checkout/SuccessVerification';
import OrderVerification from '@/components/checkout/OrderVerification';
import { CONTACT_INFO, SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { buildVentaStatuses } from '@/lib/sales/status';
import { getSeatCategoryExtraSummaries, getSeatCategoryTotalAmount, getSeatTypeLabel } from '@/lib/reservas/seat-category-extras';
import { getReservationExtraTotalAmount, getSinglePassengerSurchargeSummary, isSinglePassengerSurchargeExtra } from '@/lib/packages/resolve-departure';

/** Sin caché: datos de paquete siempre actualizados */
export const revalidate = 0;

type SearchParams = Promise<{
  orderId?: string;
  slug?: string;
  date?: string;
  people?: string;
  sessionId?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  status?: string;
  collection_status?: string;
  payment_id?: string;
  collection_id?: string;
  external_reference?: string;
  merchant_order_id?: string;
  preference_id?: string;
}>;

function getOrderIdFromExternalReference(value: unknown): string {
  const externalReference = String(value ?? '').trim();
  if (!externalReference.startsWith('order-')) return '';
  return externalReference.slice('order-'.length).trim();
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr || dateStr === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number, currency: string | undefined): string {
  if (!currency) return amount ? `$ ${amount.toFixed(2)}` : '—';
  const normalized = currency.toUpperCase();
  const locale =
    normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function normalizeMercadoPagoReturnStatus(...values: Array<unknown>): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) continue;
    return normalized;
  }
  return '';
}

function resolveOrderDisplayStatus(params: {
  orderStatus: unknown;
  orderPaymentStatus: unknown;
  mpReturnStatus: unknown;
}): string {
  const orderStatus = String(params.orderStatus ?? '').trim().toLowerCase();
  const orderPaymentStatus = String(params.orderPaymentStatus ?? '').trim().toLowerCase();
  const mpReturnStatus = String(params.mpReturnStatus ?? '').trim().toLowerCase();

  if (orderStatus === 'paid') return 'paid';
  if (orderStatus === 'needs_review') return 'needs_review';
  if (orderStatus === 'expired') return 'expired';
  if (orderStatus === 'failed' || orderStatus === 'cancelled') return orderStatus;

  if (orderPaymentStatus === 'approved' || mpReturnStatus === 'approved') {
    return 'payment_approved_processing';
  }

  if (
    orderStatus === 'pending' ||
    orderStatus === 'checkout_started' ||
    orderPaymentStatus === 'pending' ||
    orderPaymentStatus === 'in_process' ||
    mpReturnStatus === 'pending' ||
    mpReturnStatus === 'in_process'
  ) {
    return 'pending';
  }

  return orderStatus || 'created';
}

function orderHeadline(params: {
  statusRaw: unknown;
  reservationReady: boolean;
}): { title: string; subtitle: string; tone: 'success' | 'pending' | 'warning' | 'error' } {
  const s = String(params.statusRaw ?? '');
  if (params.reservationReady) {
    return {
      title: 'Compra confirmada',
      subtitle: 'Gracias por tu compra. Tu pago fue procesado correctamente y tu reserva quedó confirmada.',
      tone: 'success',
    };
  }
  if (s === 'payment_approved_processing') {
    return {
      title: 'Pago aprobado',
      subtitle: 'Tu pago fue procesado correctamente. Estamos terminando de registrar tu reserva y generar tu código.',
      tone: 'success',
    };
  }
  if (s === 'pending' || s === 'checkout_started') {
    return {
      title: 'Pago pendiente',
      subtitle: 'Tu pago está en proceso. Si se aprueba, confirmaremos la compra automáticamente.',
      tone: 'pending',
    };
  }
  if (s === 'needs_review') {
    return {
      title: 'Compra en revisión',
      subtitle: 'Recibimos tu pago, pero necesitamos validar disponibilidad. Te contactaremos a la brevedad.',
      tone: 'warning',
    };
  }
  if (s === 'expired') {
    return {
      title: 'Orden vencida',
      subtitle: 'El pago no se confirmó dentro del tiempo de espera. Si necesitás ayuda, escribinos por WhatsApp.',
      tone: 'error',
    };
  }
  if (s === 'failed' || s === 'cancelled') {
    return {
      title: 'No se pudo confirmar el pago',
      subtitle: 'Si creés que es un error o necesitás ayuda, escribinos por WhatsApp y lo revisamos.',
      tone: 'error',
    };
  }
  return {
    title: 'Estamos procesando tu compra',
    subtitle: 'Estamos verificando el estado del pago. Si se aprueba, confirmaremos la compra automáticamente.',
    tone: 'pending',
  };
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const externalReference = params.external_reference?.trim() || '';
  const orderId = params.orderId?.trim() || getOrderIdFromExternalReference(externalReference);
  const slug = params.slug?.trim() || '';
  const date = params.date?.trim() || '';
  const peopleParam = params.people?.trim();
  const sessionId = params.sessionId?.trim() || '';
  const amountParam = params.amount?.trim();
  const amount = amountParam ? parseInt(amountParam, 10) : 0;
  const currency = params.currency?.trim() || 'ars';
  const mpReturnStatus = normalizeMercadoPagoReturnStatus(params.collection_status, params.status);
  const paymentId = params.payment_id?.trim() || params.collection_id?.trim() || '';
  const people = peopleParam ? parseInt(peopleParam, 10) : 0;
  const peopleLabel =
    people >= 1
      ? people === 1
        ? '1 persona'
        : `${people} personas`
      : '';

  let order: any = null;
  if (orderId) {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (snap.exists()) {
      order = { id: snap.id, ...(snap.data() as any) };
    }
  }

  const reservationCodesByCartItemId: Record<string, { id: string; code: string }> = {};
  const reservationsForOrder: any[] = [];
  if (orderId && order && Array.isArray(order.reservationIds) && order.reservationIds.length > 0) {
    const ids = order.reservationIds.map((s: any) => String(s)).filter(Boolean).slice(0, 20);
    const snaps = await Promise.all(ids.map((id: string) => getDoc(doc(db, 'reservas', id))));
    for (let i = 0; i < snaps.length; i += 1) {
      const snap = snaps[i];
      if (!snap.exists()) continue;
      const data: any = snap.data();
      reservationsForOrder.push({ id: snap.id, ...data });
      const cartItemId = String(data.cartItemId ?? '');
      const code = String(data.reservationCode ?? '').trim() || snap.id;
      if (cartItemId) reservationCodesByCartItemId[cartItemId] = { id: snap.id, code };
    }
  }

  const paquete = !orderId && slug ? await getPaqueteBySlug(slug) : null;
  const title =
    order?.items?.length === 1
      ? String(order.items[0]?.packageTitle || 'Tu compra')
      : orderId
        ? 'Tu compra'
        : paquete?.titulo ?? (slug || 'Tu reserva');
  const primaryItem = Array.isArray(order?.items) ? order.items[0] : null;
  const primaryReservation = reservationsForOrder[0] ?? null;
  const reservationCodeValues = Object.values(reservationCodesByCartItemId);
  const reservationReady = reservationsForOrder.length > 0;

  const resolvedDate = date || String(order?.items?.[0]?.date || 'sin-fecha');
  const dateLabel = formatDateLabel(resolvedDate);
  const orderAmount = typeof order?.amountTotal === 'number' ? order.amountTotal : 0;
  const orderCurrency = order?.currency ? String(order.currency).toUpperCase() : currency;
  const orderDiscount = order?.communityDiscount ?? null;
  const orderDiscountAmount = Math.max(0, Number(orderDiscount?.montoDescuento ?? order?.items?.reduce((sum: number, item: any) => sum + Number(item?.communityDiscountAmount ?? 0), 0) ?? 0));
  const orderPromotionCode = String(order?.communityPromotionCode ?? '').trim();
  const amountLabel = orderId ? (orderAmount ? formatCurrency(orderAmount, orderCurrency) : 'Por confirmar') : (amount ? formatCurrency(amount, currency) : 'Por confirmar');
  const orderDisplayStatus = resolveOrderDisplayStatus({
    orderStatus: order?.status,
    orderPaymentStatus: order?.payment?.status,
    mpReturnStatus,
  });
  const reservationStatuses = reservationsForOrder.map((reservation) => buildVentaStatuses(reservation));
  const paymentStatusLabel =
    reservationStatuses[0]?.paymentStatusLabel ??
    (order?.payment?.status === 'approved' || mpReturnStatus === 'approved'
      ? 'Pago aprobado'
      : order?.payment?.status
        ? String(order.payment.status).replace(/_/g, ' ')
        : mpReturnStatus
          ? String(mpReturnStatus).replace(/_/g, ' ')
          : String(order?.status ?? '—'));
  const entriesLabel =
    peopleLabel ||
    (primaryItem?.people
      ? `${Number(primaryItem.people)} persona${Number(primaryItem.people) === 1 ? '' : 's'}`
      : '');
  const locationLabel =
    Array.isArray(primaryItem?.selectedSeats) && primaryItem.selectedSeats.length > 0
      ? primaryItem.selectedSeats.join(', ')
      : Array.isArray(primaryReservation?.selectedSeats) && primaryReservation.selectedSeats.length > 0
        ? primaryReservation.selectedSeats.join(', ')
        : '';
  const pickupPointLabel =
    String(primaryReservation?.pickupPoint ?? primaryItem?.pickupPoint ?? '').trim() || '';
  const pickupPointTimeLabel =
    String(primaryReservation?.pickupPointTime ?? primaryItem?.pickupPointTime ?? '').trim() || '';
  const selectedExtras = Array.isArray(primaryReservation?.selectedExtras)
    ? primaryReservation.selectedExtras
    : Array.isArray(primaryItem?.selectedExtras)
      ? primaryItem.selectedExtras
      : [];
  const packageUnitAmount = typeof primaryReservation?.pricingBaseUnitAmount === 'number'
    ? Number(primaryReservation.pricingBaseUnitAmount)
    : typeof primaryItem?.pricingBaseUnitAmount === 'number'
      ? Number(primaryItem.pricingBaseUnitAmount)
      : null;
  const packageAmount = packageUnitAmount !== null
    ? Math.round(packageUnitAmount) * Math.max(1, Number(primaryReservation?.people ?? primaryItem?.people ?? people) || 1)
    : null;
  const seatCategoryExtras = getSeatCategoryExtraSummaries(selectedExtras);
  const seatTypeLabel = getSeatTypeLabel(
    selectedExtras,
    Array.isArray(primaryReservation?.selectedSeats)
      ? primaryReservation.selectedSeats.length
      : Array.isArray(primaryItem?.selectedSeats)
        ? primaryItem.selectedSeats.length
        : 0
  );
  const seatCategoryTotalAmount = getSeatCategoryTotalAmount(selectedExtras);
  const surchargePeople = Math.max(1, Number(primaryReservation?.people ?? primaryItem?.people ?? people) || 1);
  const surchargeBaseSubtotalAmount =
    packageAmount !== null
      ? packageAmount
      : Math.max(
          0,
          orderAmount -
            selectedExtras.reduce(
              (sum: number, extra: any) => sum + getReservationExtraTotalAmount(extra, surchargePeople),
              0
            )
        );
  const singlePassengerSurcharge = getSinglePassengerSurchargeSummary({
    people: surchargePeople,
    baseSubtotalAmount: surchargeBaseSubtotalAmount,
    selectedExtras,
  });

  const whatsappText = orderId
    ? `Hola, acabo de confirmar mi compra (Order: ${orderId}). ¿Próximos pasos?`
    : `Hola, acabo de confirmar mi reserva para ${title}. Fecha: ${date === 'sin-fecha' ? 'a coordinar' : date}. ${peopleLabel}. ¿Próximos pasos?`;
  const whatsappHref = `${SOCIAL_MEDIA.whatsapp}?text=${encodeURIComponent(whatsappText)}`;

  const hasSession = Boolean(sessionId);
  const heading = orderId ? orderHeadline({ statusRaw: orderDisplayStatus, reservationReady }) : null;
  const isSuccessfulState = !orderId || heading?.tone === 'success';
  const icon =
    !orderId
      ? <CheckCircle className="h-12 w-12" strokeWidth={2} />
      : heading?.tone === 'success'
        ? <CheckCircle className="h-12 w-12" strokeWidth={2} />
        : heading?.tone === 'pending'
          ? <Clock className="h-12 w-12" strokeWidth={2} />
          : heading?.tone === 'warning'
            ? <AlertTriangle className="h-12 w-12" strokeWidth={2} />
            : <XCircle className="h-12 w-12" strokeWidth={2} />;
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ClearCheckoutStorage slug={slug} date={date} people={people} />
      <Navbar variant="homeMockup" reserveSpace />
      <div className="container mx-auto max-w-2xl px-4 py-8 md:py-14">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(24,51,62,0.12)]">
          <section className={`relative overflow-hidden px-6 py-9 text-center text-white sm:px-10 ${isSuccessfulState ? 'bg-gradient-to-br from-[#103D46] via-[#126B70] to-[#15969A]' : heading?.tone === 'pending' ? 'bg-gradient-to-br from-slate-700 to-slate-900' : heading?.tone === 'warning' ? 'bg-gradient-to-br from-amber-700 to-amber-900' : 'bg-gradient-to-br from-rose-700 to-rose-900'}`}>
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -bottom-36 -left-20 h-64 w-64 rounded-full border border-white/10" />
            <div className="relative mx-auto flex max-w-lg flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-lg shadow-black/10">{icon}</div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{isSuccessfulState ? 'Explorarg · Compra segura' : 'Estado de tu compra'}</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{orderId ? (heading?.title ?? 'Tu compra') : '¡Compra confirmada!'}</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/80">{orderId ? (heading?.subtitle ?? 'Estamos verificando el estado del pago.') : 'Tu pago se procesó correctamente. Ya estamos preparando los detalles de tu reserva.'}</p>
            </div>
          </section>

          <div className="p-5 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#18878B]">Tu viaje</p>
              <h2 className="mt-2 text-xl font-bold leading-snug text-[#18333E] sm:text-2xl">{title}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200/70"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha</p><p className="mt-1 text-sm font-semibold capitalize text-slate-800">{dateLabel}</p></div>
                {entriesLabel && <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200/70"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pasajeros</p><p className="mt-1 text-sm font-semibold text-slate-800">{entriesLabel}</p></div>}
                {locationLabel && <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200/70"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Butacas</p><p className="mt-1 text-sm font-semibold text-slate-800">{locationLabel}</p></div>}
                {pickupPointLabel && <div className="rounded-xl bg-white p-3.5 ring-1 ring-slate-200/70"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Punto de ascenso</p><p className="mt-1 text-sm font-semibold text-slate-800">{pickupPointLabel}{pickupPointTimeLabel ? ` · ${pickupPointTimeLabel}` : ''}</p></div>}
              </div>
              {seatTypeLabel && <p className="mt-4 text-xs text-slate-500">Butaca: <span className="font-semibold text-slate-700">{seatTypeLabel}</span>{seatCategoryExtras.length > 0 ? ` · ${seatCategoryExtras.map((extra) => `${extra.label}: ${formatCurrency(extra.totalAmount, orderCurrency)}`).join(' · ')}` : ''}{seatCategoryTotalAmount > 0 ? ` · Plus ${formatCurrency(seatCategoryTotalAmount, orderCurrency)}` : ''}</p>}
              {selectedExtras.filter((extra: any) => !isSinglePassengerSurchargeExtra(extra)).length > 0 && <p className="mt-2 text-xs text-slate-500">Extras: <span className="font-medium text-slate-700">{selectedExtras.filter((extra: any) => !isSinglePassengerSurchargeExtra(extra)).map((extra: any) => String(extra?.label ?? '')).filter(Boolean).join(', ')}</span></p>}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-semibold text-slate-500">{isSuccessfulState ? 'Total abonado' : 'Total de la compra'}</p><p className="mt-1 text-3xl font-bold tracking-tight text-[#18333E]">{amountLabel}</p></div>
                <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${isSuccessfulState ? 'bg-emerald-50 text-emerald-700' : heading?.tone === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{paymentStatusLabel}</div>
              </div>
              {orderDiscountAmount > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><div><p className="font-semibold">{String(orderDiscount?.nombre ?? 'Beneficio aplicado')}{orderPromotionCode ? ` · ${orderPromotionCode}` : ''}</p><p className="mt-0.5 text-xs text-emerald-700">Descuento aplicado</p></div><p className="shrink-0 font-bold">−{formatCurrency(orderDiscountAmount, orderCurrency)}</p></div>}
              {singlePassengerSurcharge.applies && <p className="mt-3 text-xs text-slate-500">Incluye {singlePassengerSurcharge.label.toLowerCase()}: {formatCurrency(singlePassengerSurcharge.amount, orderCurrency)}</p>}
            </div>

            {orderId && <div className="mt-4 rounded-2xl border border-[#BFE6E2] bg-[#F0FAF9] p-5 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#18878B]">{reservationCodeValues.length > 1 ? 'Códigos de reserva' : 'Código de reserva'}</p>
              {reservationCodeValues.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{reservationCodeValues.map((reservation) => <span key={reservation.id} className="rounded-lg border border-[#BFE6E2] bg-white px-3 py-2 font-mono text-sm font-bold tracking-wider text-[#155E63]">{reservation.code}</span>)}</div> : <p className="mt-2 text-sm font-medium text-slate-700">Se está generando y aparecerá acá en unos instantes.</p>}
              {reservationCodeValues.length > 0 && <p className="mt-2 text-xs text-slate-500">Guardá este código para el día de tu viaje. También te lo enviamos por correo.</p>}
            </div>}
            {!orderId && !hasSession && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">No pudimos vincular esta confirmación con una orden. Si necesitás ayuda, escribinos a {CONTACT_INFO.email}.</p>}
          </div>

          {orderId ? (
            <OrderVerification
              orderId={orderId}
              paymentId={paymentId}
              initialPaymentApproved={mpReturnStatus === 'approved'}
            />
          ) : (hasSession ? <SuccessVerification sessionId={sessionId} /> : null)}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="gap-2">
              <Link href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Escribir por WhatsApp
              </Link>
            </Button>
            {slug && (
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/paquete/${slug}`}>
                  Ver paquete
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          {SITE_NAME} · Cualquier consulta: {CONTACT_INFO.email}
        </p>
      </div>
    </div>
  );
}
