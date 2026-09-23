import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { collection, doc, getDoc, getDocs, limit, query, runTransaction, Timestamp, updateDoc, where } from 'firebase/firestore';
import { getPaqueteById } from '@/lib/paquetes';
import { createReserva, getReservaById, updateReservaStatus } from '@/lib/reservas';
import { getReservationOfficialBaseAmount } from '@/lib/reservas/pricing';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { getVendorById } from '@/lib/vendors';
import { getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import type { SeatLayoutTemplate, SeatStatus } from '@/types';
import {
  computeReservationPricing,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
  withSinglePassengerSurcharge,
} from '@/lib/packages/resolve-departure';
import { requireVendorToken, vendorHasPackageAccess } from '@/lib/vendorAuth';
import {
  deriveLegacyRoomTypeFromSelection,
  isPackageRoomTypeAvailable,
  normalizeRoomSelection,
} from '@/lib/reservas/room-types';

export const runtime = 'nodejs';
const roomTypeSchema = z.string().trim().min(1).max(120);

const reservationStatusEnum = z.enum(['pending', 'reserved', 'completed', 'cancelled']);

const travelerSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  age: z.number().int().min(0).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(40),
  document: z.string().min(3).max(40),
  country: z.string().min(2).max(80),
  travelerType: z.enum(['adult', 'minor']).nullable().optional(),
});

const bodySchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1),
  customerEmail: z.string().trim().email().or(z.literal('')),
  customerName: z.string().min(2).optional(),
  customerFirstName: z.string().min(2),
  customerLastName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerComments: z.string().max(500).optional(),
  passengerDetails: z.array(travelerSchema).max(49).optional(),
  roomType: roomTypeSchema.optional(),
  roomSelection: z.array(z.object({
    roomType: roomTypeSchema,
    quantity: z.number().int().min(1).max(50),
  })).max(20).optional(),
  pickupPoint: z.string().max(120).optional(),
  pickupPointTime: z.string().max(20).nullable().optional(),
  status: reservationStatusEnum.optional(),
}).superRefine((data, ctx) => {
  const additionalTravelers = Math.max(0, data.people - 1);
  const passengerCount = Array.isArray(data.passengerDetails) ? data.passengerDetails.length : 0;
  if (passengerCount !== additionalTravelers) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['passengerDetails'],
      message: 'La cantidad de pasajeros no coincide con la reserva.',
    });
  }
});

const vendorUpdateSchema = z.object({
  reservationId: z.string().min(1),
  status: z.literal('cancelled'),
  note: z.string().max(500).optional(),
});

function resolvePickupPointTime(paquete: any, pickupPoint: string, rawTime?: string | null): string | null {
  const incoming = String(rawTime ?? '').trim();
  if (incoming) return incoming;
  const config = Array.isArray(paquete?.pickupPointsConfig) ? paquete.pickupPointsConfig : [];
  const found = config.find((item: any) => String(item?.label ?? '').trim() === pickupPoint);
  const time = found ? String(found?.time ?? '').trim() : '';
  return time || null;
}

