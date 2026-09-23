import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { collection, doc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { DEFAULT_ROOM_TYPE_DEFINITIONS } from '@/lib/reservas/room-types';

export const runtime = 'nodejs';

const roomTypeDefinitionSchema = z.object({
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).default(''),
  isFullDay: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().min(0).max(9999).default(0),
});

async function requireAuth(request: Request) {
  await requireAdminToken(request);
}

async function listRoomTypes() {
  const snapshot = await getDocs(query(collection(db, 'roomTypes'), orderBy('order', 'asc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as object) }));
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    let items = await listRoomTypes();
    if (items.length === 0) {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      DEFAULT_ROOM_TYPE_DEFINITIONS.forEach(({ id, ...definition }) => {
        batch.set(doc(db, 'roomTypes', id), { ...definition, createdAt: now, updatedAt: now });
      });
      await batch.commit();
      items = await listRoomTypes();
    }
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cargar el catálogo.' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const parsed = roomTypeDefinitionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
    const ref = doc(collection(db, 'roomTypes'));
    const now = Timestamp.now();
    await setDoc(ref, { ...parsed.data, createdAt: now, updatedAt: now });
    return NextResponse.json({ item: { id: ref.id, ...parsed.data } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el tipo.' }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAuth(request);
    const parsed = z.object({ id: z.string().min(1), data: roomTypeDefinitionSchema }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
    await updateDoc(doc(db, 'roomTypes', parsed.data.id), { ...parsed.data.data, updatedAt: Timestamp.now() });
    const packageSnapshot = await getDocs(query(collection(db, 'paquetes'), where('roomTypes', 'array-contains', parsed.data.id)));
    if (!packageSnapshot.empty) {
      const batch = writeBatch(db);
      packageSnapshot.docs.forEach((packageDoc) => {
        const currentOptions = Array.isArray(packageDoc.data().roomTypeOptions) ? packageDoc.data().roomTypeOptions : [];
        const nextDefinition = { id: parsed.data.id, ...parsed.data.data };
        const nextOptions = currentOptions.some((option: any) => option?.id === parsed.data.id)
          ? currentOptions.map((option: any) => option?.id === parsed.data.id ? nextDefinition : option)
          : [...currentOptions, nextDefinition];
        batch.update(packageDoc.ref, { roomTypeOptions: nextOptions, updatedAt: Timestamp.now() });
      });
      await batch.commit();
      revalidatePath('/paquetes');
      packageSnapshot.docs.forEach((packageDoc) => {
        const slug = String(packageDoc.data().slug ?? '').trim();
        if (slug) revalidatePath(`/paquete/${slug}`);
      });
    }
    return NextResponse.json({ item: { id: parsed.data.id, ...parsed.data.data } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo editar el tipo.' }, { status: 401 });
  }
}