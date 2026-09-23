import type { Paquete } from '@/types';

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getPackageCategoryIds(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>): string[] {
  const unique = new Set<string>();

  const primary = normalizeId(paquete.categoriaId);
  if (primary) unique.add(primary);

  if (Array.isArray(paquete.categoriaIds)) {
    for (const categoriaId of paquete.categoriaIds) {
      const normalized = normalizeId(categoriaId);
      if (normalized) unique.add(normalized);
    }
  }

  return Array.from(unique);
}

export function normalizePackageCategoryIds(categoryIds: string[], categoriaId?: string | null): string[] {
  return getPackageCategoryIds({
    categoriaIds: Array.isArray(categoryIds) ? categoryIds : [],
    categoriaId: categoriaId ?? undefined,
  });
}

export function getPrimaryPackageCategoryId(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>): string | null {
  return getPackageCategoryIds(paquete)[0] ?? null;
}

export function packageHasCategory(paquete: Pick<Paquete, 'categoriaId' | 'categoriaIds'>, categoriaId: string): boolean {
  const normalized = normalizeId(categoriaId);
  if (!normalized) return false;
  return getPackageCategoryIds(paquete).includes(normalized);
}
