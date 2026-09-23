import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { Timestamp, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const seatSchema = z.object({
  seatId: z.string().min(1).refine((v) => !v.includes('.'), 'seatId inválido'),
  label: z.string().min(1),
  floor: z.number().int().min(0),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  category: z.enum(['cocheCama', 'panoramicos', 'cafeteras']).nullable().optional(),
  disabled: z.boolean().optional(),
  defaultBlocked: z.boolean().optional(),
});

const specialCellSchema = z.object({
  floor: z.number().int().min(0),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  type: z.enum(['wc', 'stairs', 'driver', 'empty']),
  label: z.string().max(30).optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  busType: z.string().min(1).max(60),
  status: z.enum(['draft', 'published']).optional(),
  floors: z.number().int().min(1).max(3),
  rows: z.number().int().min(1).max(80),
  cols: z.number().int().min(1).max(12),
  aisleCols: z.array(z.number().int().min(0)).optional(),
  startNumber: z.number().int().min(1).max(999).optional(),
  autoNumbering: z.boolean().optional(),
  showRowLabels: z.boolean().optional(),
  seats: z.array(seatSchema).min(1),
  specialCells: z.array(specialCellSchema).optional(),
  categoryPricing: z.object({
    cocheCama: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
    panoramicos: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
    cafeteras: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
  }).optional(),
  amenities: z.object({
    cocheCama: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
    panoramicos: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
    cafeteras: z.object({
      amount: z.number().min(0).optional(),
    }).optional(),
  }).optional(),
  notes: z.string().max(1000).optional(),
});

async function requireAuth(request: Request) {
  try {
    await requireAdminToken(request);
  } catch (error) {
    console.error('[admin/seat-layouts] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const col = collection(db, 'seatLayouts');
  const q = query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  const now = Timestamp.now();
  const ref = doc(collection(db, 'seatLayouts'));
  await setDoc(ref, { ...parsed.data, createdAt: now, updatedAt: now });
  return NextResponse.json({ ok: true, id: ref.id });
}

export async function PATCH(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = z
    .object({
      id: z.string().min(1),
      data: templateSchema,
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', details: parsed.error }, { status: 400 });
  }

  await updateDoc(doc(db, 'seatLayouts', parsed.data.id), {
    ...parsed.data.data,
    updatedAt: Timestamp.now(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 });
  }
  await deleteDoc(doc(db, 'seatLayouts', id));
  return NextResponse.json({ ok: true });
}
