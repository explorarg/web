import {
  Timestamp,
  collection,
  doc,
  runTransaction,
  type Transaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function generateReservationCode(reservationId: string, createdAt: unknown): string {
  const digits = normalizeDigits(reservationId) || normalizeDigits(createdAt) || '0';
  return digits.padStart(6, '0').slice(-6);
}

const RESERVATION_COUNTERS_COLLECTION = 'systemCounters';
const RESERVATION_COUNTER_DOC = 'reservations';

export function formatReservationCodeSequence(sequence: number): string {
  const safe = Math.max(0, Math.floor(Number(sequence) || 0));
  return String(safe).padStart(4, '0');
}

export async function reserveNextReservationCode(): Promise<string> {
  return runTransaction(db, async (tx) => reserveNextReservationCodeInTransaction(tx));
}

export async function prepareNextReservationCodeInTransaction(tx: Transaction): Promise<{
  reservationCode: string;
  commit: () => void;
}> {
  const counterRef = doc(collection(db, RESERVATION_COUNTERS_COLLECTION), RESERVATION_COUNTER_DOC);
  const snap = await tx.get(counterRef);
  const current = snap.exists() ? Math.max(0, Number((snap.data() as any)?.lastNumber ?? 0) || 0) : 0;
  const next = current + 1;
  const now = Timestamp.now();

  return {
    reservationCode: formatReservationCodeSequence(next),
    commit: () => {
      if (snap.exists()) {
        tx.update(counterRef, {
          lastNumber: next,
          updatedAt: now,
        });
      } else {
        tx.set(counterRef, {
          lastNumber: next,
          createdAt: now,
          updatedAt: now,
        });
      }
    },
  };
}

export async function reserveNextReservationCodeInTransaction(tx: Transaction): Promise<string> {
  const allocation = await prepareNextReservationCodeInTransaction(tx);
  allocation.commit();
  return allocation.reservationCode;
}

export function normalizeEmail(value: unknown): string | null {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  return s;
}

export function normalizeDigits(value: unknown): string | null {
  const s = String(value ?? '').replace(/\D/g, '');
  return s.length ? s : null;
}
