import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSinglePassengerSurchargeViewModel } from '../lib/pricing/single-passenger-surcharge-view';

test('construye el bloque visual compacto del recargo', () => {
  const viewModel = buildSinglePassengerSurchargeViewModel({
    applies: true,
    label: 'Recargo por pasajero individual (50%)',
    amountLabel: '$ 50.000 ARS',
  });

  assert.ok(viewModel);
  assert.equal(viewModel?.rows.length, 1);
  assert.equal(viewModel?.rows[0]?.label, 'Recargo por pasajero individual (50%)');
  assert.equal(viewModel?.rows[0]?.amountLabel, '$ 50.000 ARS');
});

test('no construye bloque visual cuando el recargo no aplica', () => {
  const viewModel = buildSinglePassengerSurchargeViewModel({
    applies: false,
    label: 'Recargo por pasajero individual (50%)',
    amountLabel: '$ 0 ARS',
  });

  assert.equal(viewModel, null);
});
