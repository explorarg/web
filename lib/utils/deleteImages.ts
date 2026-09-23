/**
 * Elimina una imagen de R2
 * @param imageUrl URL de la imagen a eliminar
 * @returns Promise<boolean> true si se eliminó correctamente
 */
export async function deleteImage(imageUrl: string): Promise<boolean> {
  try {
    const isLikelyR2Url = (() => {
      if (!imageUrl) return false;
      try {
        const parsed = new URL(imageUrl);
        return parsed.hostname.endsWith('.r2.dev');
      } catch {
        return false;
      }
    })();

    if (!isLikelyR2Url) {
      console.warn('URL de imagen inválida o no es de R2:', imageUrl);
      return false;
    }

    const response = await fetch(`/api/delete-image?url=${encodeURIComponent(imageUrl)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error al eliminar imagen:', error);
      return false;
    }

    console.log('Imagen eliminada correctamente:', imageUrl);
    return true;
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    return false;
  }
}

/**
 * Elimina múltiples imágenes de R2
 * @param imageUrls Array de URLs de imágenes a eliminar
 * @returns Promise<number> Cantidad de imágenes eliminadas exitosamente
 */
export async function deleteMultipleImages(imageUrls: string[]): Promise<number> {
  if (!imageUrls || imageUrls.length === 0) {
    return 0;
  }

  const validUrls = imageUrls.filter((url) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('.r2.dev');
    } catch {
      return false;
    }
  });
  
  if (validUrls.length === 0) {
    console.warn('No hay URLs válidas de R2 para eliminar');
    return 0;
  }

  console.log(`Eliminando ${validUrls.length} imágenes de R2...`);

  // Eliminar en paralelo
  const deletePromises = validUrls.map(url => deleteImage(url));
  const results = await Promise.all(deletePromises);
  
  // Contar eliminaciones exitosas
  const successCount = results.filter(success => success).length;
  
  console.log(`${successCount} de ${validUrls.length} imágenes eliminadas correctamente`);
  
  return successCount;
}

/**
 * Extrae todas las URLs de imágenes de un paquete
 * @param paquete Objeto paquete con imagenPrincipal y galeria
 * @returns Array de URLs de imágenes
 */
export function extractPackageImageUrls(paquete: {
  imagenPrincipal?: string;
  imagenTarjeta?: string;
  imagenPortada?: string;
  galeria?: string[];
  tickets?: { imagenUrl?: string }[];
}): string[] {
  const urls: string[] = [];
  
  if (paquete.imagenPrincipal) {
    urls.push(paquete.imagenPrincipal);
  }

  if (paquete.imagenTarjeta) {
    urls.push(paquete.imagenTarjeta);
  }

  if (paquete.imagenPortada) {
    urls.push(paquete.imagenPortada);
  }
  
  if (paquete.galeria && paquete.galeria.length > 0) {
    urls.push(...paquete.galeria);
  }

  if (paquete.tickets && paquete.tickets.length > 0) {
    paquete.tickets.forEach((ticket) => {
      if (ticket.imagenUrl) {
        urls.push(ticket.imagenUrl);
      }
    });
  }
  
  return urls;
}

/**
 * Extrae todas las URLs de imágenes de un blog
 */
export function extractBlogImageUrls(post: {
  imagenPrincipal?: string;
  imagenTarjeta?: string;
  imagenPortada?: string;
}): string[] {
  const urls: string[] = [];

  if (post.imagenPrincipal) urls.push(post.imagenPrincipal);
  if (post.imagenTarjeta) urls.push(post.imagenTarjeta);
  if (post.imagenPortada) urls.push(post.imagenPortada);

  return urls;
}

/**
 * Extrae la URL de imagen de una categoría
 * @param categoria Objeto categoría con imagen
 * @returns Array con la URL de imagen (si existe)
 */
export function extractCategoryImageUrls(categoria: { imagen?: string }): string[] {
  return categoria.imagen ? [categoria.imagen] : [];
}
