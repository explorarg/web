import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Cliente } from '@/types';

interface UpsertClienteInput {
  uid: string;
  email: string;
  nombre?: string;
  apellido?: string;
  phoneNumber?: string;
  photoURL?: string;
  provider?: Cliente['provider'];
}

export const upsertClienteProfile = async ({
  uid,
  email,
  nombre,
  apellido,
  phoneNumber,
  photoURL,
  provider,
}: UpsertClienteInput) => {
  const ref = doc(db, 'clientes', uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as Partial<Cliente>) : null;

  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim();

  const payload: Partial<Cliente> = {
    id: uid,
    email,
    nombre: nombre || existing?.nombre,
    apellido: apellido || existing?.apellido,
    nombreCompleto: nombreCompleto || existing?.nombreCompleto,
    telefono: phoneNumber || existing?.telefono,
    photoURL: photoURL || existing?.photoURL,
    provider: provider || existing?.provider,
    updatedAt: Timestamp.now(),
  };

  if (!existing?.createdAt) {
    payload.createdAt = Timestamp.now();
  }

  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );

  await setDoc(ref, cleanedPayload, { merge: true });
};
