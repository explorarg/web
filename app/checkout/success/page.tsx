import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail, MessageCircle, ArrowRight, Clock, AlertTriangle, XCircle } from 'lucide-react';
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
import SinglePassengerSurchargeBreakdown from '@/components/pricing/SinglePassengerSurchargeBreakdown';

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
  const originalPackageUnitAmount =
    typeof primaryReservation?.pricingBaseUnitAmount === 'number'
      ? primaryReservation.pricingBaseUnitAmount
      : typeof primaryItem?.pricingBaseUnitAmount === 'number'
        ? primaryItem.pricingBaseUnitAmount
        : null;
  const originalPackageAmount =
    originalPackageUnitAmount !== null && Number(primaryReservation?.people ?? primaryItem?.people ?? people) > 0
      ? Math.round(originalPackageUnitAmount) * Math.max(1, Number(primaryReservation?.people ?? primaryItem?.people ?? people) || 1)
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
    originalPackageAmount !== null
      ? originalPackageAmount
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
  const iconBg =
    !orderId
      ? 'bg-success/15 text-success'
      : heading?.tone === 'success'
        ? 'bg-success/15 text-success'
        : heading?.tone === 'pending'
          ? 'bg-gray-500/10 text-gray-600'
          : heading?.tone === 'warning'
            ? 'bg-amber-500/15 text-amber-700'
            : 'bg-red-500/10 text-red-600';

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ClearCheckoutStorage slug={slug} date={date} people={people} />
      <Navbar variant="homeMockup" reserveSpace />
      <div className="container mx-auto max-w-xl px-4 py-12 md:py-20">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col items-center text-center">
            <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${iconBg}`}>
              {icon}
            </div>
            <h1 className="mt-6 text-2xl font-bold text-gray-900 md:text-3xl">
              {orderId ? (heading?.title ?? 'Tu compra') : '¡Reserva confirmada!'}
            </h1>
            <p className="mt-3 text-base text-gray-600">
              {orderId ? (heading?.subtitle ?? 'Estamos verificando el estado del pago.') : 'Tu pago se procesó correctamente. Estamos confirmando tu reserva y el envío de los emails automáticamente.'}
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Detalle de la reserva
            </p>
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Experiencia</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{title}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</p>
                  <p className="mt-1 capitalize">{dateLabel}</p>
                </div>
                {entriesLabel ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Entradas</p>
                    <p className="mt-1">{entriesLabel}</p>
                  </div>
                ) : null}
              </div>
              {locationLabel ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ubicación</p>
                  <p className="mt-1">{locationLabel}</p>
                </div>
              ) : null}
              {pickupPointLabel ? (
                <div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ascenso</p>
                    <p className="mt-1">
                      {pickupPointLabel}
                      {pickupPointTimeLabel ? ` · ${pickupPointTimeLabel}` : ' · Horario a confirmar'}
                    </p>
                  </div>
                </div>
              ) : null}
              {selectedExtras.filter((extra: any) => !isSinglePassengerSurchargeExtra(extra)).length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Extras</p>
                  <p className="mt-1">
                    {selectedExtras
                      .filter((extra: any) => !isSinglePassengerSurchargeExtra(extra))
                      .map((extra: any) => String(extra?.label ?? ''))
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              ) : null}
              {singlePassengerSurcharge.applies ? (
                <SinglePassengerSurchargeBreakdown
                  label={singlePassengerSurcharge.label}
                  amountLabel={formatCurrency(singlePassengerSurcharge.amount, orderCurrency)}
                  className="mt-1"
                />
              ) : null}
              {seatTypeLabel ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Tipo de butaca</p>
                  <p className="mt-1">{seatTypeLabel}</p>
                  {seatCategoryExtras.length > 0 ? (
                    <div className="mt-1 text-xs text-gray-500">
                      {seatCategoryExtras
                        .map((extra) => `${extra.label}: ${formatCurrency(extra.totalAmount, orderCurrency)}`)
                        .join(' · ')}
                      {seatCategoryTotalAmount > 0 ? ` · Plus total: ${formatCurrency(seatCategoryTotalAmount, orderCurrency)}` : ''}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total abonado</p>
                  <p className="mt-1 font-semibold text-gray-900">{amountLabel}</p>
                  {originalPackageAmount !== null ? (
                    <p className="mt-1 text-xs text-gray-500">Precio original del paquete: {formatCurrency(originalPackageAmount, orderCurrency)}</p>
                  ) : null}
                  {orderDiscountAmount > 0 ? (
                    <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <p className="font-semibold">{String(orderDiscount?.nombre ?? 'Beneficio aplicado')}{orderPromotionCode ? ` · Código ${orderPromotionCode}` : ''}</p>
                      <p className="mt-0.5">Descuento aplicado: −{formatCurrency(orderDiscountAmount, orderCurrency)}</p>
                    </div>
                  ) : null}
                  {singlePassengerSurcharge.applies ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Recargo tarifa individual: {formatCurrency(singlePassengerSurcharge.amount, orderCurrency)}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Estado del pago</p>
                  <p className="mt-1">{paymentStatusLabel}</p>
                </div>
              </div>
              {orderId ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Número de orden</p>
                  <p className="mt-1">{orderId}</p>
                </div>
              ) : null}
              {orderId ? (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {reservationCodeValues.length > 1 ? 'Códigos de reserva' : 'Código de reserva'}
                  </p>
                  {reservationCodeValues.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {reservationCodeValues.map((r) => (
                        <div key={r.id} className="font-mono text-sm text-gray-900">
                          {r.code}
                        </div>
                      ))}
                      <p className="text-sm text-gray-600">
                        Guardalo para presentarlo el día de la actividad.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2 text-sm text-gray-600">
                      <p>Estamos generando tu código de reserva.</p>
                      <p>Lo recibirás en los próximos minutos por correo electrónico y/o WhatsApp.</p>
                      <p>Si luego de unos minutos no lo recibís, comunicate con nuestro equipo de soporte.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {!orderId && !hasSession && (
              <p className="mt-3 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                No detectamos el identificador de sesión. Si esto sucede, escribinos por WhatsApp
                o mandá un email a {CONTACT_INFO.email} para que lo verifiquemos.
              </p>
            )}
          </div>

          {orderId ? (
            <OrderVerification
              orderId={orderId}
              paymentId={paymentId}
              initialPaymentApproved={mpReturnStatus === 'approved'}
            />
          ) : (hasSession ? <SuccessVerification sessionId={sessionId} /> : null)}

          <div className="mt-8 space-y-4">
            <p className="text-center text-sm font-medium text-gray-700">
              ¿Qué sigue?
            </p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>Revisá tu correo electrónico.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <span>Verificá tu WhatsApp.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <span>
                  {reservationCodeValues.length > 0
                    ? 'Presentá tu código de reserva el día de la actividad.'
                    : 'Si luego de unos minutos no recibís el código, comunicate con soporte.'}
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
