/**
 * Sanitiza y formatea números de teléfono para WhatsApp API
 * Maneja números argentinos e internacionales
 */

export function sanitizePhoneForWhatsApp(phone: string): string {
  // Limpiar el número de todos los caracteres no numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Si está vacío, retornar vacío
  if (!cleaned) return '';
  
  // Detectar si es número argentino
  // Casos comunes:
  // - 1166068541 (celular BA sin código país)
  // - 01166068541 (con 0 inicial)
  // - 541166068541 (sin el 9)
  // - 5491166068541 (correcto)
  // - 2214567890 (celular La Plata sin código país)
  // - 3414567890 (celular Rosario sin código país)
  // - 3514567890 (celular Córdoba sin código país)
  
  // Si ya tiene 54 al inicio
  if (cleaned.startsWith('54')) {
    // Remover el 54 temporalmente para analizar
    const withoutCountry = cleaned.substring(2);
    
    // Si después del 54 viene un 9, ya está bien formateado
    if (withoutCountry.startsWith('9')) {
      return cleaned; // Ya está correcto: 5491166068541
    }
    
    // Si no tiene el 9, agregarlo después del 54
    // Casos de área comunes de Argentina (celulares):
    // 11 (Buenos Aires), 221 (La Plata), 341 (Rosario), 351 (Córdoba), 
    // 261 (Mendoza), 381 (Tucumán), 223 (Mar del Plata), etc.
    if (withoutCountry.match(/^(11|2\d{2}|3\d{2}|4\d{2}|6\d{2})/)) {
      return `549${withoutCountry}`; // 54 + 9 + código área + número
    }
    
    // Si no coincide con patrón argentino, asumir que ya está bien
    return cleaned;
  }
  
  // Si empieza con 0 (formato local argentino con 0)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1); // Remover el 0
  }
  
  // Detectar números argentinos por código de área
  // Celulares Argentina empiezan con: 11, 2XX, 3XX, 4XX, 6XX
  if (cleaned.match(/^(11|15|2\d{2}|3\d{2}|4\d{2}|6\d{2})\d{7,8}$/)) {
    // Si empieza con 15, removerlo (formato antiguo)
    if (cleaned.startsWith('15')) {
      cleaned = `11${cleaned.substring(2)}`;
    }
    return `549${cleaned}`; // Agregar código país argentino + 9
  }
  
  // Si tiene 10 dígitos y no tiene código de país, asumir Argentina
  if (cleaned.length === 10) {
    return `549${cleaned}`;
  }
  
  // Si tiene más de 10 dígitos, asumir que ya tiene código de país
  // (puede ser internacional)
  if (cleaned.length > 10) {
    return cleaned;
  }
  
  // Para números más cortos, asumir que ya están bien o son incompletos
  // Agregar código argentino por defecto si tienen 8-9 dígitos (números locales)
  if (cleaned.length >= 8 && cleaned.length <= 9) {
    return `54911${cleaned}`; // Asumir Buenos Aires por defecto
  }
  
  return cleaned;
}

/**
 * Formatea un número para mostrar de forma legible
 */
export function formatPhoneDisplay(phone: string): string {
  const sanitized = sanitizePhoneForWhatsApp(phone);
  
  // Si es argentino (54 9 XXX XXXXXXX)
  if (sanitized.startsWith('549')) {
    const withoutPrefix = sanitized.substring(3); // Quitar 549
    const areaCode = withoutPrefix.substring(0, withoutPrefix.length === 10 ? 2 : 3);
    const number = withoutPrefix.substring(areaCode.length);
    
    return `+54 9 ${areaCode} ${number}`;
  }
  
  // Para otros países, formato genérico
  if (sanitized.length > 10) {
    return `+${sanitized}`;
  }
  
  return phone; // Retornar original si no se pudo formatear
}

/**
 * Valida si un número de teléfono es válido para WhatsApp
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const sanitized = sanitizePhoneForWhatsApp(phone);
  
  // Debe tener al menos 10 dígitos (mínimo internacional)
  // y máximo 15 (límite E.164)
  return sanitized.length >= 10 && sanitized.length <= 15;
}

