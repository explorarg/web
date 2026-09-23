import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSinglePassengerSurchargeAmount,
  getSinglePassengerSurchargeSelection,
  getSinglePassengerSurchargeSummary,
} from '../lib/pricing/single-passenger-surcharge';

test('calcula el 50% sobre el subtotal base para un solo pasajero', () => {
  const selection = getSinglePassengerSurchargeSelection(100000, 1);

  assert.ok(selection);
  assert.equal(selection?.code, 'singlePassengerSurcharge');
  assert.equal(selection?.amount, 50000);
  assert.equal(getSinglePassengerSurchargeAmount(100000, 1), 50000);
});

test('no genera recargo para multiples pasajeros', () => {
  assert.equal(getSinglePassengerSurchargeSelection(200000, 2), null);
  assert.equal(getSinglePassengerSurchargeAmount(200000, 2), 0);
});

test('resume correctamente el recargo visible cuando aplica', () => {
  const summary = getSinglePassengerSurchargeSummary({
    people: 1,
    baseSubtotalAmount: 100000,
  });

  assert.equal(summary.applies, true);
  assert.equal(summary.title, 'Recargo tarifa individual');
  assert.equal(summary.label, 'Recargo por pasajero individual (50%)');
  assert.equal(summary.amount, 50000);
});

test('el resumen no aplica cuando la reserva no es individual', () => {
  const summary = getSinglePassengerSurchargeSummary({
    people: 3,
    baseSubtotalAmount: 300000,
  });

  assert.equal(summary.applies, false);
  assert.equal(summary.amount, 0);
});
