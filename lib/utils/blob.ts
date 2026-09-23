export function getBlobKeyFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    return pathname.startsWith('/') ? pathname.slice(1) : pathname;
  } catch {
    return null;
  }
}

export async function deleteBlobByKey(key: string): Promise<void> {
  if (!key) {
    throw new Error('Key requerida para eliminar del Blob');
  }

  const response = await fetch('/api/upload', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || 'No se pudo eliminar el blob');
  }
}
