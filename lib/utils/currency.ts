/**
 * Obtiene el símbolo de la moneda
 */
export function getCurrencySymbol(moneda: 'USD' | 'ARS' | 'EUR'): string {
  const symbols = {
    USD: '$',
    ARS: '$',
    EUR: '€',
  };
  return symbols[moneda] || '$';
}

/**
 * Formatea un precio con su moneda
 */
export function formatPrice(precio: number, moneda: 'USD' | 'ARS' | 'EUR'): string {
  const symbol = getCurrencySymbol(moneda);
  const formattedNumber = precio.toLocaleString('es-AR');
  
  if (moneda === 'EUR') {
    return `${symbol}${formattedNumber}`;
  }
  
  return `${moneda} ${symbol}${formattedNumber}`;
}

/**
 * Formatea un precio mostrando solo el símbolo sin código de moneda
 */
export function formatPriceWithSymbol(precio: number, moneda: 'USD' | 'ARS' | 'EUR'): string {
  const symbol = getCurrencySymbol(moneda);
  return `${symbol}${precio.toLocaleString('es-AR')}`;
}

