import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createPreference, getCheckoutUrl, mercadopagoEnabled } from '@/lib/mercadopago';
import { getPaqueteBySlug, getPaqueteById } from '@/lib/paquetes';
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { computeBaseCapacity, getAvailableForPackageDate, getHeldPeople, getStockDelta, toMillis } from '@/lib/cart/server';
import { orderExternalReference } from '@/lib/orders';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import type { SeatLayoutTemplate } from '@/types';
import {
  computeReservationPricing,
  getAdministrativeFeeExtraSelection,
  getReservationExtraTotalAmount,
  resolveDepartureConfig,
  withSinglePassengerSurcharge,
} from '@/lib/packages/resolve-departure';
import { CART_TERMS_COOKIE_NAME, hasAcceptedCartTerms } from '@/lib/cart/terms';
import {
  deriveLegacyRoomTypeFromSelection,
  isPackageRoomTypeAvailable,
  normalizeRoomSelection,
} from '@/lib/reservas/room-types';
import { normalizeTravelerDetails } from '@/lib/reservas/traveler-utils';

export const runtime = 'nodejs';
const roomTypeSchema = z.string().trim().min(1).max(120);

const travelerDetailsSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(3).max(50),
  document: z.string().min(1).max(50),
  country: z.string().min(2).max(80),
  travelerType: z.enum(['adult', 'minor']).optional().nullable(),
});

const payloadSchema = z.object({
  cartId: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  packageId: z.string().min(1).optional(),
  date: z.string().optional(),
  people: z.number().int().min(1).max(50).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().max(200).optional(),
  customerFirstName: z.string().max(100).optional(),
  customerLastName: z.string().max(100).optional(),
  customerPhone: z.string().max(50).optional(),
  customerDocument: z.string().max(50).optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  roomType: roomTypeSchema.optional(),
  roomSelection: z.array(z.object({
    roomType: roomTypeSchema,
    quantity: z.number().int().min(1).max(50),
  })).max(20).optional(),
  customerComments: z.string().max(500).optional(),
  passengerDetails: z.array(travelerDetailsSchema).max(50).optional(),
  successUrl: z.string().url().optional(),
  failureUrl: z.string().url().optional(),
  pendingUrl: z.string().url().optional(),
  referralCode: z.string().max(60).optional(),
}).refine((data) => {
  if (data.cartId) return true;
  return Boolean(data.people && (data.slug || data.packageId));
}, { message: 'Faltan datos.' });

const getSiteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function getRequestBaseUrl(request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
  }
  try {
    return new URL(request.url).origin.replace(/\/+$/, '');
  } catch {
    return String(getSiteUrl()).replace(/\/+$/, '');
  }
}

function normalizeCartCurrency(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeDigits(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function buildMercadoPagoPayer(input: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  document?: string | null;
}) {
  const email = String(input.email ?? '').trim() || undefined;
  const name = String(input.name ?? '').trim() || undefined;
  const phoneDigits = normalizeDigits(input.phone);
  const documentDigits = normalizeDigits(input.document);
  return {
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
    ...(phoneDigits ? { phone: { number: phoneDigits } } : {}),
    ...(documentDigits ? { identification: { type: 'DNI', number: documentDigits } } : {}),
  };
}

function buildPreferenceExtraItems(params: {
  item: any;
  currency: string;
  index: number;
}) {
  const extras = Array.isArray(params.item?.selectedExtras) ? params.item.selectedExtras : [];
  return extras
    .map((extra: any, extraIndex: number) => {
      const label = String(extra?.label ?? '').trim();
      const amount = Math.max(0, Number(extra?.amount ?? 0) || 0);
      const scope = String(extra?.scope ?? 'per_person');
      const quantity =
        scope === 'per_booking'
          ? 1
          : scope === 'per_selected_seat'
            ? Math.max(1, Number(extra?.quantity ?? 0) || 0)
            : Math.max(1, Number(params.item?.people ?? 0) || 1);
      if (!label || amount <= 0 || quantity <= 0) return null;
      return {
        id: `${params.item.cartItemId || `item-${params.index}`}-extra-${extraIndex}`,
        title: label,
        description: String(params.item?.packageTitle ?? 'Extra de reserva'),
        quantity,
        unit_price: scope === 'per_selected_seat' ? getReservationExtraTotalAmount(extra, 1) / quantity / 100 : amount / 100,
        currency_id: params.currency,
      };
    })
    .filter(Boolean);
}

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  if (error && typeof error === 'object') {
    try {
      return Object.fromEntries(
        Object.getOwnPropertyNames(error).map((key) => [key, (error as Record<string, unknown>)[key]])
      );
    } catch {
      try {
        return JSON.parse(JSON.stringify(error));
      } catch {
        return { value: String(error) };
      }
    }
  }
  return { value: String(error) };
}

function shouldUseMercadoPagoAutoReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.trim().toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.startsWith('192.168.') || host.startsWith('10.')) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function safeReturnUrl(input: string | undefined, fallback: string, baseUrl: string): string {
  if (!input) return fallback;
  try {
    const parsed = new URL(input);
    const base = new URL(baseUrl);
    if (parsed.origin !== base.origin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function withQueryParams(url: string, params: Record<string, string | number | null | undefined>): string {
  try {
    const parsed = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') continue;
      parsed.searchParams.set(key, String(value));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function POST(request: Request) {
  if (!mercadopagoEnabled) {
    return NextResponse.json(
      { error: 'Falta configurar MERCADO_PAGO_ACCESS_TOKEN.' },
      { status: 500 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const {
    cartId,
    slug,
    packageId,
    date: dateParam,
    people: peopleMaybe,
    customerEmail,
    customerName,
    customerFirstName,
    customerLastName,
    customerPhone,
    customerDocument,
    customerBirthDate,
    roomType,
    customerComments,
    successUrl: bodySuccessUrl,
    failureUrl: bodyFailureUrl,
    pendingUrl: bodyPendingUrl,
  } = parsed.data;
  const referralCode = parsed.data.referralCode?.trim() || undefined;
  const roomSelection = normalizeRoomSelection((parsed.data as any).roomSelection);
  const effectiveRoomType = roomSelection.length
    ? deriveLegacyRoomTypeFromSelection(roomSelection)
    : roomType ?? null;
  const fullName = customerName || `${customerFirstName ?? ''} ${customerLastName ?? ''}`.trim();
  const passengerDetails = Array.isArray(parsed.data.passengerDetails)
    ? parsed.data.passengerDetails.map((item) => normalizeTravelerDetails(item))
    : null;
  const date = (dateParam?.trim() && dateParam !== 'sin-fecha') ? dateParam : 'sin-fecha';

  if (cartId) {
    const cookieStore = await cookies();
    const termsCookie = cookieStore.get(CART_TERMS_COOKIE_NAME)?.value;
    if (!hasAcceptedCartTerms(termsCookie, cartId)) {
      return NextResponse.json(
        { error: 'Debés aceptar los términos y condiciones antes de continuar al checkout.' },
        { status: 403 }
      );
    }

    const cartRef = doc(db, 'carts', cartId);
    const cartSnap = await getDoc(cartRef);
    if (!cartSnap.exists()) {
      return NextResponse.json({ error: 'Carrito no encontrado.' }, { status: 404 });
    }
    const cart: any = { id: cartSnap.id, ...(cartSnap.data() as any) };
    const cartStatus = String(cart.status ?? 'active');

    const existingOrderId = cart.orderId ? String(cart.orderId) : '';
    if (existingOrderId) {
      const orderSnap = await getDoc(doc(db, 'orders', existingOrderId));
      if (orderSnap.exists()) {
        const order: any = { id: orderSnap.id, ...(orderSnap.data() as any) };
        const initPoint = order?.payment?.initPoint ? String(order.payment.initPoint) : '';
        const preferenceId = order?.payment?.preferenceId ? String(order.payment.preferenceId) : '';
        if (initPoint && preferenceId) {
          return NextResponse.json({
            url: initPoint,
            preferenceId,
            externalReference: String(order?.payment?.externalReference || orderExternalReference(order.id)),
            intentId: order.checkoutIntentId ?? null,
            orderId: order.id,
          });
        }
      }
    }

    if (!existingOrderId && cartStatus === 'checkout_started' && cart.checkoutIntentId) {
      const intentId = String(cart.checkoutIntentId);
      const intentSnap = await getDoc(doc(db, 'checkoutIntents', intentId));
      if (intentSnap.exists()) {
        const intent: any = intentSnap.data();
        const initPoint = intent.mercadoPagoInitPoint ? String(intent.mercadoPagoInitPoint) : '';
        const preferenceId = intent.mercadoPagoPreferenceId ? String(intent.mercadoPagoPreferenceId) : '';
        const extRef = intent.externalReference ? String(intent.externalReference) : `cart-${cartId}`;
        if (initPoint && preferenceId) {
          const now = Timestamp.now();
          const newOrderId = doc(collection(db, 'orders')).id;
          await setDoc(
            doc(db, 'orders', newOrderId),
            {
              status: 'checkout_started',
              cartId,
              checkoutIntentId: intentId,
              currency: String(intent.currency ?? cart.currency ?? 'ars'),
              amountTotal: Number(intent.amountTotal ?? 0),
              items: Array.isArray(intent.items) ? intent.items : [],
              referral: intent.referral ?? cart.referral ?? null,
              customer: {
          email: intent.customerEmail ?? null,
          name: fullName ?? intent.customerName ?? null,
          firstName: customerFirstName ?? intent.customerFirstName ?? null,
          lastName: customerLastName ?? intent.customerLastName ?? null,
          phone: intent.customerPhone ?? null,
          document: intent.customerDocument ?? null,
          birthDate: intent.customerBirthDate ?? null,
          comments: intent.customerComments ?? null,
        },
              passengerDetails: Array.isArray(intent.passengerDetails) ? intent.passengerDetails : null,
              expiresAt: cart.expiresAt ?? now,
              payment: {
                provider: 'mercadopago',
                externalReference: extRef,
                preferenceId,
                initPoint,
                status: 'created',
                updatedAt: now,
              },
              createdAt: now,
              updatedAt: now,
            },
            { merge: true }
          );
          await updateDoc(cartRef, { orderId: newOrderId, updatedAt: now }).catch(() => {});
          return NextResponse.json({
            url: initPoint,
            preferenceId,
            externalReference: extRef,
            intentId,
            orderId: newOrderId,
          });
        }
      }
    }

    if (cartStatus !== 'active' && cartStatus !== 'checkout_started') {
      return NextResponse.json({ error: 'El carrito no está disponible para checkout.' }, { status: 400 });
    }
    const cartExpired = toMillis(cart.expiresAt) > 0 && toMillis(cart.expiresAt) <= Date.now();
    if (cartExpired) {
      await updateDoc(cartRef, { status: 'expired', updatedAt: Timestamp.now() }).catch(() => {});
      return NextResponse.json({ error: 'El carrito venció. Volvé a intentar.' }, { status: 400 });
    }

    const itemsCol = collection(db, 'carts', cartId, 'items');
    const itemsSnap = await getDocs(query(itemsCol, orderBy('createdAt', 'asc')));
    const cartItems = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (!cartItems.length) {
      return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });
    }

    const now = Timestamp.now();
    const baseUrl = getRequestBaseUrl(request);
    const fallbackSuccessUrl = `${baseUrl}/checkout/success?cart=1&cartId=${encodeURIComponent(cartId)}`;
    const fallbackFailureUrl = `${baseUrl}/checkout/cancel?cart=1&cartId=${encodeURIComponent(cartId)}`;
    const failureUrl = safeReturnUrl(bodyFailureUrl, fallbackFailureUrl, baseUrl);

    const itemsSnapshot: any[] = [];
    let currencyLower: string | null = null;
    let amountTotal = 0;
    let minExpiresMs = Number.POSITIVE_INFINITY;

    for (const it of cartItems) {
      const holdStatus = String(it.holdStatus ?? 'active');
      const expired = toMillis(it.expiresAt) > 0 && toMillis(it.expiresAt) <= Date.now();
      if (holdStatus !== 'active' || expired) {
        return NextResponse.json({ error: 'Hay items vencidos o inválidos en el carrito. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      const itemExpiresMs = toMillis(it.expiresAt);
      if (itemExpiresMs > 0 && itemExpiresMs < minExpiresMs) minExpiresMs = itemExpiresMs;
      const pkg = await getPaqueteById(String(it.packageId));
      if (!pkg) {
        return NextResponse.json({ error: 'Hay paquetes que ya no están disponibles. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      if (pkg.bookingConfig?.enabled === false) {
        return NextResponse.json({ error: 'Hay paquetes con reservas deshabilitadas en el carrito. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      const date = String(it.date || 'sin-fecha');
      const isNoDate = date === 'sin-fecha';
      const departureConfig = resolveDepartureConfig(pkg, date);
      if (!isNoDate) {
        if (!departureConfig.exists) {
          return NextResponse.json({ error: 'Hay salidas que ya no existen en el carrito. Volvé al carrito para actualizar.' }, { status: 400 });
        }
        if (!departureConfig.enabled) {
          return NextResponse.json({ error: 'Hay fechas no habilitadas en el carrito. Volvé al carrito para actualizar.' }, { status: 400 });
        }
      }

      const holdId = String(it.holdId || '');
      if (!holdId) {
        return NextResponse.json({ error: 'Falta el hold de uno o más items. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      const holdSnap = await getDoc(doc(db, 'reservationHolds', holdId));
      if (!holdSnap.exists()) {
        return NextResponse.json({ error: 'Uno o más holds ya no existen. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      const hold: any = holdSnap.data();
      if (String(hold.status ?? 'active') !== 'active') {
        return NextResponse.json({ error: 'Uno o más holds ya no están activos. Volvé al carrito para actualizar.' }, { status: 400 });
      }
      const holdExpired = toMillis(hold.expiresAt) > 0 && toMillis(hold.expiresAt) <= Date.now();
      if (holdExpired) {
        return NextResponse.json({ error: 'Uno o más holds vencieron. Volvé al carrito para actualizar.' }, { status: 400 });
      }

      const itemCurrency = normalizeCartCurrency(departureConfig.currency ?? null);
      if (!itemCurrency) {
        return NextResponse.json({ error: 'Moneda no soportada en el carrito.' }, { status: 400 });
      }
      if (!currencyLower) currencyLower = itemCurrency;
      if (currencyLower !== itemCurrency) {
        return NextResponse.json({ error: 'No se pueden mezclar monedas en el mismo carrito.' }, { status: 400 });
      }
      const people = Number(it.people ?? 0);
      if (!people || people < 1 || people > 50) {
        return NextResponse.json({ error: 'Cantidad de personas inválida en el carrito.' }, { status: 400 });
      }
      const itemRoomSelection = normalizeRoomSelection((it as any).roomSelection);
      const itemRoomType = itemRoomSelection.length
        ? deriveLegacyRoomTypeFromSelection(itemRoomSelection)
        : typeof (it as any).roomType === 'string' ? String((it as any).roomType).trim() : null;
      if (!isPackageRoomTypeAvailable(pkg, itemRoomType as any)) {
        return NextResponse.json(
          { error: `El tipo de habitación no está disponible para ${pkg.titulo}.` },
          { status: 400 }
        );
      }
      const peopleAdults = typeof (it as any).peopleAdults === 'number' ? Number((it as any).peopleAdults) : null;
      const peopleMinors = typeof (it as any).peopleMinors === 'number' ? Number((it as any).peopleMinors) : null;
      const depositPercentAdults = typeof (it as any).depositPercentAdults === 'number' ? Number((it as any).depositPercentAdults) : null;
      const depositPercentMinors = typeof (it as any).depositPercentMinors === 'number' ? Number((it as any).depositPercentMinors) : null;

      const computedPricing = computeReservationPricing(pkg, date, {
        people,
        peopleAdults,
        peopleMinors,
        depositPercentAdults,
        depositPercentMinors,
        roomType: itemRoomType,
        selectedExtras: Array.isArray((it as any).selectedExtras) ? (it as any).selectedExtras : null,
      });
      if (computedPricing.pricingMode === 'percent' && computedPricing.baseUnitAmount < 1) {
        return NextResponse.json({ error: `Falta precio base para calcular porcentaje (${pkg.titulo}).` }, { status: 400 });
      }
      const unitAmount = computedPricing.unitAmount;
      if (unitAmount < 1 || computedPricing.subtotalAmount < 1) {
        return NextResponse.json({ error: `Precio no configurado para ${pkg.titulo}.` }, { status: 400 });
      }

      {
        const seatsEnabled = departureConfig.seatsEnabled;
        if (seatsEnabled) {
          const seatLayoutId = departureConfig.seatLayoutId ?? '';
          if (!seatLayoutId) {
            return NextResponse.json({ error: 'Este paquete requiere butacas, pero no tiene plantilla asignada.' }, { status: 400 });
          }
          const seatLabels = Array.isArray(it.selectedSeats) && it.selectedSeats.length
            ? it.selectedSeats.map((s: any) => String(s))
            : Array.isArray(hold.selectedSeats) && hold.selectedSeats.length
              ? hold.selectedSeats.map((s: any) => String(s))
              : [];
          if (seatLabels.length !== people) {
            return NextResponse.json({ error: 'Faltan butacas para uno o más items. Volvé al carrito para actualizar.' }, { status: 400 });
          }

          const templateSnap = await getDoc(doc(db, 'seatLayouts', seatLayoutId));
          if (!templateSnap.exists()) {
            return NextResponse.json({ error: 'La plantilla de micro asignada no existe. Volvé al carrito para actualizar.' }, { status: 400 });
          }
          const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
          const seatIds = seatIdsFromLabels(template, seatLabels);
          if (seatIds.length !== seatLabels.length) {
            return NextResponse.json({ error: 'Una o más butacas ya no existen. Volvé al carrito para actualizar.' }, { status: 400 });
          }

          const seatResSnap = await getDoc(doc(db, 'seatReservations', getSeatDepartureId(pkg.id, date)));
          if (!seatResSnap.exists()) {
            return NextResponse.json({ error: 'No se pudo validar butacas. Volvé al carrito para actualizar.' }, { status: 400 });
          }
          const seatResData: any = seatResSnap.data();
          const seatsMap: Record<string, any> = seatResData?.seats ?? {};
          for (const seatId of seatIds) {
            const seat = seatsMap[seatId];
            if (!seat) {
              return NextResponse.json({ error: 'Una o más butacas ya no están disponibles. Volvé al carrito para actualizar.' }, { status: 400 });
            }
            if (String(seat.status ?? '') !== 'held') {
              return NextResponse.json({ error: 'Una o más butacas ya no están disponibles. Volvé al carrito para actualizar.' }, { status: 400 });
            }
            if (String(seat.holdId ?? '') !== holdId) {
              return NextResponse.json({ error: 'Una o más butacas ya no están disponibles. Volvé al carrito para actualizar.' }, { status: 400 });
            }
            const exp = toMillis(seat.expiresAt);
            if (!(exp > 0 && exp > Date.now())) {
              return NextResponse.json({ error: 'Una o más butacas vencieron. Volvé al carrito para actualizar.' }, { status: 400 });
            }
          }
        }
      }

      if (!isNoDate) {
        const baseCapacity = computeBaseCapacity(pkg, date);
        if (baseCapacity > 0) {
          const delta = await getStockDelta(pkg.id, date);
          const held = await getHeldPeople(pkg.id, date);
          if (baseCapacity + delta - held < 0) {
            return NextResponse.json({ error: 'El cupo cambió y el carrito quedó inválido. Volvé al carrito para actualizar.' }, { status: 400 });
          }
        }
      }

      const subtotalAmount = computedPricing.subtotalAmount;
      amountTotal += subtotalAmount;
      itemsSnapshot.push({
        cartItemId: it.id,
        holdId,
        packageId: pkg.id,
        packageSlug: pkg.slug,
        packageTitle: pkg.titulo,
        date: it.date,
        people,
        peopleAdults: computedPricing.peopleAdults,
        peopleMinors: computedPricing.peopleMinors,
        pickupPoint: (it as any).pickupPoint ? String((it as any).pickupPoint) : null,
        pickupPointTime: (it as any).pickupPointTime ? String((it as any).pickupPointTime) : null,
        roomType: typeof (it as any).roomType === 'string' ? String((it as any).roomType) : null,
        selectedExtras: Array.isArray((it as any).selectedExtras) ? (it as any).selectedExtras : null,
        unitAmount,
        pricingMode: computedPricing.pricingMode,
        pricingBaseUnitAmount: computedPricing.baseUnitAmount,
        unitAmountAdults: computedPricing.unitAmountAdults,
        unitAmountMinors: computedPricing.unitAmountMinors,
        depositPercentAdults: computedPricing.depositPercentAdults,
        depositPercentMinors: computedPricing.depositPercentMinors,
        baseSubtotalAmount: computedPricing.baseSubtotalAmount,
        extrasTotalAmount: computedPricing.extrasTotalAmount,
        subtotalAmount,
        currency: itemCurrency,
        referralCode: it.referralCode ?? null,
        image: pkg.imagenTarjeta ?? pkg.imagenPrincipal ?? null,
        seatLayoutId:
          (typeof (it as any).seatLayoutId === 'string' ? String((it as any).seatLayoutId).trim() : '') ||
          (typeof hold.seatLayoutId === 'string' ? String(hold.seatLayoutId).trim() : '') ||
          departureConfig.seatLayoutId ||
          null,
        selectedSeats: Array.isArray(it.selectedSeats) ? it.selectedSeats : (Array.isArray(hold.selectedSeats) ? hold.selectedSeats : null),
      });
    }

    const totalPeople = itemsSnapshot.reduce((sum, item) => sum + Math.max(0, Number(item.people ?? 0) || 0), 0);
    if (totalPeople > 1 && (passengerDetails?.length ?? 0) !== totalPeople - 1) {
      return NextResponse.json({ error: 'Faltan los datos de los demás pasajeros.' }, { status: 400 });
    }
    if (totalPeople <= 1 && (passengerDetails?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'No corresponde cargar acompañantes para esta compra.' }, { status: 400 });
    }

    if (!currencyLower) currencyLower = normalizeCartCurrency(cart.currency ?? 'ars');
    const currency = currencyLower.toUpperCase();
    const referralToUse = referralCode || (cart.referral?.code ? String(cart.referral.code) : undefined);

    const orderId = existingOrderId || doc(collection(db, 'orders')).id;
    const externalReference = orderExternalReference(orderId);
    const successUrl = withQueryParams(
      safeReturnUrl(bodySuccessUrl, fallbackSuccessUrl, baseUrl),
      {
        cart: 1,
        cartId,
        orderId,
      }
    );
    const pendingUrl = withQueryParams(
      safeReturnUrl(bodyPendingUrl, successUrl, baseUrl),
      {
        cart: 1,
        cartId,
        orderId,
      }
    );
    const normalizedFailureUrl = withQueryParams(failureUrl, {
      cart: 1,
      cartId,
      orderId,
    });

    if (referralToUse && String(cart.referral?.code ?? '').trim() !== referralToUse) {
      await updateDoc(cartRef, {
        referral: { code: referralToUse },
        updatedAt: now,
      }).catch(() => {});
    }

    const intentRef = doc(db, 'checkoutIntents', `order_${orderId}`);
    const orderRef = doc(db, 'orders', orderId);

    await setDoc(
      orderRef,
      {
        status: 'created',
        cartId,
        checkoutIntentId: intentRef.id,
        currency: currencyLower,
        amountTotal,
        items: itemsSnapshot,
        referral: referralToUse ? { code: referralToUse } : null,
        customer: {
          email: customerEmail ?? null,
          name: fullName ?? null,
          firstName: customerFirstName ?? null,
          lastName: customerLastName ?? null,
          phone: customerPhone ?? null,
          document: customerDocument ?? null,
          birthDate: customerBirthDate ?? null,
          comments: customerComments ?? null,
        },
        passengerDetails: passengerDetails ?? null,
        expiresAt: Timestamp.fromMillis(Number.isFinite(minExpiresMs) ? minExpiresMs : (toMillis(cart.expiresAt) || now.toMillis())),
        payment: { provider: 'mercadopago', externalReference },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await setDoc(
      intentRef,
      {
        status: 'created',
        provider: 'mercadopago',
        cartId,
        orderId,
        items: itemsSnapshot,
        amountTotal,
        currency: currencyLower,
        customerEmail: customerEmail ?? null,
        customerName: fullName ?? null,
        customerFirstName: customerFirstName ?? null,
        customerLastName: customerLastName ?? null,
        customerPhone: customerPhone ?? null,
        customerDocument: customerDocument ?? null,
        customerBirthDate: customerBirthDate ?? null,
        customerComments: customerComments ?? null,
        passengerDetails: passengerDetails ?? null,
        externalReference,
        returnUrls: { successUrl, failureUrl: normalizedFailureUrl, pendingUrl },
        referral: referralToUse ? { code: referralToUse } : null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    try {
      const mpItems = itemsSnapshot.flatMap((it, index) => {
        const adults = typeof (it as any).peopleAdults === 'number' ? Math.max(0, Number((it as any).peopleAdults) || 0) : it.people;
        const minors = typeof (it as any).peopleMinors === 'number' ? Math.max(0, Number((it as any).peopleMinors) || 0) : 0;
        const unitAdults = typeof (it as any).unitAmountAdults === 'number' ? Math.max(0, Number((it as any).unitAmountAdults) || 0) : it.unitAmount;
        const unitMinors = typeof (it as any).unitAmountMinors === 'number' ? Math.max(0, Number((it as any).unitAmountMinors) || 0) : it.unitAmount;
        const useSplit = minors > 0 && unitMinors !== unitAdults;

        const base = {
          currency_id: currency,
          picture_url: it.image ?? undefined,
        };
        if (!useSplit) {
          return [
            {
              ...base,
              id: it.cartItemId || `item-${index}`,
              title: it.packageTitle,
              description: it.date && it.date !== 'sin-fecha'
                ? `Salida ${it.date} · ${it.people} persona${it.people > 1 ? 's' : ''}`
                : `Reserva para ${it.people} persona${it.people > 1 ? 's' : ''}`,
              quantity: it.people,
              unit_price: unitAdults / 100,
            },
            ...buildPreferenceExtraItems({ item: it, currency, index }),
          ];
        }

        const parts: any[] = [];
        if (adults > 0) {
          parts.push({
            ...base,
            id: `${it.cartItemId || `item-${index}`}-adult`,
            title: `${it.packageTitle} (Adultos)`,
            description: it.date && it.date !== 'sin-fecha'
              ? `Salida ${it.date} · Adultos (${adults})`
              : `Adultos (${adults})`,
            quantity: adults,
            unit_price: unitAdults / 100,
          });
        }
        if (minors > 0) {
          parts.push({
            ...base,
            id: `${it.cartItemId || `item-${index}`}-minor`,
            title: `${it.packageTitle} (Menores)`,
            description: it.date && it.date !== 'sin-fecha'
              ? `Salida ${it.date} · Menores (${minors})`
              : `Menores (${minors})`,
            quantity: minors,
            unit_price: unitMinors / 100,
          });
        }
        return [...parts, ...buildPreferenceExtraItems({ item: it, currency, index })];
      });
      const preferenceResult = await createPreference({
        items: mpItems,
        external_reference: externalReference,
        back_urls: { success: successUrl, failure: normalizedFailureUrl, pending: pendingUrl },
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        payer: buildMercadoPagoPayer({
          email: customerEmail,
          name: fullName,
          phone: customerPhone,
          document: customerDocument,
        }),
        auto_return: shouldUseMercadoPagoAutoReturn(successUrl) ? 'approved' : undefined,
      });

      const checkoutUrl = getCheckoutUrl(preferenceResult);
      if (!checkoutUrl) throw new Error('No se pudo obtener URL de checkout de Mercado Pago');

      await updateDoc(intentRef, {
        status: 'redirected',
        mercadoPagoPreferenceId: preferenceResult.id,
        mercadoPagoInitPoint: checkoutUrl,
        updatedAt: Timestamp.now(),
      });
      await updateDoc(orderRef, {
        status: 'checkout_started',
        payment: {
          provider: 'mercadopago',
          externalReference,
          preferenceId: preferenceResult.id,
          initPoint: checkoutUrl,
          status: 'created',
          updatedAt: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
      }).catch(() => {});
      await updateDoc(cartRef, {
        status: 'checkout_started',
        orderId,
        checkoutIntentId: intentRef.id,
        mercadoPagoPreferenceId: preferenceResult.id,
        updatedAt: Timestamp.now(),
      }).catch(() => {});

      return NextResponse.json({
        url: checkoutUrl,
        preferenceId: preferenceResult.id,
        externalReference,
        intentId: intentRef.id,
        orderId,
      });
    } catch (error) {
      const serializedError = serializeUnknownError(error);
      await updateDoc(intentRef, {
        status: 'failed',
        lastError: JSON.stringify(serializedError),
        updatedAt: Timestamp.now(),
      }).catch(() => {});
      await updateDoc(orderRef, {
        status: 'failed',
        failureReason: JSON.stringify(serializedError),
        updatedAt: Timestamp.now(),
      }).catch(() => {});
      return NextResponse.json(
        {
          error: 'No se pudo crear la preferencia de pago.',
          detail: serializedError,
        },
        { status: 500 }
      );
    }
  }

  let paquete = null;
  if (slug) {
    paquete = await getPaqueteBySlug(slug);
  } else if (packageId) {
    paquete = await getPaqueteById(packageId);
  }

  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado.' }, { status: 404 });
  }

  const bc = paquete.bookingConfig;
  const departureConfig = resolveDepartureConfig(paquete, date);
  const maxPeople = departureConfig.maxPeople;
  const people = peopleMaybe ?? 0;
  if (people > maxPeople) {
    return NextResponse.json({ error: 'Cantidad de personas inválida.' }, { status: 400 });
  }
  if (people > 1 && (passengerDetails?.length ?? 0) !== people - 1) {
    return NextResponse.json({ error: 'Faltan los datos de los demás pasajeros.' }, { status: 400 });
  }
  if (people <= 1 && (passengerDetails?.length ?? 0) > 0) {
    return NextResponse.json({ error: 'No corresponde cargar acompañantes para esta compra.' }, { status: 400 });
  }
  if (!isPackageRoomTypeAvailable(paquete, effectiveRoomType)) {
    return NextResponse.json(
      { error: 'El tipo de habitación no está disponible para este paquete.' },
      { status: 400 }
    );
  }

  // Validar cupos disponibles
  if (date !== 'sin-fecha') {
    if (!departureConfig.exists) {
      return NextResponse.json({ error: 'La salida seleccionada no existe.' }, { status: 400 });
    }
    if (!departureConfig.enabled) {
      return NextResponse.json({ error: 'La fecha seleccionada no está habilitada.' }, { status: 400 });
    }
    const available = await getAvailableForPackageDate(paquete, date);
    if (people > available) {
      return NextResponse.json(
        { error: 'No hay cupo suficiente para esa fecha. Actualizá la página y elegí otra fecha o menos personas.' },
        { status: 400 }
      );
    }
  }

  // Validar que las reservas estén habilitadas
  if (!bc?.enabled) {
    return NextResponse.json(
      { error: 'Las reservas no están habilitadas para esta experiencia.' },
      { status: 400 }
    );
  }

  const directSelectedExtras = [getAdministrativeFeeExtraSelection(paquete)].filter(
    (item): item is NonNullable<ReturnType<typeof getAdministrativeFeeExtraSelection>> => Boolean(item)
  );
  const computedPricing = computeReservationPricing(paquete, date, {
    people,
    roomType: effectiveRoomType,
    selectedExtras: directSelectedExtras,
  });
  const pricedSelectedExtras = withSinglePassengerSurcharge({
    selectedExtras: directSelectedExtras,
    baseSubtotalAmount: computedPricing.baseSubtotalAmount,
    people,
  });
  const unitPrice = computedPricing.unitAmount;
  const currency = String(computedPricing.currency || 'ars').toUpperCase();

  if (computedPricing.pricingMode === 'percent' && computedPricing.baseUnitAmount < 1) {
    return NextResponse.json({ error: 'Falta precio base para calcular porcentaje.' }, { status: 400 });
  }
  if (unitPrice < 1 || computedPricing.subtotalAmount < 1) {
    return NextResponse.json({ error: 'Precio de reserva no configurado para este paquete.' }, { status: 400 });
  }

  const baseUrl = getRequestBaseUrl(request);
  const sessionAmount = computedPricing.subtotalAmount;

  // Construir URLs de retorno
  const successUrl = withQueryParams(
    safeReturnUrl(bodySuccessUrl, `${baseUrl}/checkout/success`, baseUrl),
    {
      slug: paquete.slug,
      date,
      people,
    }
  );
  const failureUrl = withQueryParams(
    safeReturnUrl(bodyFailureUrl, `${baseUrl}/checkout/cancel`, baseUrl),
    {
      slug: paquete.slug,
      date,
      people,
    }
  );
  const pendingUrl = withQueryParams(
    safeReturnUrl(bodyPendingUrl, successUrl, baseUrl),
    {
      slug: paquete.slug,
      date,
      people,
    }
  );

  // Registrar intento de checkout para trazabilidad
  const now = Timestamp.now();
  const intentRef = doc(collection(db, 'checkoutIntents'));
  const intentId = intentRef.id;
  const externalReference = `pkg-${paquete.id}-${Date.now()}`;

  await setDoc(intentRef, {
    status: 'created',
    provider: 'mercadopago',
    packageId: paquete.id,
    packageSlug: paquete.slug,
    packageTitle: paquete.titulo,
    date,
    people,
    unitPrice,
    selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
    baseSubtotalAmount: computedPricing.baseSubtotalAmount,
    extrasTotalAmount: computedPricing.extrasTotalAmount,
    amountTotal: sessionAmount,
    currency: currency.toLowerCase(),
    customerEmail: customerEmail ?? null,
    customerName: fullName ?? null,
    customerFirstName: customerFirstName ?? null,
    customerLastName: customerLastName ?? null,
    customerPhone: customerPhone ?? null,
    customerDocument: customerDocument ?? null,
    customerBirthDate: customerBirthDate ?? null,
    roomType: effectiveRoomType,
    roomSelection: roomSelection.length ? roomSelection : null,
    customerComments: customerComments ?? null,
    passengerDetails: passengerDetails ?? null,
    externalReference,
    bookingConfigSnapshot: {
      currency: bc?.currency ?? null,
      depositAmount: typeof bc?.depositAmount === 'number' ? bc.depositAmount : null,
      maxPeoplePerBooking: typeof bc?.maxPeoplePerBooking === 'number' ? bc.maxPeoplePerBooking : null,
      hasSpecificDates: Boolean(bc?.hasSpecificDates),
      enabled: Boolean(bc?.enabled),
    },
    returnUrls: {
      successUrl,
      failureUrl,
      pendingUrl,
    },
    referral: referralCode ? { code: referralCode } : null,
    createdAt: now,
    updatedAt: now,
  });

  try {
    // Crear preferencia de pago en Mercado Pago
    const productImage = paquete.imagenTarjeta ?? paquete.imagenPrincipal;
    
    const preferenceResult = await createPreference({
      items: [
        {
          title: paquete.titulo,
          description: paquete.descripcionCorta ?? `Reserva para ${people} persona${people > 1 ? 's' : ''}`,
          quantity: people,
          unit_price: unitPrice / 100,
          currency_id: currency,
          picture_url: productImage ?? undefined,
        },
        ...buildPreferenceExtraItems({
          item: {
            selectedExtras: pricedSelectedExtras,
            people,
            packageTitle: paquete.titulo,
          },
          currency,
          index: 0,
        }),
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
      payer: buildMercadoPagoPayer({
        email: customerEmail,
        name: fullName,
        phone: customerPhone,
        document: customerDocument,
      }),
      auto_return: shouldUseMercadoPagoAutoReturn(successUrl) ? 'approved' : undefined,
    });

    const checkoutUrl = getCheckoutUrl(preferenceResult);

    if (!checkoutUrl) {
      throw new Error('No se pudo obtener URL de checkout de Mercado Pago');
    }

    // Actualizar intent con datos de la preferencia
    await updateDoc(intentRef, {
      status: 'redirected',
      mercadoPagoPreferenceId: preferenceResult.id,
      mercadoPagoInitPoint: checkoutUrl,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ 
      url: checkoutUrl,
      preferenceId: preferenceResult.id,
      externalReference,
      intentId,
    });

  } catch (error) {
    console.error('[mercadopago-preference]', error);
    
    // Marcar intent como fallido
    await updateDoc(intentRef, {
      status: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json(
      {
        error: 'No se pudo crear la preferencia de pago.',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
