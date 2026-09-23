/**
 * Funciones para gestionar Paquetes Turísticos (reemplaza experiencias.ts)
 * Adaptado para Explorarg - Sistema de reservas sobre Paquetes
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  updateDoc,
  setDoc,
  deleteDoc,
  addDoc,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import type { Paquete, Salida } from '@/types';
import { getOperationalSalidas, resolveDepartureConfig } from '@/lib/packages/resolve-departure';
import { packageHasCategory } from '@/lib/packages/category-utils';

const COLLECTION = 'paquetes';

// ============================================================================
// TIPOS
// ============================================================================

export type BookingDate = {
  date: string; // YYYY-MM-DD
  capacity: number;
  available: number;
  enabled: boolean;
};

export type BookingPublicData = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: BookingDate[];
  maxPeoplePerBooking: number;
  currency: string;
  depositAmount: number | null;
};

export type PackageWithBooking = Paquete;

// ============================================================================
// FUNCIONES CRUD BÁSICAS
// ============================================================================

/** Obtener todos los paquetes visibles (para el frontend) */
export async function getPaquetes(): Promise<Paquete[]> {
  const q = query(
    collection(db, COLLECTION),
    where('visible', '==', true),
    orderBy('orden', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestoreData<Paquete>({ id: d.id, ...d.data() }));
}

/** Obtener paquetes destacados (para homepage) */
export async function getPaquetesDestacados(maxItems = 6): Promise<Paquete[]> {
  const q = query(
    collection(db, COLLECTION),
    where('visible', '==', true),
    where('destacado', '==', true),
    orderBy('orden', 'asc'),
    firestoreLimit(maxItems)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestoreData<Paquete>({ id: d.id, ...d.data() }));
}

/** Obtener paquete por ID */
export async function getPaqueteById(id: string): Promise<Paquete | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return serializeFirestoreData<Paquete>({ id: snap.id, ...snap.data() });
}

/** Obtener paquete por slug (para páginas públicas) */
export async function getPaqueteBySlug(slug: string): Promise<Paquete | null> {
  const q = query(
    collection(db, COLLECTION),
    where('slug', '==', slug),
    where('visible', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() });
}

/** Obtener paquetes por categoría/destino */
export async function getPaquetesByCategoria(categoriaId: string): Promise<Paquete[]> {
  const paquetes = await getPaquetes();
  return paquetes.filter((paquete) => packageHasCategory(paquete, categoriaId));
}

/** Verificar si un título de paquete ya existe */
export async function isPaqueteTitleTaken(titulo: string, excludeId?: string): Promise<boolean> {
  const q = query(collection(db, COLLECTION), where('titulo', '==', titulo));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (!excludeId) return true;
  // Check if the existing document is the one we're excluding
  return !snap.docs.every(doc => doc.id === excludeId);
}

// ============================================================================
// FUNCIONES PARA SISTEMA DE RESERVAS
// ============================================================================

/**
 * Convertir un Paquete a datos de booking públicos
 * Calcular available = capacity - reservas existentes
 */
export function toBookingPublicData(
  paquete: PackageWithBooking,
  reservedByDate: Record<string, number>
): BookingPublicData {
  const bc = paquete.bookingConfig;
  const enabled = bc?.enabled !== false;
  const operationalSalidas = getOperationalSalidas(paquete);

  const dates: BookingDate[] = operationalSalidas.map((salida) => {
    const resolved = resolveDepartureConfig(paquete, salida.fecha);
    const capacity = Math.max(0, resolved.baseCapacity || 0);
    const reserved = reservedByDate[salida.fecha] || 0;
    return {
      date: salida.fecha,
      capacity,
      available: Math.max(0, capacity - reserved),
      enabled: resolved.enabled,
    };
  });

  return {
    enabled,
    title: paquete.titulo || 'Reserva',
    subtitle1: paquete.descripcionCorta || paquete.descripcion || '',
    subtitle2: '',
    hasSpecificDates: dates.length > 0,
    dates: dates.filter((d) => d.enabled),
    maxPeoplePerBooking: resolveDepartureConfig(paquete, operationalSalidas[0]?.fecha || 'sin-fecha').maxPeople,
    currency: String(resolveDepartureConfig(paquete, operationalSalidas[0]?.fecha || 'sin-fecha').currency || 'ars').toLowerCase(),
    depositAmount: typeof bc?.depositAmount === 'number' ? bc.depositAmount : null,
  };
}