function getErrorMessage(error: unknown, fallback = 'Error desconocido'): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'reservas'), where('referredBy.vendorId', '==', vendor.id))
    );
    const reservations = snap.docs
      .map((item) => ({ id: item.id, ...(item.data() as any) }))
      .sort((a, b) => {
        const aMs =
          typeof a.createdAt?.toMillis === 'function'
            ? a.createdAt.toMillis()
            : typeof a.createdAt?.seconds === 'number'
              ? a.createdAt.seconds * 1000
              : 0;
        const bMs =
          typeof b.createdAt?.toMillis === 'function'
            ? b.createdAt.toMillis()
            : typeof b.createdAt?.seconds === 'number'
              ? b.createdAt.seconds * 1000
              : 0;
        return bMs - aMs;
      });
    return NextResponse.json({ reservations });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudieron cargar las reservas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.errors
            .map((item) => {
              const path = Array.isArray(item.path) && item.path.length > 0 ? `${item.path.join('.')}: ` : '';
              return `${path}${item.message}`;
            })
            .join(', '),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const paquete = await getPaqueteById(payload.packageId);
  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

    const vendorFull = await getVendorById(vendor.id).catch(() => null);
  if (!vendorFull || !vendorFull.active) {
    return NextResponse.json({ error: 'Vendedor no habilitado' }, { status: 403 });
  }
    if (!vendorHasPackageAccess(vendorFull, payload.packageId)) {
      return NextResponse.json({ error: 'No tenés permiso para este paquete.' }, { status: 403 });
    }

  try {
    const packageSlug = paquete.slug ?? paquete.id;
    const bc = paquete.bookingConfig;
    const departureConfig = resolveDepartureConfig(paquete, payload.date);
    const maxPeople = departureConfig.maxPeople;
    if (payload.people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (payload.date !== 'sin-fecha') {
      if (!departureConfig.exists || !departureConfig.enabled) {
        return NextResponse.json(
          { error: 'La fecha seleccionada no está habilitada para este paquete.' },
          { status: 400 }
        );
      }
    }

    const pickupPoint = typeof payload.pickupPoint === 'string' ? payload.pickupPoint.trim() : '';
    const pickupPointTime = pickupPoint
      ? resolvePickupPointTime(paquete, pickupPoint, payload.pickupPointTime ?? null)
      : null;
    const roomSelection = normalizeRoomSelection(payload.roomSelection as any);
    const roomType = roomSelection.length
      ? deriveLegacyRoomTypeFromSelection(roomSelection)
      : payload.roomType ?? null;
    const roomSelectionMetrics = roomSelection.length
      ? {
          selectionKey: roomSelection.map((item) => `${item.roomType}:${item.quantity}`).join('|'),
          totalRooms: roomSelection.reduce((sum, item) => sum + item.quantity, 0),
          totalCapacity: payload.people,
          people: payload.people,
          generatedAt: new Date(),
        }
      : null;
    if (!isPackageRoomTypeAvailable(paquete, roomType ?? null)) {
      return NextResponse.json(
        { error: 'La habitación seleccionada no está disponible para este paquete.' },
        { status: 400 }
      );
    }
    const selectedExtras = resolveReservationExtraSelections({
      paquete,
      pickupPoint: pickupPoint || null,
    });
    const repriced = computeReservationPricing(paquete, payload.date, {
      people: payload.people,
      roomType,
      selectedExtras,
    });
    const pricedSelectedExtras = withSinglePassengerSurcharge({
      selectedExtras,
      baseSubtotalAmount: repriced.baseSubtotalAmount,
      people: payload.people,
    });
    const currency = (repriced.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const unitAmount = repriced.unitAmount;
    if (!Number.isFinite(unitAmount) || unitAmount < 1 || repriced.subtotalAmount < 1) {
      return NextResponse.json(
        { error: 'Esta experiencia no tiene configurado un valor de reserva válido.' },
        { status: 400 }
      );
    }
    const amountTotal = repriced.subtotalAmount;

    const baseCapacity = payload.date !== 'sin-fecha' ? departureConfig.baseCapacity : 0;
    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(paquete.id, payload.date, baseCapacity);
      if (payload.people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    const commissionOverride =
      paquete.bookingConfig?.referralCommission
        ? {
            type: paquete.bookingConfig.referralCommission.type,
            value: paquete.bookingConfig.referralCommission.value,
            currency: paquete.bookingConfig.referralCommission.currency,
          }
        : undefined;
    const comm = computeCommission({
      amountTotal,
      commissionBaseAmount: getReservationOfficialBaseAmount({
        pricingBaseUnitAmount: repriced.baseUnitAmount,
        people: payload.people,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        amountTotal,
        extrasTotalAmount: repriced.extrasTotalAmount,
      }),
      extrasExcludedAmount: repriced.extrasTotalAmount,
      people: payload.people,
      vendor: vendorFull,
      commissionOverride,
    });
    const payoutStatus = nextPayoutStatusForReservationStatus(payload.status ?? 'reserved');
    const referredBy = {
      vendorId: vendorFull.id,
      vendorName: vendorFull.name,
      channel: 'manual' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      commissionBaseAmount: getReservationOfficialBaseAmount({
        pricingBaseUnitAmount: repriced.baseUnitAmount,
        people: payload.people,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        amountTotal,
        extrasTotalAmount: repriced.extrasTotalAmount,
      }),
      extrasExcludedAmount: repriced.extrasTotalAmount,
      payoutStatus,
    };

    const fullName = payload.customerName || `${payload.customerFirstName} ${payload.customerLastName}`.trim();
    const reservaId = await createReserva({
      packageId: paquete.id,
      packageSlug: packageSlug,
      packageTitle: paquete.titulo,
      // Legacy compatibility
      experienceId: paquete.id,
      experienceSlug: packageSlug,
      experienceTitle: paquete.titulo,
      date: payload.date,
      people: payload.people,
      pricingMode: repriced.pricingMode,
      pricingBaseUnitAmount: repriced.baseUnitAmount,
      unitAmountAdults: repriced.unitAmountAdults,
      unitAmountMinors: repriced.unitAmountMinors,
      depositPercentAdults: repriced.depositPercentAdults,
      depositPercentMinors: repriced.depositPercentMinors,
      baseSubtotalAmount: repriced.baseSubtotalAmount,
      extrasTotalAmount: repriced.extrasTotalAmount,
      amountTotal,
      currency,
      paymentMethod: 'admin',
      customerEmail: payload.customerEmail.trim(),
      customerName: fullName,
      customerFirstName: payload.customerFirstName,
      customerLastName: payload.customerLastName,
      customerPhone: payload.customerPhone ?? undefined,
      customerCountry: payload.customerCountry ?? undefined,
      customerDocument: payload.customerDocument ?? undefined,
      customerComments: payload.customerComments ?? undefined,
      createdByAdmin: false,
      createdByRole: 'vendor',
      createdByVendorId: vendorFull.id,
      createdByVendorName: vendorFull.name,
      historyNote: 'Reserva creada por vendedor',
      status: payload.status ?? 'reserved',
      pricingSnapshot: buildReservationPricingSnapshot({
        unitAmount: amountTotal > 0 && payload.people > 0 ? Math.round(amountTotal / payload.people) : unitAmount,
        people: payload.people,
        amountTotal,
        baseSubtotalAmount: repriced.baseSubtotalAmount,
        extrasTotalAmount: repriced.extrasTotalAmount,
        currency,
        paymentMethod: 'admin',
      }),
      capacitySnapshot: {
        date: payload.date,
        baseCapacity,
        maxPeoplePerBooking: maxPeople,
        hasSpecificDates: Boolean(bc?.hasSpecificDates),
        enabled: departureConfig.enabled,
      },
      experienceSnapshot: {
        id: paquete.id,
        slug: packageSlug,
        title: paquete.titulo,
      },
      pickupPoint: pickupPoint || null,
      pickupPointTime,
      roomType,
      roomSelection: roomSelection.length ? roomSelection : null,
      roomSelectionMetrics,
      selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
      customerBirthDate: payload.customerBirthDate,
      passengerDetails: payload.passengerDetails ?? [],
      referredBy,
    });

    if (payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      await registrarMovimientoStock({
        packageId: paquete.id,
        date: payload.date,
        type: 'reserva',
        quantity: -payload.people,
        author: vendorFull.email ?? vendorFull.name ?? 'vendor',
        referenceId: reservaId,
        note: 'Reserva manual creada por vendedor',
        baseCapacityAtThatTime: baseCapacity,
        amountTotal,
        currency,
      });
    }

    return NextResponse.json({ id: reservaId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'No se pudo guardar la reserva';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let vendor;
  try {
    vendor = await requireVendorToken(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Autenticación inválida';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let payload: z.infer<typeof vendorUpdateSchema>;
  try {
    payload = vendorUpdateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const reservation = await getReservaById(payload.reservationId);
  if (!reservation) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  if (String(reservation.referredBy?.vendorId ?? '') !== vendor.id) {
    return NextResponse.json({ error: 'No tenés permiso para modificar esta reserva.' }, { status: 403 });
  }

  if (reservation.status === 'cancelled') {
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  if (reservation.status === 'completed') {
    return NextResponse.json(
      { error: 'Las reservas completadas deben gestionarse desde administración.' },
      { status: 400 }
    );
  }

  if (reservation.paymentMethod !== 'admin') {
    return NextResponse.json(
      { error: 'Solo podés cancelar reservas manuales creadas desde el panel vendedor.' },
      { status: 400 }
    );
  }

  try {
    const packageId = String(reservation.packageId ?? reservation.experienceId);
    const paquete = await getPaqueteById(packageId);
    const departureConfig =
      paquete && reservation.date !== 'sin-fecha'
        ? resolveDepartureConfig(paquete, reservation.date)
        : null;
    const baseCapacity = departureConfig?.baseCapacity ?? 0;
    const hasSeats = Array.isArray(reservation.selectedSeats) && reservation.selectedSeats.length > 0;
    const seatLayoutId = String((reservation as any).seatLayoutId ?? '').trim();
    const shouldTouchSeats = hasSeats && seatLayoutId && reservation.date && reservation.date !== 'sin-fecha';

    if (shouldTouchSeats) {
      const seatsEnabled = Boolean(departureConfig?.seatsEnabled);
      if (seatsEnabled) {
        const selectedSeatLabels = reservation.selectedSeats?.map((seat) => String(seat)) ?? [];
        const seatDepartureId = getSeatDepartureId(packageId, reservation.date);
        const seatResRef = doc(db, 'seatReservations', seatDepartureId);
        const templateRef = doc(db, 'seatLayouts', seatLayoutId);

        try {
          await runTransaction(db, async (tx) => {
            const templateSnap = await tx.get(templateRef);
            if (!templateSnap.exists()) throw new Error('Plantilla de micro no encontrada.');
            const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
            const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
            if (seatIds.length !== selectedSeatLabels.length) {
              throw new Error('Una o más butacas no existen en la plantilla.');
            }

            const seatResSnap = await tx.get(seatResRef);
            if (!seatResSnap.exists()) throw new Error('No se encontró el mapa de butacas para esta salida.');

            const seatResData: any = seatResSnap.data();
            const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };

            for (const seatId of seatIds) {
              const seat = seatsMap[seatId];
              if (!seat) continue;
              const currentStatus = String(seat.status ?? 'available') as SeatStatus;
              if (currentStatus === 'available' && !seat.reservationId) continue;
              if (String(seat.reservationId ?? '') !== reservation.id) continue;
              seatsMap[seatId] = {
                status: 'available',
                holdId: null,
                cartId: null,
                cartItemId: null,
                orderId: null,
                reservationId: null,
                expiresAt: null,
                blockedBy: null,
                updatedAt: Timestamp.now(),
              };
            }

            tx.set(seatResRef, { seats: seatsMap, updatedAt: Timestamp.now() }, { merge: true });
          });
        } catch (error) {
          return NextResponse.json(
            { error: getErrorMessage(error, 'No se pudo actualizar butacas') },
            { status: 400 }
          );
        }
      }
    }

    if (reservation.date !== 'sin-fecha') {
      await registrarMovimientoStock({
        packageId,
        date: reservation.date,
        type: 'entrada',
        quantity: reservation.people,
        author: vendor.email ?? vendor.name ?? 'vendor',
        referenceId: reservation.id,
        note: payload.note ?? 'Cancelación de reserva desde panel vendedor',
        baseCapacityAtThatTime: baseCapacity,
        amountTotal: reservation.amountTotal ?? 0,
        currency: reservation.currency,
      });
    }

    await updateReservaStatus(payload.reservationId, 'cancelled', {
      actor: 'system',
      note: payload.note ?? `Cancelada desde panel vendedor por ${vendor.email ?? vendor.name ?? vendor.id}`,
    });

    await updateDoc(doc(db, 'reservas', payload.reservationId), {
      'referredBy.payoutStatus': 'cancelled',
      updatedAt: Timestamp.now(),
    }).catch(() => null);

    return NextResponse.json({ ok: true, status: 'cancelled' });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'No se pudo cancelar la reserva') },
      { status: 500 }
    );
  }
}
