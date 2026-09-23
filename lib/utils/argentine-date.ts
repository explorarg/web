export function extractArgentineDateDigits(value: string): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

export function formatIsoDateToArgentine(value: string): string {
  const trimmed = String(value ?? '').trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return trimmed;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function formatArgentineDateDigits(digitsInput: string): string {
  const digits = extractArgentineDateDigits(digitsInput);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function countDigitsBeforeCaret(value: string, caretPosition: number | null | undefined): number {
  const safeCaret = Math.max(0, Math.min(Number(caretPosition ?? value.length), value.length));
  return extractArgentineDateDigits(value.slice(0, safeCaret)).length;
}

export function getCaretPositionForDigitIndex(formattedValue: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) {
      seenDigits += 1;
      if (seenDigits === digitIndex) {
        return index + 1;
      }
    }
  }

  return formattedValue.length;
}

export function applyArgentineDateMask(value: string, caretPosition: number | null | undefined) {
  const digits = extractArgentineDateDigits(value);
  const formattedValue = formatArgentineDateDigits(digits);
  const digitIndex = Math.min(countDigitsBeforeCaret(value, caretPosition), digits.length);
  const nextCaretPosition = getCaretPositionForDigitIndex(formattedValue, digitIndex);

  return {
    digits,
    formattedValue,
    nextCaretPosition,
  };
}

export function isGregorianDate(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
  );
}

export function parseArgentineDateToIso(value: string): string | null {
  const digits = extractArgentineDateDigits(value);
  if (!digits) return '';
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (!isGregorianDate(day, month, year)) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidIsoDateString(value: string): boolean {
  const trimmed = String(value ?? '').trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, yearRaw, monthRaw, dayRaw] = match;
  return isGregorianDate(Number(dayRaw), Number(monthRaw), Number(yearRaw));
}
