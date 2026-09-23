import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCommission } from '../lib/referrals';
import { getReservationOfficialBaseAmount } from '../lib/reservas/pricing';
import {
  computeReservationPricing,
  getSinglePassengerSurchargeSummary,
  resolveReservationExtraSelections,
} from '../lib/packages/resolve-departure';
import {
  getPackageRoomTypes,
  isPackageRoomTypeAvailable,
} from '../lib/reservas/room-types';

test('usa los tipos de habitación configurados sin evaluar la cantidad de pasajeros', () => {
  const paquete = { roomTypes: ['simple', 'quadruple-twin'] } as any;
  assert.deepEqual(getPackageRoomTypes(paquete), ['simple', 'quadruple-twin']);
  assert.equal(isPackageRoomTypeAvailable(paquete, 'simple'), true);
  assert.equal(isPackageRoomTypeAvailable(paquete, 'twin'), false);
});

test('considera sin alojamiento los paquetes sin configuración de habitaciones', () => {
  assert.deepEqual(getPackageRoomTypes({} as any), []);
});

test('permite paquetes configurados sin alojamiento', () => {
  assert.deepEqual(getPackageRoomTypes({ roomTypes: [] } as any), []);
  assert.equal(isPackageRoomTypeAvailable({ roomTypes: [] } as any, null), true);
});

test('aplica categorias automáticas por butaca y separa base/extras', () => {
  const paquete = {
    id: 'pkg-1',
    slug: 'paquete-demo',
    titulo: 'Paquete Demo',
    precio: 1000,
    moneda: 'ARS',
    bookingConfig: {
      enabled: true,
      currency: 'ars',
    },
  } as any;

  const seatLayoutTemplate = {
    seats: [
      { seatId: 'seat-1', label: 'A1', category: 'cocheCama' },
      { seatId: 'seat-2', label: 'A2', category: 'panoramicos' },
    ],
    categoryPricing: {
      cocheCama: { amount: 200 },
      panoramicos: { amount: 50 },
      cafeteras: { amount: 0 },
    },
  } as any;

  const selectedExtras = resolveReservationExtraSelections({
    paquete,
    selectedSeats: ['A1 (Fila 1, Col 1)', 'seat-2'],
    seatLayoutTemplate,
  });

  assert.equal(selectedExtras.length, 2);
  assert.deepEqual(
    selectedExtras.map((extra) => ({ code: extra.code, quantity: extra.quantity ?? 0 })),
    [
      { code: 'cocheCama', quantity: 1 },
      { code: 'panoramicos', quantity: 1 },
    ]
  );

  const pricing = computeReservationPricing(paquete, 'sin-fecha', {
    people: 2,
    selectedExtras,
  });

  assert.equal(pricing.baseSubtotalAmount, 200000);
  assert.equal(pricing.extrasTotalAmount, 25000);
  assert.equal(pricing.subtotalAmount, 225000);
});

test('calcula comision porcentual solo sobre el precio base original', () => {
  const vendor = {
    id: 'vendor-1',
    name: 'Vendor Demo',
    defaultCommission: {
      type: 'percent',
      value: 10,
      currency: 'ars',
    },
  } as any;

  const commission = computeCommission({
    amountTotal: 225000,
    commissionBaseAmount: 200000,
    extrasExcludedAmount: 25000,
    people: 2,
    vendor,
  });

  assert.equal(commission.commissionAmount, 20000);
});

test('prioriza el precio oficial del paquete sobre la seña para la base de comisión', () => {
  const commissionBaseAmount = getReservationOfficialBaseAmount({
    pricingBaseUnitAmount: 24999000,
    people: 1,
    baseSubtotalAmount: 7499700,
    amountTotal: 9499700,
    extrasTotalAmount: 2000000,
  });

  assert.equal(commissionBaseAmount, 24999000);
});

