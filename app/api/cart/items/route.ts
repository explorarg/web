import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { getPaqueteById, getPaqueteBySlug } from '@/lib/paquetes';
import {
  CART_COOKIE_NAME,
  addMinutes,
  computeBaseCapacity,
  computeCurrency,
  computeMaxPeople,
  computeUnitAmount,
  getAvailableForPackageDate,
  getHoldMinutes,
  getStockDelta,
  toMillis,
} from '@/lib/cart/server';
import { buildBaseSeatReservationSeats, getSeatDepartureId, seatIdsFromLabels, type SeatReservationDoc } from '@/lib/seats/server';
import { Timestamp, collection, doc, getDoc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import type { SeatLayoutTemplate } from '@/types';
import { resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import { computeReservationPricing } from '@/lib/packages/resolve-departure';
import { resolveReservationExtraSelections } from '@/lib/packages/resolve-departure';
import { withSinglePassengerSurcharge } from '@/lib/packages/resolve-departure';
import {
  deriveLegacyRoomTypeFromSelection,
  getPackageRoomTypes,
  getPackageRoomTypeOptions,
  isPackageRoomTypeAvailable,
  normalizeRoomSelection,
} from '@/lib/reservas/room-types';

export const runtime = 'nodejs';

const roomTypeSchema = z.string().trim().min(1).max(120);

function normalizeCartCurrency(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

const addItemSchema = z.object({
  slug: z.string().min(1).optional(),
  packageId: z.string().min(1).optional(),
  date: z.string().min(1),
  people: z.number().int().min(1).max(50).optional(),
  peopleAdults: z.number().int().min(0).max(50).optional(),
  peopleMinors: z.number().int().min(0).max(50).optional(),
  depositPercentAdults: z.number().min(0).max(100).nullable().optional(),
  depositPercentMinors: z.number().min(0).max(100).nullable().optional(),
  roomType: roomTypeSchema.optional(),
  roomSelection: z.array(z.object({
    roomType: roomTypeSchema,
    quantity: z.number().int().min(1).max(50),
  })).max(20).optional(),
  pickupPoint: z.string().max(120).optional(),
  pickupPointTime: z.string().max(20).nullable().optional(),
  referralCode: z.string().max(60).optional(),
  selectedSeats: z.array(z.string().min(1).max(20)).max(200).optional(),
}).refine((data) => {
  const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
  const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
  const total = a + m;
  if (total > 0) return total >= 1 && total <= 50;
  return typeof data.people === 'number' && data.people >= 1 && data.people <= 50;
});

const removeItemSchema = z.object({
  itemId: z.string().min(1),
});

const updateItemSchema = z
  .object({
    itemId: z.string().min(1),
    people: z.number().int().min(1).max(50).optional(),
    peopleAdults: z.number().int().min(0).max(50).optional(),
    peopleMinors: z.number().int().min(0).max(50).optional(),
    depositPercentAdults: z.number().min(0).max(100).nullable().optional(),
    depositPercentMinors: z.number().min(0).max(100).nullable().optional(),
    roomType: roomTypeSchema.nullable().optional(),
    roomSelection: z.array(z.object({
      roomType: roomTypeSchema,
      quantity: z.number().int().min(1).max(50),
    })).max(20).nullable().optional(),
    pickupPoint: z.string().max(120).optional(),
    pickupPointTime: z.string().max(20).nullable().optional(),
    selectedSeats: z.array(z.string().min(1).max(20)).max(200).optional(),
  })
  .refine((data) => {
    const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
    const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
    const total = a + m;
    if (total > 0) return total >= 1 && total <= 50;
    if (typeof data.people === 'number') return data.people >= 1 && data.people <= 50;
    if (
      data.depositPercentAdults !== undefined ||
      data.depositPercentMinors !== undefined
    ) return true;
    if (typeof data.roomType === 'string' || data.roomType === null) return true;
    if (typeof data.pickupPointTime === 'string' || data.pickupPointTime === null) return true;
    return Array.isArray(data.selectedSeats) || typeof data.pickupPoint === 'string';
  });

const updateSeatsSchema = z.object({
  itemId: z.string().min(1),
  selectedSeats: z.array(z.string().min(1).max(20)).max(200),
});

function isExpired(expiresAt: unknown): boolean {
  const ms = toMillis(expiresAt);
  return ms > 0 && ms <= Date.now();
}

function resolvePickupPointTime(paquete: any, pickupPoint: string, rawTime?: string | null): string | null {
  const incoming = String(rawTime ?? '').trim();
  if (incoming) return incoming;
  const config = paquete?.pickupPointsConfig;
  if (!Array.isArray(config)) return null;
  const found = config.find((item: any) => String(item?.label ?? '').trim() === pickupPoint);
  const time = found ? String(found?.time ?? '').trim() : '';
  return time || null;
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = addItemSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const { slug, packageId, date: dateRaw } = parsed.data;
  const adults = Math.max(0, Number(parsed.data.peopleAdults ?? 0) || 0);
  const minors = Math.max(0, Number(parsed.data.peopleMinors ?? 0) || 0);
  const derivedPeople = adults + minors;
  const people = derivedPeople > 0 ? derivedPeople : Math.max(1, Number(parsed.data.people ?? 1) || 1);
  const peopleAdults = derivedPeople > 0 ? adults : null;
  const peopleMinors = derivedPeople > 0 ? minors : null;
  const pickupPoint = parsed.data.pickupPoint ? String(parsed.data.pickupPoint).trim() : '';
  const pickupPointTime = parsed.data.pickupPointTime ? String(parsed.data.pickupPointTime).trim() : '';
  const depositPercentAdults = typeof parsed.data.depositPercentAdults === 'number' ? parsed.data.depositPercentAdults : null;
  const depositPercentMinors = typeof parsed.data.depositPercentMinors === 'number' ? parsed.data.depositPercentMinors : null;
  const roomSelection = normalizeRoomSelection(parsed.data.roomSelection as any);
  const roomType = roomSelection.length
    ? deriveLegacyRoomTypeFromSelection(roomSelection)
    : parsed.data.roomType ? String(parsed.data.roomType).trim() : null;
  const roomSelectionMetrics = roomSelection.length
    ? {
        selectionKey: roomSelection.map((item) => `${item.roomType}:${item.quantity}`).join('|'),
        totalRooms: roomSelection.reduce((sum, item) => sum + item.quantity, 0),
        totalCapacity: people,
        people,
        generatedAt: Timestamp.now(),
      }
    : null;
  const referralCode = parsed.data.referralCode?.trim() || undefined;
  const date = dateRaw.trim();
  const isNoDate = date === 'sin-fecha';
  const selectedSeatsRaw = Array.isArray(parsed.data.selectedSeats) ? parsed.data.selectedSeats : [];
  
  // Extraer solo la etiqueta original (parte antes del primer '|') para el proceso de negocio
  // Pero guardaremos el label completo con fila/col para mostrarlo en la UI
  const selectedSeats = Array.from(new Set(selectedSeatsRaw.map((s) => {
    const parts = String(s).trim().split('|');
    if (parts.length >= 2) {
      // Formato: id|label|fila|col -> Guardamos como "label (Fila fila, Col col)"
      return `${parts[1]} (Fila ${parts[2]}, Col ${parts[3]})`;
    }
    return parts[0];
  }).filter(Boolean)));

  let paquete = null;
  if (slug) paquete = await getPaqueteBySlug(slug);
  else if (packageId) paquete = await getPaqueteById(packageId);

  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado.' }, { status: 404 });
  }

  if (roomType && !isPackageRoomTypeAvailable(paquete, roomType as any)) {
    return NextResponse.json({ error: 'El tipo de habitación no está disponible para este paquete.' }, { status: 400 });
  }
  const availableRoomTypes = getPackageRoomTypes(paquete);
  const availableRoomTypeOptions = getPackageRoomTypeOptions(paquete);

  const bc = paquete.bookingConfig;
  if (bc?.enabled === false) {
    return NextResponse.json(
      { error: 'Las reservas no están habilitadas para este paquete.' },
      { status: 400 }
    );
  }

  const departureConfig = resolveDepartureConfig(paquete, date);
  const seatsEnabled = departureConfig.seatsEnabled;
  const seatLayoutId = departureConfig.seatLayoutId ?? '';

  if (seatsEnabled) {
    if (!seatLayoutId) {
      return NextResponse.json({ error: 'Este paquete requiere butacas, pero no tiene plantilla asignada.' }, { status: 400 });
    }
    if (selectedSeats.length !== people) {
      return NextResponse.json({ error: 'Debés seleccionar una butaca por pasajero.' }, { status: 400 });
    }
  }
  if (!isNoDate) {
    if (!departureConfig.exists) {
      return NextResponse.json({ error: 'La salida seleccionada no existe.' }, { status: 400 });
    }
    if (!departureConfig.enabled) {
      return NextResponse.json({ error: 'La fecha seleccionada no está habilitada.' }, { status: 400 });
    }
  }

  const maxPeople = departureConfig.maxPeople;
  if (people > maxPeople) {
    return NextResponse.json({ error: 'Cantidad de personas inválida.' }, { status: 400 });
  }

  const pricing = computeReservationPricing(paquete, date, {
    people,
    peopleAdults,
    peopleMinors,
    depositPercentAdults,
    depositPercentMinors,
  });
  const unitAmount = pricing.unitAmount;
  const currency = pricing.currency;
  if (!currency) {
    return NextResponse.json({ error: 'Moneda no soportada para este paquete.' }, { status: 400 });
  }
  if (pricing.pricingMode === 'percent' && pricing.baseUnitAmount < 1) {
    return NextResponse.json({ error: 'No se puede calcular porcentaje porque falta precio base del paquete/salida.' }, { status: 400 });
  }
  if (unitAmount < 1) {
    return NextResponse.json({ error: 'Precio de reserva no configurado para este paquete.' }, { status: 400 });
  }

  const baseCapacity = computeBaseCapacity(paquete, date);
  const enforceCapacity = !isNoDate && baseCapacity > 0;

  if (enforceCapacity) {
    const available = await getAvailableForPackageDate(paquete, date);
    if (people > available) {
      return NextResponse.json(
        { error: 'No hay cupo suficiente para esa fecha. Actualizá la página y elegí otra fecha o menos personas.' },
        { status: 400 }
      );
    }
  }

  const now = Timestamp.now();
  const holdMinutes = getHoldMinutes();
  const expiresAt = addMinutes(now, holdMinutes);
  const delta = enforceCapacity ? await getStockDelta(paquete.id, date) : 0;
  const resolvedPickupPointTime = pickupPoint ? resolvePickupPointTime(paquete, pickupPoint, pickupPointTime || null) : null;
  let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
  if (departureConfig.seatLayoutId && selectedSeats.length > 0) {
    const templateSnap = await getDoc(doc(db, 'seatLayouts', departureConfig.seatLayoutId));
    if (!templateSnap.exists()) {
      return NextResponse.json({ error: 'Plantilla de micro no encontrada.' }, { status: 400 });
    }
    seatLayoutTemplateForExtras = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
  }
  const selectedExtras = resolveReservationExtraSelections({
    paquete,
    pickupPoint: pickupPoint || null,
    selectedSeats,
    seatLayoutTemplate: seatLayoutTemplateForExtras,
  });
  const repriced = computeReservationPricing(paquete, date, {
    people,
    peopleAdults,
    peopleMinors,
    depositPercentAdults,
    depositPercentMinors,
    roomType,
    selectedExtras,
  });
  const pricedSelectedExtras = withSinglePassengerSurcharge({
    selectedExtras,
    baseSubtotalAmount: repriced.baseSubtotalAmount,
    people,
  });
  const subtotalAmount = repriced.subtotalAmount;

  let cartId = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (cartId) {
    const existingCartSnap = await getDoc(doc(db, 'carts', cartId)).catch(() => null);
    if (!existingCartSnap?.exists()) {
      cartId = null;
    } else {
      const data: any = existingCartSnap.data();
      const status = String(data?.status ?? 'active');
      if (status !== 'active' || isExpired(data?.expiresAt)) {
        cartId = null;
      }
    }
  }
  if (!cartId) {
    const newRef = doc(collection(db, 'carts'));
    cartId = newRef.id;
    await setDoc(newRef, {
      status: 'active',
      currency,
      referral: referralCode ? { code: referralCode } : null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!cartId) {
    return NextResponse.json({ error: 'Carrito no encontrado.' }, { status: 404 });
  }

  const addToCartForCartId = async (cartIdToUse: string) => {
    const cartId = cartIdToUse;
    const cartRef = doc(db, 'carts', cartId);
    const itemRef = doc(collection(db, 'carts', cartId, 'items'));
    const holdRef = doc(collection(db, 'reservationHolds'));
    const lockRef = doc(db, 'stockHolds', `${paquete.id}_${date}`);
    const seatDepartureId = getSeatDepartureId(paquete.id, date);
    const seatResRef = doc(db, 'seatReservations', seatDepartureId);

    await runTransaction(db, async (tx) => {
      const cartSnap = await tx.get(cartRef);
      const cartData: any = cartSnap.exists() ? cartSnap.data() : null;
      const cartWriteBase: Record<string, any> = cartSnap.exists()
        ? {}
        : {
            status: 'active',
            currency,
            referral: referralCode ? { code: referralCode } : null,
            createdAt: now,
          };
      if (cartSnap.exists()) {
        if (cartData.status !== 'active') throw new Error('El carrito no está activo.');
        if (isExpired(cartData.expiresAt)) {
          tx.update(cartRef, { status: 'expired', updatedAt: now });
          throw new Error('El carrito venció. Volvé a intentar.');
        }
        const cartCurrency = normalizeCartCurrency(cartData.currency);
        const nextCurrency = normalizeCartCurrency(currency);
        if (cartCurrency && nextCurrency && cartCurrency !== nextCurrency) {
          throw new Error('No se pueden mezclar monedas en el mismo carrito.');
        }
        if (cartCurrency !== nextCurrency && nextCurrency) {
          cartWriteBase.currency = nextCurrency;
        }
        if (!cartData.referral && referralCode) {
          cartWriteBase.referral = { code: referralCode };
        }
      }

      let pendingLockWrite:
        | {
            mode: 'set' | 'update';
            data: Record<string, any>;
          }
        | null = null;
      if (enforceCapacity) {
        const lockSnap = await tx.get(lockRef);
        const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
        const availableNow = Math.max(0, baseCapacity + delta - Math.max(0, heldPeople));
        if (people > availableNow) {
          throw new Error('No hay cupo suficiente para esa fecha.');
        }

        if (!lockSnap.exists()) {
          pendingLockWrite = {
            mode: 'set',
            data: { packageId: paquete.id, date, heldPeople: people, updatedAt: now, createdAt: now },
          };
        } else {
          pendingLockWrite = {
            mode: 'update',
            data: { heldPeople: Math.max(0, heldPeople) + people, updatedAt: now },
          };
        }
      }

      if (seatsEnabled) {
        const templateRef = doc(db, 'seatLayouts', seatLayoutId);
        const templateSnap = await tx.get(templateRef);
        if (!templateSnap.exists()) {
          throw new Error('Plantilla de micro no encontrada.');
        }
        const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
        const baseSeats = buildBaseSeatReservationSeats(template);
        const seatResSnap = await tx.get(seatResRef);
        let seatRes: SeatReservationDoc;
        if (seatResSnap.exists()) {
          const data = seatResSnap.data() as any;
          const currentLayoutId = String(data?.seatLayoutId ?? '');
          seatRes = {
            id: seatResSnap.id,
            packageId: String(data?.packageId ?? paquete.id),
            date: String(data?.date ?? date),
            seatLayoutId: currentLayoutId || seatLayoutId,
            seats: (data?.seats ?? {}) as Record<string, any>,
            createdAt: (data?.createdAt ?? now) as any,
            updatedAt: (data?.updatedAt ?? now) as any,
          };
          if (currentLayoutId && currentLayoutId !== seatLayoutId) {
            seatRes.seats = baseSeats;
            seatRes.seatLayoutId = seatLayoutId;
          }
        } else {
          seatRes = { id: seatDepartureId, packageId: paquete.id, date, seatLayoutId, seats: baseSeats, createdAt: now, updatedAt: now };
          tx.set(seatResRef, { packageId: paquete.id, date, seatLayoutId, seats: baseSeats, createdAt: now, updatedAt: now });
        }

        const seatIds = seatIdsFromLabels(template, selectedSeats);
        if (seatIds.length !== selectedSeats.length) {
          throw new Error('Una o más butacas no existen en la plantilla.');
        }
        if (selectedSeats.length !== people) {
          throw new Error('Debés seleccionar una butaca por pasajero.');
        }

        for (const seatId of seatIds) {
          const current = seatRes.seats?.[seatId] ?? baseSeats[seatId];
          if (!current) throw new Error('Una o más butacas no existen en la plantilla.');
          const status = String(current.status ?? 'available') as any;
          if (status === 'available') continue;
          if (status === 'held') {
            const exp = toMillis(current.expiresAt);
            if (exp > 0 && exp <= now.toMillis()) {
              continue;
            }
          }
          throw new Error('Una o más butacas no están disponibles.');
        }

        for (const seatId of seatIds) {
          seatRes.seats[seatId] = {
            status: 'held',
            holdId: holdRef.id,
            cartId,
            cartItemId: itemRef.id,
            expiresAt,
            blockedBy: null,
            updatedAt: now,
          };
        }
        tx.set(
          seatResRef,
          {
            packageId: paquete.id,
            date,
            seatLayoutId,
            seats: seatRes.seats,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      const currentExpiresMs = cartData ? toMillis(cartData.expiresAt) : 0;
      const nextExpiresMs = Math.min(
        currentExpiresMs > 0 ? currentExpiresMs : expiresAt.toMillis(),
        expiresAt.toMillis()
      );
      const nextCartWrite = {
        ...cartWriteBase,
        expiresAt: Timestamp.fromMillis(nextExpiresMs),
        updatedAt: now,
      };
      if (cartSnap.exists()) {
        tx.update(cartRef, nextCartWrite);
      } else {
        tx.set(cartRef, nextCartWrite);
      }
      if (pendingLockWrite) {
        if (pendingLockWrite.mode === 'set') {
          tx.set(lockRef, pendingLockWrite.data);
        } else {
          tx.update(lockRef, pendingLockWrite.data);
        }
      }

      tx.set(holdRef, {
        cartId,
        cartItemId: itemRef.id,
        packageId: paquete.id,
        date,
        seatLayoutId: seatsEnabled ? seatLayoutId : null,
        people,
        peopleAdults,
        peopleMinors,
        pickupPoint: pickupPoint || null,
        pickupPointTime: resolvedPickupPointTime,
        roomType,
        roomSelection: roomSelection.length ? roomSelection : null,
        roomSelectionMetrics,
        selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
        pricingMode: pricing.pricingMode,
        pricingBaseUnitAmount: repriced.baseUnitAmount,
        unitAmountAdults: repriced.unitAmountAdults,
        unitAmountMinors: repriced.unitAmountMinors,
        depositPercentAdults: repriced.depositPercentAdults,
        depositPercentMinors: repriced.depositPercentMinors,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        extrasTotalAmount: repriced.extrasTotalAmount,
        status: 'active',
        expiresAt,
        createdAt: now,
        updatedAt: now,
        selectedSeats: selectedSeats.length ? selectedSeats : null,
      });

      tx.set(itemRef, {
        cartId,
        packageId: paquete.id,
        packageSlug: paquete.slug,
        packageTitle: paquete.titulo,
        packageImage:
          paquete.imagenTarjeta ||
          paquete.imagenPrincipal ||
          (paquete as any).imagenPortada ||
          (Array.isArray((paquete as any).galeria) ? (paquete as any).galeria[0] : null) ||
          null,
        packageDestination: paquete.destino || (paquete as any).eventoLugar || null,
        packageDuration: paquete.duracion || null,
        packageIsFeatured: Boolean((paquete as any).destacado),
        packageType: (paquete as any).tipo || null,
        availableRoomTypes,
        availableRoomTypeOptions,
        date,
        people,
        peopleAdults,
        peopleMinors,
        pickupPoint: pickupPoint || null,
        pickupPointTime: resolvedPickupPointTime,
        roomType,
        roomSelection: roomSelection.length ? roomSelection : null,
        roomSelectionMetrics,
        selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
        unitAmount,
        pricingMode: repriced.pricingMode,
        pricingBaseUnitAmount: repriced.baseUnitAmount,
        unitAmountAdults: repriced.unitAmountAdults,
        unitAmountMinors: repriced.unitAmountMinors,
        depositPercentAdults: repriced.depositPercentAdults,
        depositPercentMinors: repriced.depositPercentMinors,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        extrasTotalAmount: repriced.extrasTotalAmount,
        subtotalAmount,
        currency,
        holdId: holdRef.id,
        holdStatus: 'active',
        seatLayoutId: seatsEnabled ? seatLayoutId : null,
        expiresAt,
        referralCode: referralCode ?? null,
        selectedSeats: selectedSeats.length ? selectedSeats : null,
        createdAt: now,
        updatedAt: now,
      });
    });
    return { cartId, itemId: itemRef.id, holdId: holdRef.id };
  };

  let result: { cartId: string; itemId: string; holdId: string };
  let replacedCart = false;

  try {
    result = await addToCartForCartId(cartId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo agregar al carrito.';
    if (message !== 'No se pueden mezclar monedas en el mismo carrito.') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const newRef = doc(collection(db, 'carts'));
    const newCartId = newRef.id;
    await setDoc(newRef, {
      status: 'active',
      currency: normalizeCartCurrency(currency) || currency,
      referral: referralCode ? { code: referralCode } : null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    try {
      result = await addToCartForCartId(newCartId);
      replacedCart = true;
    } catch (err2) {
      const message2 = err2 instanceof Error ? err2.message : 'No se pudo agregar al carrito.';
      return NextResponse.json({ error: message2 }, { status: 400 });
    }
  }

  const res = NextResponse.json({
    ok: true,
    cartId: result.cartId,
    replacedCart,
    item: {
      id: result.itemId,
      cartId: result.cartId,
      packageId: paquete.id,
      packageSlug: paquete.slug,
      packageTitle: paquete.titulo,
      packageImage:
        paquete.imagenTarjeta ||
        paquete.imagenPrincipal ||
        (paquete as any).imagenPortada ||
        (Array.isArray((paquete as any).galeria) ? (paquete as any).galeria[0] : null) ||
        null,
      packageDestination: paquete.destino || (paquete as any).eventoLugar || null,
      packageDuration: paquete.duracion || null,
      packageIsFeatured: Boolean((paquete as any).destacado),
      packageType: (paquete as any).tipo || null,
      availableRoomTypes,
      availableRoomTypeOptions,
      date,
      people,
      peopleAdults,
      peopleMinors,
      pickupPoint: pickupPoint || null,
      pickupPointTime: resolvedPickupPointTime,
      roomType,
      roomSelection: roomSelection.length ? roomSelection : null,
      roomSelectionMetrics,
      selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
      unitAmount,
      pricingMode: repriced.pricingMode,
      pricingBaseUnitAmount: repriced.baseUnitAmount,
      unitAmountAdults: repriced.unitAmountAdults,
      unitAmountMinors: repriced.unitAmountMinors,
      depositPercentAdults: repriced.depositPercentAdults,
      depositPercentMinors: repriced.depositPercentMinors,
      baseSubtotalAmount: repriced.baseSubtotalAmount,
      extrasTotalAmount: repriced.extrasTotalAmount,
      subtotalAmount,
      currency,
      holdId: result.holdId,
      expiresAt: expiresAt.toMillis(),
      holdStatus: 'active',
      seatLayoutId: seatsEnabled ? seatLayoutId : null,
      selectedSeats: selectedSeats.length ? selectedSeats : null,
    },
  });
  res.cookies.set(CART_COOKIE_NAME, result.cartId, { httpOnly: true, sameSite: 'lax', path: '/' });
  return res;
}

export async function DELETE(request: NextRequest) {
  const cartId = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (!cartId) {
    return NextResponse.json({ error: 'Carrito no encontrado.' }, { status: 404 });
  }
  const payload = await request.json().catch(() => null);
  const parsed = removeItemSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const { itemId } = parsed.data;
  const now = Timestamp.now();

  const cartRef = doc(db, 'carts', cartId);
  const itemRef = doc(db, 'carts', cartId, 'items', itemId);

  try {
    await runTransaction(db, async (tx) => {
      const cartSnap = await tx.get(cartRef);
      if (!cartSnap.exists()) throw new Error('Carrito no encontrado.');
      const cartData: any = cartSnap.data();
      if (cartData.status === 'paid') throw new Error('El carrito ya fue pagado.');

      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists()) throw new Error('Item no encontrado.');
      const item: any = itemSnap.data();

      const holdId = item.holdId as string | undefined;
      const packageId = item.packageId as string | undefined;
      const date = item.date as string | undefined;
      const people = Number(item.people ?? 0);
      const holdStatus = String(item.holdStatus ?? 'active');
      const selectedSeatLabels = Array.isArray(item.selectedSeats) ? item.selectedSeats.map((s: any) => String(s)) : [];
      const itemSeatLayoutId = item.seatLayoutId ? String(item.seatLayoutId).trim() : '';

      if (holdId && packageId && date && people > 0 && holdStatus === 'active') {
        const holdRef = doc(db, 'reservationHolds', holdId);
        const holdSnap = await tx.get(holdRef);
        
        let lockSnap = null;
        if (date !== 'sin-fecha') {
          const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
          lockSnap = await tx.get(lockRef);
        }

        let seatResSnap = null;
        let templateSnap = null;
        if (selectedSeatLabels.length > 0) {
          const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
          seatResSnap = await tx.get(seatResRef);
          if (seatResSnap.exists()) {
            const seatResData: any = seatResSnap.data();
            const seatLayoutId = itemSeatLayoutId || String(seatResData?.seatLayoutId ?? '');
            if (seatLayoutId) {
              templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
            }
          }
        }

        // --- INICIO DE ESCRITURAS ---
        if (holdSnap.exists()) {
          tx.update(holdRef, { status: 'released', releasedAt: now, updatedAt: now });
        }

        if (date !== 'sin-fecha' && lockSnap?.exists()) {
          const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
          const heldPeople = Number((lockSnap.data() as any)?.heldPeople ?? 0);
          tx.update(lockRef, { heldPeople: Math.max(0, heldPeople - people), updatedAt: now });
        }

        if (selectedSeatLabels.length > 0 && seatResSnap?.exists() && templateSnap?.exists()) {
          const seatResRef = doc(db, 'seatReservations', getSeatDepartureId(packageId, date));
          const seatResData: any = seatResSnap.data();
          const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
          const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
          const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };
          for (const seatId of seatIds) {
            const current = seatsMap[seatId];
            if (!current) continue;
            if (String(current.status ?? '') !== 'held' && String(current.status ?? '') !== 'reserved') continue;
            if (String(current.holdId ?? '') !== holdId) continue;
            seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, expiresAt: null, blockedBy: null, updatedAt: now };
          }
          tx.set(seatResRef, { seats: seatsMap, updatedAt: now }, { merge: true });
        }
      }

      tx.update(cartRef, { updatedAt: now });
      tx.delete(itemRef);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar el item.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await updateDoc(cartRef, { updatedAt: now }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const cartId = request.cookies.get(CART_COOKIE_NAME)?.value || null;
  if (!cartId) {
    return NextResponse.json({ error: 'Carrito no encontrado.' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null);
  const parsedNew = updateItemSchema.safeParse(payload);
  const parsedLegacy = updateSeatsSchema.safeParse(payload);
  if (!parsedNew.success && !parsedLegacy.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsedNew.success ? parsedLegacy.error : parsedNew.error }, { status: 400 });
  }

  const now = Timestamp.now();
  let itemId: string;
  if (parsedNew.success) {
    itemId = parsedNew.data.itemId;
  } else if (parsedLegacy.success) {
    itemId = parsedLegacy.data.itemId;
  } else {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const nextSeatLabelsFromPayload = parsedNew.success && Array.isArray(parsedNew.data.selectedSeats)
    ? Array.from(new Set(parsedNew.data.selectedSeats.map((s) => String(s).trim()).filter(Boolean)))
    : parsedLegacy.success
      ? Array.from(new Set(parsedLegacy.data.selectedSeats.map((s) => String(s).trim()).filter(Boolean)))
      : null;
  const pickupPointFromPayload =
    parsedNew.success && typeof parsedNew.data.pickupPoint === 'string'
      ? String(parsedNew.data.pickupPoint).trim()
      : null;
  const pickupPointTimeFromPayload =
    parsedNew.success && typeof parsedNew.data.pickupPointTime === 'string'
      ? String(parsedNew.data.pickupPointTime).trim()
      : null;
  const roomTypeFromPayload: string | null | undefined =
    parsedNew.success && 'roomType' in parsedNew.data
      ? parsedNew.data.roomType === null
        ? null
        : typeof parsedNew.data.roomType === 'string'
          ? String(parsedNew.data.roomType).trim()
          : undefined
      : undefined;
  const roomSelectionFromPayload =
    parsedNew.success && 'roomSelection' in parsedNew.data
      ? parsedNew.data.roomSelection === null
        ? null
        : normalizeRoomSelection(parsedNew.data.roomSelection as any)
      : undefined;
  const adultsFromPayload = parsedNew.success && typeof parsedNew.data.peopleAdults === 'number' ? parsedNew.data.peopleAdults : null;
  const minorsFromPayload = parsedNew.success && typeof parsedNew.data.peopleMinors === 'number' ? parsedNew.data.peopleMinors : null;
  const peopleFromPayload = parsedNew.success && typeof parsedNew.data.people === 'number' ? parsedNew.data.people : null;
  const depositPercentAdultsFromPayload: number | null | undefined =
    parsedNew.success && 'depositPercentAdults' in parsedNew.data
      ? (parsedNew.data as any).depositPercentAdults
      : undefined;
  const depositPercentMinorsFromPayload: number | null | undefined =
    parsedNew.success && 'depositPercentMinors' in parsedNew.data
      ? (parsedNew.data as any).depositPercentMinors
      : undefined;

  const cartRef = doc(db, 'carts', cartId);
  const itemRef = doc(db, 'carts', cartId, 'items', itemId);

  try {
    await runTransaction(db, async (tx) => {
      const cartSnap = await tx.get(cartRef);
      if (!cartSnap.exists()) throw new Error('Carrito no encontrado.');
      const cartData: any = cartSnap.data();
      if (cartData.status !== 'active') throw new Error('El carrito no está activo.');
      if (isExpired(cartData.expiresAt)) {
        tx.update(cartRef, { status: 'expired', updatedAt: now });
        throw new Error('El carrito venció. Volvé a intentar.');
      }

      const itemSnap = await tx.get(itemRef);
      if (!itemSnap.exists()) throw new Error('Item no encontrado.');
      const item: any = itemSnap.data();
      if (String(item.holdStatus ?? 'active') !== 'active') throw new Error('El item no tiene un hold activo.');
      if (isExpired(item.expiresAt)) throw new Error('El item venció. Volvé a intentar.');

      const holdId = item.holdId ? String(item.holdId) : '';
      const packageId = item.packageId ? String(item.packageId) : '';
      const date = item.date ? String(item.date) : '';
      const prevPeople = Number(item.people ?? 0);
      if (!holdId || !packageId || !date || !prevPeople) {
        throw new Error('Item inválido.');
      }

      const paquete = await getPaqueteById(packageId);
      if (!paquete) throw new Error('Paquete no encontrado.');
      const bc = (paquete as any).bookingConfig;
      if (bc?.enabled === false) throw new Error('Las reservas no están habilitadas para este paquete.');
      const isNoDate = date === 'sin-fecha';
      const departureConfig = resolveDepartureConfig(paquete, date);
      const baseCapacity = departureConfig.baseCapacity;
      const enforceCapacity = !isNoDate && baseCapacity > 0;
      const seatsEnabled = departureConfig.seatsEnabled;
      const seatLayoutId = departureConfig.seatLayoutId ?? '';

      if (!isNoDate) {
        if (!departureConfig.exists) throw new Error('La salida seleccionada no existe.');
        if (!departureConfig.enabled) throw new Error('La fecha seleccionada no está habilitada.');
      }

      const baseAdults = typeof item.peopleAdults === 'number' ? Math.max(0, Number(item.peopleAdults) || 0) : null;
      const baseMinors = typeof item.peopleMinors === 'number' ? Math.max(0, Number(item.peopleMinors) || 0) : null;

      const wantsPeopleOnlyChange = peopleFromPayload !== null && adultsFromPayload === null && minorsFromPayload === null;
      let nextPeople = wantsPeopleOnlyChange ? Math.max(1, Number(peopleFromPayload) || 1) : prevPeople;
      let nextAdults: number | null = adultsFromPayload !== null ? Math.max(0, Number(adultsFromPayload) || 0) : baseAdults;
      let nextMinors: number | null = minorsFromPayload !== null ? Math.max(0, Number(minorsFromPayload) || 0) : baseMinors;

      if (wantsPeopleOnlyChange && typeof baseAdults === 'number' && typeof baseMinors === 'number') {
        const clampedMinors = Math.max(0, Math.min(nextPeople, baseMinors));
        nextMinors = clampedMinors;
        nextAdults = Math.max(0, nextPeople - clampedMinors);
      }

      const nextDerivedPeople = (typeof nextAdults === 'number' && typeof nextMinors === 'number') ? nextAdults + nextMinors : 0;
      if (!wantsPeopleOnlyChange) {
        nextPeople = nextDerivedPeople > 0 ? nextDerivedPeople : (peopleFromPayload !== null ? Math.max(1, Number(peopleFromPayload) || 1) : prevPeople);
      }
      if (!nextPeople || nextPeople < 1 || nextPeople > 50) throw new Error('Cantidad de personas inválida.');

      const existingSeatLabels = Array.isArray(item.selectedSeats)
        ? item.selectedSeats.map((s: any) => String(s).trim()).filter(Boolean)
        : [];
      const nextSeatLabels = nextSeatLabelsFromPayload !== null ? nextSeatLabelsFromPayload : existingSeatLabels;
      if (seatsEnabled) {
        if (!seatLayoutId) throw new Error('Este paquete requiere butacas, pero no tiene plantilla asignada.');
        if (!nextSeatLabels.length) throw new Error('Debés seleccionar butacas para modificar este item.');
        if (nextSeatLabels.length !== nextPeople) throw new Error('Debés seleccionar una butaca por pasajero.');
      }

      const deltaPeople = nextPeople - prevPeople;
      let pendingLockWrite:
        | {
            ref: ReturnType<typeof doc>;
            mode: 'set' | 'update';
            data: Record<string, any>;
          }
        | null = null;
      if (deltaPeople !== 0 && enforceCapacity) {
        const lockRef = doc(db, 'stockHolds', `${packageId}_${date}`);
        const lockSnap = await tx.get(lockRef);
        const heldPeople = lockSnap.exists() ? Number((lockSnap.data() as any)?.heldPeople ?? 0) : 0;
        if (deltaPeople > 0) {
          const delta = await getStockDelta(packageId, date);
          const availableNow = Math.max(0, baseCapacity + delta - Math.max(0, heldPeople));
          if (deltaPeople > availableNow) throw new Error('No hay cupo suficiente para esa fecha.');
        }
        if (!lockSnap.exists()) {
          pendingLockWrite = {
            ref: lockRef,
            mode: 'set',
            data: { packageId, date, heldPeople: Math.max(0, deltaPeople), updatedAt: now, createdAt: now },
          };
        } else {
          pendingLockWrite = {
            ref: lockRef,
            mode: 'update',
            data: { heldPeople: Math.max(0, heldPeople + deltaPeople), updatedAt: now },
          };
        }
      }

      const holdRef = doc(db, 'reservationHolds', holdId);
      const holdSnap = await tx.get(holdRef);
      if (!holdSnap.exists()) throw new Error('Hold no encontrado.');
      const hold: any = holdSnap.data();
      if (String(hold.status ?? 'active') !== 'active') throw new Error('Hold no activo.');
      const expiresAt = hold.expiresAt;
      const expMs = toMillis(expiresAt);
      if (!(expMs > 0 && expMs > now.toMillis())) throw new Error('Hold vencido.');

      const hasSeatSelectionChanged =
        seatsEnabled &&
        (nextSeatLabels.length !== existingSeatLabels.length ||
          nextSeatLabels.some((seat: string, index: number) => seat !== existingSeatLabels[index]));

      let selectedSeatsToStore: string[] | null = existingSeatLabels.length ? existingSeatLabels : null;
      let seatLayoutTemplateForSelection: SeatLayoutTemplate | null = null;
      let pendingSeatReservationWrite:
        | {
            ref: ReturnType<typeof doc>;
            data: Record<string, any>;
          }
        | null = null;
      if (seatsEnabled && hasSeatSelectionChanged) {
        const templateRef = doc(db, 'seatLayouts', seatLayoutId);
        const templateSnap = await tx.get(templateRef);
        if (!templateSnap.exists()) throw new Error('Plantilla de micro no encontrada.');
        const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
        seatLayoutTemplateForSelection = template;
        const baseSeats = buildBaseSeatReservationSeats(template);
        const seatDepartureId = getSeatDepartureId(packageId, date);
        const seatResRef = doc(db, 'seatReservations', seatDepartureId);
        const seatResSnap = await tx.get(seatResRef);
        if (!seatResSnap.exists()) throw new Error('No se encontró el mapa de butacas.');
        const seatResData: any = seatResSnap.data();
        const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };

        const prevSeatLabels = existingSeatLabels;
        const prevSeatIds = seatIdsFromLabels(template, prevSeatLabels);
        const nextSeatIds = seatIdsFromLabels(template, nextSeatLabels);
        if (nextSeatIds.length !== nextSeatLabels.length) throw new Error('Una o más butacas no existen en la plantilla.');

        for (const seatId of prevSeatIds) {
          const seat = seatsMap[seatId];
          if (!seat) continue;
          const s = String(seat.status ?? '');
          if (s !== 'held' && s !== 'reserved') continue;
          if (String(seat.holdId ?? '') !== holdId) continue;
          seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, orderId: null, reservationId: null, expiresAt: null, blockedBy: null, blockReason: null, updatedAt: now };
        }

        for (const seatId of nextSeatIds) {
          const seat = seatsMap[seatId] ?? baseSeats[seatId];
          if (!seat) throw new Error('Una o más butacas no existen en la salida.');
          const s = String(seat.status ?? 'available');
          if (s === 'available') continue;
          if ((s === 'held' || s === 'reserved') && String(seat.holdId ?? '') === holdId) continue;
          if (s === 'held' || s === 'reserved') {
            const seatExp = toMillis(seat.expiresAt);
            if (seatExp > 0 && seatExp <= now.toMillis()) continue;
          }
          throw new Error('Una o más butacas no están disponibles.');
        }

        for (const seatId of nextSeatIds) {
          seatsMap[seatId] = {
            status: 'held',
            holdId,
            cartId,
            cartItemId: itemId,
            expiresAt,
            blockedBy: null,
            blockReason: null,
            updatedAt: now,
          };
        }

        pendingSeatReservationWrite = {
          ref: seatResRef,
          data: { seats: seatsMap, updatedAt: now },
        };
        selectedSeatsToStore = nextSeatLabels;
      }

      const existingPercentAdults =
        typeof item.depositPercentAdults === 'number' ? Number(item.depositPercentAdults) : null;
      const existingPercentMinors =
        typeof item.depositPercentMinors === 'number' ? Number(item.depositPercentMinors) : null;
      const nextDepositPercentAdults =
        depositPercentAdultsFromPayload === undefined
          ? existingPercentAdults
          : depositPercentAdultsFromPayload === null
            ? null
            : Math.max(0, Math.min(100, Number(depositPercentAdultsFromPayload) || 0));
      const nextDepositPercentMinors =
        depositPercentMinorsFromPayload === undefined
          ? existingPercentMinors
          : depositPercentMinorsFromPayload === null
            ? null
            : Math.max(0, Math.min(100, Number(depositPercentMinorsFromPayload) || 0));

      const nextPickupPoint =
        pickupPointFromPayload !== null ? (pickupPointFromPayload || '') : String(item.pickupPoint ?? '');
      const nextRoomSelection =
        roomSelectionFromPayload === undefined
          ? normalizeRoomSelection(item.roomSelection as any)
          : roomSelectionFromPayload;
      const nextRoomType =
        roomTypeFromPayload === undefined
          ? nextRoomSelection && nextRoomSelection.length > 0
            ? deriveLegacyRoomTypeFromSelection(nextRoomSelection)
            : (String(item.roomType ?? '').trim() || null)
          : (roomTypeFromPayload || null);
      if (!isPackageRoomTypeAvailable(paquete, nextRoomType as any)) {
        throw new Error('El tipo de habitación no está disponible para este paquete.');
      }
      const resolvedPickupPointTime =
        nextPickupPoint.trim().length > 0
          ? resolvePickupPointTime(
              paquete,
              nextPickupPoint.trim(),
              pickupPointTimeFromPayload !== null ? pickupPointTimeFromPayload : String(item.pickupPointTime ?? '')
            )
          : null;
      let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
      const nextSelectedSeatsForPricing =
        selectedSeatsToStore && selectedSeatsToStore.length ? selectedSeatsToStore : null;
      if (seatLayoutId && nextSelectedSeatsForPricing && nextSelectedSeatsForPricing.length > 0) {
        if (seatLayoutTemplateForSelection) {
          seatLayoutTemplateForExtras = seatLayoutTemplateForSelection;
        } else {
          const templateRef = doc(db, 'seatLayouts', seatLayoutId);
          const templateSnap = await tx.get(templateRef);
          if (!templateSnap.exists()) throw new Error('Plantilla de micro no encontrada.');
          seatLayoutTemplateForExtras = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
        }
      }
      const selectedExtras = resolveReservationExtraSelections({
        paquete,
        pickupPoint: nextPickupPoint.trim().length > 0 ? nextPickupPoint.trim() : null,
        selectedSeats: nextSelectedSeatsForPricing,
        seatLayoutTemplate: seatLayoutTemplateForExtras,
      });
      const pricing = computeReservationPricing(paquete, date, {
        people: nextPeople,
        peopleAdults: nextDerivedPeople > 0 ? nextAdults : null,
        peopleMinors: nextDerivedPeople > 0 ? nextMinors : null,
        depositPercentAdults: nextDepositPercentAdults,
        depositPercentMinors: nextDepositPercentMinors,
        roomType: nextRoomType,
        selectedExtras,
      });
      const pricedSelectedExtras = withSinglePassengerSurcharge({
        selectedExtras,
        baseSubtotalAmount: pricing.baseSubtotalAmount,
        people: nextPeople,
      });
      const unitAmount = pricing.unitAmount;
      const currency = pricing.currency;
      if (!currency) throw new Error('Moneda no soportada para este paquete.');
      if (pricing.pricingMode === 'percent' && pricing.baseUnitAmount < 1) {
        throw new Error('No se puede calcular porcentaje porque falta precio base del paquete/salida.');
      }
      if (unitAmount < 1) throw new Error('Precio de reserva no configurado para este paquete.');

      if (pendingLockWrite) {
        if (pendingLockWrite.mode === 'set') {
          tx.set(pendingLockWrite.ref, pendingLockWrite.data);
        } else {
          tx.update(pendingLockWrite.ref, pendingLockWrite.data);
        }
      }
      if (pendingSeatReservationWrite) {
        tx.set(pendingSeatReservationWrite.ref, pendingSeatReservationWrite.data, { merge: true });
      }

      tx.update(itemRef, {
        people: nextPeople,
        peopleAdults: nextDerivedPeople > 0 ? (adultsFromPayload !== null ? nextAdults : item.peopleAdults ?? nextAdults) : null,
        peopleMinors: nextDerivedPeople > 0 ? (minorsFromPayload !== null ? nextMinors : item.peopleMinors ?? nextMinors) : null,
        pickupPoint: nextPickupPoint.trim().length > 0 ? nextPickupPoint.trim() : null,
        pickupPointTime: resolvedPickupPointTime,
        roomType: nextRoomType,
        roomSelection: nextRoomSelection && nextRoomSelection.length ? nextRoomSelection : null,
        selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
        unitAmount,
        pricingMode: pricing.pricingMode,
        pricingBaseUnitAmount: pricing.baseUnitAmount,
        unitAmountAdults: pricing.unitAmountAdults,
        unitAmountMinors: pricing.unitAmountMinors,
        depositPercentAdults: pricing.depositPercentAdults,
        depositPercentMinors: pricing.depositPercentMinors,
        baseSubtotalAmount: pricing.baseSubtotalAmount,
        extrasTotalAmount: pricing.extrasTotalAmount,
        subtotalAmount: pricing.subtotalAmount,
        currency,
        seatLayoutId: seatsEnabled ? seatLayoutId : null,
        selectedSeats: selectedSeatsToStore && selectedSeatsToStore.length ? selectedSeatsToStore : null,
        updatedAt: now,
      });
      tx.update(holdRef, {
        people: nextPeople,
        peopleAdults: nextDerivedPeople > 0 ? (adultsFromPayload !== null ? nextAdults : hold.peopleAdults ?? nextAdults) : null,
        peopleMinors: nextDerivedPeople > 0 ? (minorsFromPayload !== null ? nextMinors : hold.peopleMinors ?? nextMinors) : null,
        pickupPoint: nextPickupPoint.trim().length > 0 ? nextPickupPoint.trim() : null,
        pickupPointTime: resolvedPickupPointTime,
        roomType: nextRoomType,
        roomSelection: nextRoomSelection && nextRoomSelection.length ? nextRoomSelection : null,
        selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
        pricingMode: pricing.pricingMode,
        pricingBaseUnitAmount: pricing.baseUnitAmount,
        unitAmountAdults: pricing.unitAmountAdults,
        unitAmountMinors: pricing.unitAmountMinors,
        depositPercentAdults: pricing.depositPercentAdults,
        depositPercentMinors: pricing.depositPercentMinors,
        baseSubtotalAmount: pricing.baseSubtotalAmount,
        extrasTotalAmount: pricing.extrasTotalAmount,
        seatLayoutId: seatsEnabled ? seatLayoutId : null,
        selectedSeats: selectedSeatsToStore && selectedSeatsToStore.length ? selectedSeatsToStore : null,
        updatedAt: now,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudieron actualizar las butacas.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

