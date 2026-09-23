import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReservationSearchIndex,
  buildReservationsCsv,
  normalizeReservationExportFilters,
  summarizeReservationPayments,
} from '../lib/admin/reservations-export';

test('normaliza filtros de exportación desde query params', () => {
  const params = new URLSearchParams({
    packageId: 'pkg-1',
    date: '2026-07-22',
    statuses: 'reserved,completed,completed',
    paymentMethod: 'admin',
    searchTerm: '  BENJAMIN  ',
    createdFrom: '2026-07-01',
    createdTo: '2026-07-31',
  });

  const filters = normalizeReservationExportFilters(params);

  assert.equal(filters.packageId, 'pkg-1');
  assert.equal(filters.date, '2026-07-22');
  assert.deepEqual(filters.statuses, ['reserved', 'completed']);
  assert.equal(filters.paymentMethod, 'admin');
  assert.equal(filters.searchTerm, 'benjamin');
  assert.equal(filters.createdFrom, '2026-07-01');
  assert.equal(filters.createdTo, '2026-07-31');
});

test('resume pagos, extras y reintegros sin desalinear el saldo', () => {
  const summary = summarizeReservationPayments(100000, [
    { amount: 25000, movementType: 'payment' },
    { amount: 10000, movementType: 'extra' },
    { amount: 5000, movementType: 'discount' },
    { amount: 3000, movementType: 'refund' },
  ]);

  assert.deepEqual(summary, {
    baseTotal: 100000,
    totalAdjustments: 5000,
    billedTotal: 105000,
    totalPaid: 22000,
    balance: 83000,
  });
});

test('arma un índice de búsqueda compatible con reserva, código, cliente y butacas', () => {
  const searchIndex = buildReservationSearchIndex({
    id: 'res-1',
    reservationCode: '000321',
    customerName: 'Ana Gómez',
    customerEmail: 'ana@example.com',
    experienceTitle: 'Cataratas',
    packageTitle: 'Cataratas VIP',
    mercadoPagoPaymentId: 'mp-123',
    referredBy: { vendorName: 'Benjamin Garcia' } as any,
    selectedSeats: ['12', '14'],
  } as any);

  assert.match(searchIndex, /000321/);
  assert.match(searchIndex, /ana@example.com/);
  assert.match(searchIndex, /benjamin garcia/);
  assert.match(searchIndex, /12 14/);
});

test('genera CSV con BOM y encabezados estables', () => {
  const csv = buildReservationsCsv([
    {
      numeroReserva: '000321',
      nombre: 'Ana',
      apellido: 'Gómez',
      dni: '12345678',
      fechaNacimiento: '1990-05-15',
      telefono: '1111-2222',
      habitacion: 'Doble',
      tipoButaca: 'Cama',
      ascenso: 'Terminal de Retiro · 07:30',
      comentarios: 'Ventanilla preferida',
      reservationId: 'res-1',
      reservationCode: '000321',
      packageTitle: 'Cataratas VIP',
      customerName: 'Ana Gómez',
      customerEmail: 'ana@example.com',
      customerPhone: '1111-2222',
      checkIn: '2026-07-22',
      checkOut: '2026-07-25',
      packageBaseAmount: '249990.00',
      currency: 'ARS',
      peopleTotal: 2,
      adults: 2,
      minors: 0,
      babies: 0,
      seatsCount: 2,
      seats: '12 | 14',
      seatType: 'Cama',
      status: 'completed',
      amountPaid: '249990.00',
      pendingDebt: '0.00',
      createdAt: '2026-07-18 18:10:00',
    },
  ]);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Número reserva"/);
  assert.match(csv, /"nombre"/);
  assert.match(csv, /"habitacion"/);
  assert.match(csv, /"tipo de butaca"/);
  assert.match(csv, /"Codigo Reserva"/);
  assert.match(csv, /"Cataratas VIP"/);
  assert.match(csv, /"249990\.00"/);
});