test('no reduce el precio oficial cuando el paquete tiene configuracion legacy por porcentaje', () => {
  const paquete = {
    id: 'pkg-legacy',
    slug: 'paquete-legacy',
    titulo: 'Paquete Legacy',
    precio: 249990,
    moneda: 'ARS',
    bookingConfig: {
      enabled: true,
      currency: 'ars',
    },
    reservationPricing: {
      mode: 'percent',
      single: { adultPercent: 30, minorPercent: 30 },
      group: { adultPercent: 30, minorPercent: 30 },
      allowCustomPercent: true,
    },
  } as any;

  const pricing = computeReservationPricing(paquete, 'sin-fecha', {
    people: 1,
    depositPercentAdults: 30,
    depositPercentMinors: 30,
  });

  assert.equal(pricing.baseUnitAmount, 24999000);
  assert.equal(pricing.unitAmountAdults, 24999000);
  assert.equal(pricing.baseSubtotalAmount, 24999000);
  assert.equal(pricing.subtotalAmount, 24999000);
});

test('calcula gastos administrativos por persona cuando el paquete lo define', () => {
  const paquete = {
    id: 'pkg-admin-fee',
    slug: 'paquete-admin-fee',
    titulo: 'Paquete con fee',
    precio: 1000,
    gastosAdministrativos: 250,
    moneda: 'ARS',
    bookingConfig: {
      enabled: true,
      currency: 'ars',
    },
  } as any;

  const selectedExtras = resolveReservationExtraSelections({ paquete });
  const administrativeFee = selectedExtras.find((extra) => extra.code === 'administrativeFee');
  assert.ok(administrativeFee);
  assert.equal(administrativeFee?.amount, 25000);
  assert.equal(administrativeFee?.scope, 'per_person');

  const pricing = computeReservationPricing(paquete, 'sin-fecha', {
    people: 3,
    selectedExtras,
  });

  assert.equal(pricing.baseSubtotalAmount, 300000);
  assert.equal(pricing.extrasTotalAmount, 75000);
  assert.equal(pricing.subtotalAmount, 375000);
});

test('aplica recargo del 50% para reservas de un solo pasajero', () => {
  const paquete = {
    id: 'pkg-single-surcharge',
    slug: 'paquete-single-surcharge',
    titulo: 'Paquete individual',
    precio: 1000,
    moneda: 'ARS',
    bookingConfig: {
      enabled: true,
      currency: 'ars',
    },
  } as any;

  const pricing = computeReservationPricing(paquete, 'sin-fecha', {
    people: 1,
    selectedExtras: [],
  });

  assert.equal(pricing.baseSubtotalAmount, 100000);
  assert.equal(pricing.extrasTotalAmount, 50000);
  assert.equal(pricing.subtotalAmount, 150000);

  const surchargeSummary = getSinglePassengerSurchargeSummary({
    people: 1,
    baseSubtotalAmount: pricing.baseSubtotalAmount,
  });

  assert.equal(surchargeSummary.applies, true);
  assert.equal(surchargeSummary.amount, 50000);
  assert.equal(surchargeSummary.title, 'Recargo tarifa individual');
});

test('no aplica recargo de pasajero individual en reservas con multiples pasajeros', () => {
  const paquete = {
    id: 'pkg-multi',
    slug: 'paquete-multi',
    titulo: 'Paquete grupal',
    precio: 1000,
    moneda: 'ARS',
    bookingConfig: {
      enabled: true,
      currency: 'ars',
    },
  } as any;

  const pricing = computeReservationPricing(paquete, 'sin-fecha', {
    people: 2,
    selectedExtras: [],
  });

  assert.equal(pricing.baseSubtotalAmount, 200000);
  assert.equal(pricing.extrasTotalAmount, 0);
  assert.equal(pricing.subtotalAmount, 200000);

  const surchargeSummary = getSinglePassengerSurchargeSummary({
    people: 2,
    baseSubtotalAmount: pricing.baseSubtotalAmount,
  });

  assert.equal(surchargeSummary.applies, false);
  assert.equal(surchargeSummary.amount, 0);
});

