import {
  addDoc,
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';

export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'reserva';

export type StockMovementInput = {
  packageId: string;
  date: string;
  type: StockMovementType;
  quantity: number;
  author: string;
  note?: string;
  referenceId?: string;
  /** Auditoría: cupo base al momento del movimiento (si aplica). */
  baseCapacityAtThatTime?: number;
  /** Auditoría: monto asociado a la reserva */
  amountTotal?: number;
  currency?: string;
};

export type StockMovement = StockMovementInput & {
  id: string;
  createdAt: object;
};

const COLLECTION = 'stockMovimientos';

export async function registrarMovimientoStock(data: StockMovementInput): Promise<string> {
  const timestamp = Timestamp.now();
  const payload = { ...data, createdAt: timestamp };
  const ref = await addDoc(collection(db, COLLECTION), payload);
  return ref.id;
}

export async function getMovimientosStock(
  packageId: string,
  options: { date?: string; limit?: number } = {}
): Promise<StockMovement[]> {
  const constraints: ReturnType<typeof where>[] = [where('packageId', '==', packageId)];
  if (options.date) {
    constraints.push(where('date', '==', options.date));
  }
  const q = query(
    collection(db, COLLECTION),
    ...constraints,
    firestoreOrderBy('createdAt', 'desc'),
    ...(options.limit && options.limit > 0 ? [firestoreLimit(options.limit)] : [])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => serializeFirestoreData<StockMovement>({ id: d.id, ...d.data() }));
}

export async function getStockDisponible(
  experienceId: string,
  date: string,
  baseCapacity: number
): Promise<number> {
  const movements = await getMovimientosStock(experienceId, { date });
  const delta = movements.reduce((sum, movement) => sum + movement.quantity, 0);
  return Math.max(0, baseCapacity + delta);
}
