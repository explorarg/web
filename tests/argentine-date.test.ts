import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyArgentineDateMask,
  extractArgentineDateDigits,
  formatArgentineDateDigits,
  formatIsoDateToArgentine,
  getCaretPositionForDigitIndex,
  isGregorianDate,
  isValidIsoDateString,
  parseArgentineDateToIso,
} from '../lib/utils/argentine-date';

test('formatea escritura secuencial con barras automáticas', () => {
  assert.equal(formatArgentineDateDigits('1'), '1');
  assert.equal(formatArgentineDateDigits('12'), '12');
  assert.equal(formatArgentineDateDigits('120'), '12/0');
  assert.equal(formatArgentineDateDigits('1205'), '12/05');
  assert.equal(formatArgentineDateDigits('12051996'), '12/05/1996');
});

test('ignora caracteres no numéricos y limita a 8 dígitos', () => {
  assert.equal(extractArgentineDateDigits('12a/0b5-1996xx'), '12051996');
  assert.equal(formatArgentineDateDigits('12a/0b5-1996123'), '12/05/1996');
});

test('parsea fecha argentina válida a ISO', () => {
  assert.equal(parseArgentineDateToIso('12/05/1996'), '1996-05-12');
  assert.equal(parseArgentineDateToIso('29022024'), '2024-02-29');
});

test('rechaza fechas gregorianas inválidas', () => {
  assert.equal(parseArgentineDateToIso('31/02/2024'), null);
  assert.equal(parseArgentineDateToIso('29/02/2023'), null);
  assert.equal(isGregorianDate(31, 4, 2024), false);
  assert.equal(isValidIsoDateString('2024-02-31'), false);
  assert.equal(isValidIsoDateString('2024-02-29'), true);
});

test('mantiene una posición de cursor coherente al insertar en posiciones intermedias', () => {
  const result = applyArgentineDateMask('12/305/1996', 4);
  assert.equal(result.formattedValue, '12/30/5199');
  assert.equal(result.nextCaretPosition, 4);
});

test('recalcula correctamente el cursor al borrar dígitos', () => {
  const result = applyArgentineDateMask('12/0/1996', 4);
  assert.equal(result.formattedValue, '12/01/996');
  assert.equal(result.nextCaretPosition, 4);
});

test('ubica el cursor al final cuando supera la longitud del valor', () => {
  const formatted = formatArgentineDateDigits('12051996');
  assert.equal(getCaretPositionForDigitIndex(formatted, 20), formatted.length);
});

test('formatea fecha ISO al formato argentino visible', () => {
  assert.equal(formatIsoDateToArgentine('1996-05-12'), '12/05/1996');
  assert.equal(formatIsoDateToArgentine(''), '');
});