/** Obtener capacidad base para una fecha específica */
export function getBaseCapacityForDate(
  paquete: PackageWithBooking | null,
  date: string
): number {
  if (!paquete) return 0;
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

/** Verificar si un paquete tiene reservas habilitadas */
export function isBookingEnabled(paquete: PackageWithBooking | null): boolean {
  if (!paquete) return false;
  return paquete.bookingConfig?.enabled !== false;
}

/** Obtener precio de reserva de un paquete */
export function getBookingPrice(paquete: PackageWithBooking | null): number {
  if (!paquete) return 0;
  const bc = paquete.bookingConfig;
  if (typeof bc?.depositAmount === 'number' && bc.depositAmount > 0) {
    return bc.depositAmount;
  }
  // Si no hay depositAmount configurado, usar precio del paquete
  return paquete.precio || 0;
}

// ============================================================================
// FUNCIONES ADMIN
// ============================================================================

/** Crear paquete (admin) */
export async function createPaquete(data: Omit<Paquete, 'id' | 'fechaCreacion'>): Promise<string> {
  // Validar título único
  if (await isPaqueteTitleTaken(data.titulo)) {
    throw new Error('Ya existe un paquete con este título');
  }
  const now = Timestamp.now();
  const payload = {
    ...data,
    fechaCreacion: now,
  };
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return docRef.id;
}

/** Actualizar paquete (admin) */
export async function updatePaquete(id: string, data: Partial<Paquete>): Promise<void> {
  // Validar título único si se está modificando el título
  if (data.titulo && await isPaqueteTitleTaken(data.titulo, id)) {
    throw new Error('Ya existe un paquete con este título');
  }
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/** Eliminar paquete (admin) */
export async function deletePaquete(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Obtener todos los paquetes para admin (incluye no visibles) */
export async function getAllPaquetesAdmin(): Promise<Paquete[]> {
  const q = query(collection(db, COLLECTION), orderBy('orden', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestoreData<Paquete>({ id: d.id, ...d.data() }));
}

// ============================================================================
// CONFIGURACIÓN DE RESERVAS (BOOKING CONFIG)
// ============================================================================

/** Actualizar configuración de reservas de un paquete */
export async function updatePaqueteBookingConfig(
  paqueteId: string,
  config: PackageWithBooking['bookingConfig']
): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  await updateDoc(ref, {
    bookingConfig: config,
    updatedAt: Timestamp.now(),
  });
}

/** Habilitar/deshabilitar reservas para un paquete */
export async function togglePaqueteBooking(paqueteId: string, enabled: boolean): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  await updateDoc(ref, {
    'bookingConfig.enabled': enabled,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// SALIDAS/FECHAS
// ============================================================================

/** Agregar salida a un paquete */
export async function addSalida(paqueteId: string, salida: Omit<Salida, 'id'>): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  const paquete = await getPaqueteById(paqueteId);
  if (!paquete) throw new Error('Paquete no encontrado');
  
  const nuevasSalidas = [...(paquete.salidas || []), { ...salida, id: crypto.randomUUID() }];
  await updateDoc(ref, {
    salidas: nuevasSalidas,
    updatedAt: Timestamp.now(),
  });
}

/** Eliminar salida de un paquete */
export async function removeSalida(paqueteId: string, salidaId: string): Promise<void> {
  const ref = doc(db, COLLECTION, paqueteId);
  const paquete = await getPaqueteById(paqueteId);
  if (!paquete) throw new Error('Paquete no encontrado');
  
  const nuevasSalidas = (paquete.salidas || []).filter((s) => s.id !== salidaId);
  await updateDoc(ref, {
    salidas: nuevasSalidas,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================================
// CATEGORÍAS/DESTINOS
// ============================================================================

const CATEGORIAS_COLLECTION = 'categorias';

/** Obtener todas las categorías/destinos */
export async function getCategorias(): Promise<any[]> {
  const q = query(
    collection(db, CATEGORIAS_COLLECTION),
    where('activa', '==', true),
    orderBy('orden', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => serializeFirestoreData({ id: d.id, ...d.data() }));
}

/** Obtener categoría por slug */
export async function getCategoriaBySlug(slug: string): Promise<any | null> {
  const q = query(
    collection(db, CATEGORIAS_COLLECTION),
    where('slug', '==', slug),
    where('activa', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return serializeFirestoreData({ id: snap.docs[0].id, ...snap.docs[0].data() });
}

// ============================================================================
// COMPATIBILIDAD (para migración suave)
// ============================================================================

/** Alias para mantener compatibilidad con código que espera experiencias */
export const getExperienciaById = getPaqueteById;
export const getExperienciaBySlug = getPaqueteBySlug;
