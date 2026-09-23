'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalida la caché de Next.js para las rutas dadas.
 * Llamar tras guardar en el admin para que el front muestre los cambios de inmediato.
 */
export async function revalidateFrontPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    revalidatePath(path);
  }
}
