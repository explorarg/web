import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/** Siempre leer del disco: testimonials/testimonials.json es la fuente de verdad. */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Testimonio en la biblioteca (con id para selección). */
export type LibraryTestimonial = {
  id: string;
  name: string;
  quote: string;
  role?: string;
};

type JsonTestimonial = {
  name: string;
  country?: string;
  comment: string;
  categories?: string[];
};

const DEFAULT_CATEGORY = 'General';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function normalize(item: JsonTestimonial, index: number): LibraryTestimonial & { categories: string[] } {
  const categories = Array.isArray(item.categories) && item.categories.length > 0
    ? item.categories
    : [DEFAULT_CATEGORY];
  return {
    id: String(index),
    name: item.name ?? '',
    quote: item.comment ?? '',
    role: item.country ?? undefined,
    categories,
  };
}

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'testimonials', 'testimonials.json');
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as { testimonials?: JsonTestimonial[] };
    const testimonialsList = Array.isArray(data?.testimonials) ? data.testimonials : [];
    const list = testimonialsList.map((item, i) => normalize(item, i));

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.trim() || null;
    const allInCategory = searchParams.get('all') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));

    let filtered = list;
    if (category && category !== '') {
      filtered = list.filter((t) => t.categories.includes(category));
    }

    const categoriesSet = new Set<string>();
    list.forEach((t) => t.categories.forEach((c) => categoriesSet.add(c)));
    const categories = [DEFAULT_CATEGORY, ...Array.from(categoriesSet).filter((c) => c !== DEFAULT_CATEGORY).sort()];

    const noStoreHeaders = {
      'Cache-Control': 'no-store, max-age=0',
    };

    if (allInCategory) {
      const source = category && category !== '' ? filtered : list;
      const items = source.map(({ categories: _c, ...t }) => t);
      return NextResponse.json({ items, total: items.length, categories }, { headers: noStoreHeaders });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * limit;
    const items = filtered.slice(start, start + limit).map(({ categories: _c, ...t }) => t);

    return NextResponse.json(
      {
        items,
        total,
        page: currentPage,
        totalPages,
        limit,
        categories,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    console.error('[api/testimonials]', err);
    return NextResponse.json(
      { error: 'No se pudo cargar la biblioteca de testimonios.' },
      { status: 500 }
    );
  }
}
