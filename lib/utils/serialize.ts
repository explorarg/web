import { Timestamp } from 'firebase/firestore';

/**
 * Type guard para verificar si un valor tiene un método toDate
 */
function hasToDateMethod(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

/**
 * Convierte un objeto de Firestore a un objeto JSON serializable
 * Compatible con Server Components de Next.js
 */
export function serializeFirestoreData<T>(data: unknown): T {
  if (!data) return data as T;

  // Si es un array, serializar cada elemento
  if (Array.isArray(data)) {
    return data.map(item => serializeFirestoreData(item)) as T;
  }

  // Si es un objeto
  if (typeof data === 'object') {
    const serialized: Record<string, unknown> = {};
    const dataObj = data as Record<string, unknown>;

    for (const key in dataObj) {
      const value = dataObj[key];

      // Convertir Timestamp a string ISO
      if (value instanceof Timestamp) {
        serialized[key] = value.toDate().toISOString();
      }
      // Si tiene método toDate, es un Timestamp (para compatibilidad)
      else if (hasToDateMethod(value)) {
        serialized[key] = value.toDate().toISOString();
      }
      // Recursivamente serializar objetos anidados
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        serialized[key] = serializeFirestoreData(value);
      }
      // Recursivamente serializar arrays
      else if (Array.isArray(value)) {
        serialized[key] = value.map(item => serializeFirestoreData(item));
      }
      // Valores primitivos
      else {
        serialized[key] = value;
      }
    }

    return serialized as T;
  }

  // Valores primitivos
  return data as T;
}
