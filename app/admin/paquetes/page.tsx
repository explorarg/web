'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, getDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Paquete } from '@/types';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { uploadImage, type UploadResult } from '@/lib/utils/upload';
import { slugify } from '@/lib/utils/slugify';
import { revalidateFrontPaths } from '@/lib/revalidate';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, X, User, Users, Sparkles, Globe2, GraduationCap, CheckCircle2, XCircle, Star, Music, Tag, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import DragDropTable from '@/components/admin/DragDropTable';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function buildUniqueCopyTitle(baseTitle: string, existingTitles: string[]): string {
  const cleanBase = String(baseTitle || 'Paquete').trim() || 'Paquete';
  const normalizedTitles = new Set(existingTitles.map((item) => item.trim().toLowerCase()));
  let candidate = `${cleanBase} (Copia)`;
  let counter = 2;

  while (normalizedTitles.has(candidate.trim().toLowerCase())) {
    candidate = `${cleanBase} (Copia ${counter})`;
    counter += 1;
  }

  return candidate;
}

function buildUniqueSlug(baseTitle: string, existingSlugs: string[]): string {
  const normalizedSlugs = new Set(existingSlugs.map((item) => String(item || '').trim()).filter(Boolean));
  const baseSlug = slugify(baseTitle) || `paquete-${Date.now()}`;
  let candidate = baseSlug;
  let counter = 2;

  while (normalizedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getExtensionFromSource(contentType: string | undefined, sourceUrl: string): string {
  const mime = String(contentType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('avif')) return 'avif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';

  const match = sourceUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return match?.[1]?.toLowerCase() || 'jpg';
}

async function cloneImageFromUrl(sourceUrl: string, fileBaseName: string): Promise<UploadResult | null> {
  const url = String(sourceUrl || '').trim();
  if (!url) return null;

  const response = await fetch('/api/clone-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceUrl: url, fileBaseName }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `No se pudo copiar la imagen desde ${url}`);
  }
  const data = await response.json();
  return {
    url: data.url,
    key: data.key,
  };
}

function buildDuplicatedPackageData(original: Paquete & Record<string, any>, args: {
  duplicateTitle: string;
  duplicateSlug: string;
  nextOrder: number;
  cardUpload: UploadResult | null;
  coverUpload: UploadResult | null;
  galleryUploads: UploadResult[];
}) {
  const {
    id: _id,
    slug: _slug,
    fechaCreacion: _fechaCreacion,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    createdBy: _createdBy,
    updatedBy: _updatedBy,
    ownerId: _ownerId,
    userId: _userId,
    uid: _uid,
    ...rest
  } = original;

  return {
    ...rest,
    titulo: args.duplicateTitle,
    slug: args.duplicateSlug,
    orden: args.nextOrder,
    fechaCreacion: Timestamp.now(),
    imagenPrincipal: args.cardUpload?.url || '',
    imagenPrincipalKey: args.cardUpload?.key || null,
    imagenTarjeta: args.cardUpload?.url || '',
    imagenTarjetaKey: args.cardUpload?.key || null,
    imagenPortada: args.coverUpload?.url || '',
    imagenPortadaKey: args.coverUpload?.key || null,
    galeria: args.galleryUploads.map((item) => item.url),
    galeriaKeys: args.galleryUploads.map((item) => item.key),
    salidas: Array.isArray(rest.salidas)
      ? rest.salidas.map((salida: any) => {
          const { id, createdAt, updatedAt, ...sanitizedSalida } = salida ?? {};
          void id;
          void createdAt;
          void updatedAt;
          return sanitizedSalida;
        })
      : [],
  };
}

export default function PaquetesPage() {
  const { user } = useAuth();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc'; mode: 'default' | 'custom' }>({
    key: 'orden',
    direction: 'asc',
    mode: 'default',
  });

  // Contar paquetes destacados
  const destacadosCount = useMemo(() => {
    return paquetes.filter(p => p.destacado).length;
  }, [paquetes]);
  const canDuplicate = Boolean(user?.email);
  const duplicateTarget = useMemo(
    () => paquetes.find((item) => item.id === duplicateId) ?? null,
    [paquetes, duplicateId]
  );

  const fetchPaquetes = async () => {
    try {
      const q = query(collection(db, 'paquetes'), orderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Paquete));
      setPaquetes(data);
    } catch (error) {
      console.error('Error fetching paquetes:', error);
      toast.error('Error al cargar paquetes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaquetes();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const paqueteDoc = await getDoc(doc(db, 'paquetes', deleteId));
      if (paqueteDoc.exists()) {
        const paqueteData = paqueteDoc.data() as Paquete;
        const keysToDelete = new Set<string>();

        if (paqueteData.imagenPrincipalKey) keysToDelete.add(paqueteData.imagenPrincipalKey);
        if (paqueteData.imagenTarjetaKey) keysToDelete.add(paqueteData.imagenTarjetaKey);
        if (paqueteData.imagenPortadaKey) keysToDelete.add(paqueteData.imagenPortadaKey);
        const principalFallback = getBlobKeyFromUrl(paqueteData.imagenPrincipal);
        if (principalFallback) keysToDelete.add(principalFallback);
        (paqueteData.galeriaKeys ?? []).forEach((key) => {
          if (key) keysToDelete.add(key);
        });
        (paqueteData.galeria ?? []).forEach((url) => {
          const key = getBlobKeyFromUrl(url);
          if (key) keysToDelete.add(key);
        });

        if (keysToDelete.size > 0) {
          toast.info('Eliminando imágenes...', { id: 'delete-images' });
          const deletions = Array.from(keysToDelete);
          const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
          results.forEach((result, idx) => {
            if (result.status === 'rejected') {
              console.error('[paquetes] error borrando archivo:', deletions[idx], result.reason);
            }
          });
          const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
          if (deletedCount > 0) {
            toast.success(`${deletedCount} imágenes eliminadas de R2`, { id: 'delete-images' });
            toast.dismiss('delete-images');
          } else {
            toast.warning('Paquete eliminado, pero hubo errores al eliminar las imágenes', { id: 'delete-images' });
          }
        }
      }

      await deleteDoc(doc(db, 'paquetes', deleteId));
      toast.success('Paquete eliminado correctamente');
      fetchPaquetes();
    } catch (error) {
      console.error('Error deleting paquete:', error);
      toast.error('Error al eliminar paquete');
    } finally {
      setDeleteId(null);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateId || !canDuplicate || duplicating) return;

    setDuplicating(true);
    const toastId = 'duplicate-package';

    try {
      toast.loading('Duplicando paquete...', {
        id: toastId,
        description: 'Se están copiando datos e imágenes del registro original.',
      });

      const paqueteDoc = await getDoc(doc(db, 'paquetes', duplicateId));
      if (!paqueteDoc.exists()) {
        throw new Error('El paquete seleccionado ya no existe.');
      }

      const original = paqueteDoc.data() as Paquete & Record<string, any>;
      const duplicateTitle = buildUniqueCopyTitle(original.titulo, paquetes.map((item) => item.titulo));
      const duplicateSlug = buildUniqueSlug(duplicateTitle, paquetes.map((item) => item.slug));
      const nextOrder = paquetes.length > 0 ? Math.max(...paquetes.map((item) => item.orden || 0)) + 1 : 1;

      const cardSource = String(original.imagenTarjeta || original.imagenPrincipal || '').trim();
      const coverSource = String(original.imagenPortada || original.imagenPrincipal || '').trim();
      const gallerySources = Array.isArray(original.galeria)
        ? original.galeria.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : [];

      const [cardUpload, coverUpload, galleryUploadsRaw] = await Promise.all([
        cloneImageFromUrl(cardSource, `${duplicateSlug}-card`),
        cloneImageFromUrl(coverSource, `${duplicateSlug}-cover`),
        Promise.all(gallerySources.map((url, index) => cloneImageFromUrl(url, `${duplicateSlug}-gallery-${index + 1}`))),
      ]);

      const galleryUploads = galleryUploadsRaw.filter((item): item is UploadResult => Boolean(item));
      const duplicatedData = buildDuplicatedPackageData(original, {
        duplicateTitle,
        duplicateSlug,
        nextOrder,
        cardUpload,
        coverUpload,
        galleryUploads,
      });

      const newDocRef = await addDoc(collection(db, 'paquetes'), duplicatedData);
      await revalidateFrontPaths(['/paquetes', `/paquete/${duplicateSlug}`]);
      await fetchPaquetes();
      setSearchTerm(duplicateTitle);
      setCurrentPage(1);

      toast.success('Paquete duplicado correctamente', {
        id: toastId,
        description: `Se creó una copia editable con ID ${newDocRef.id}.`,
      });
    } catch (error) {
      console.error('Error duplicando paquete:', error);
      toast.error('Error al duplicar paquete', {
        id: toastId,
        description: error instanceof Error ? error.message : 'No se pudo generar la copia.',
      });
    } finally {
      setDuplicating(false);
      setDuplicateId(null);
    }
  };

  // Filtrar paquetes por búsqueda
  const paquetesFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return paquetes;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return paquetes.filter(paquete =>
      paquete.titulo.toLowerCase().includes(searchLower) ||
      (paquete.destino && paquete.destino.toLowerCase().includes(searchLower)) ||
      paquete.slug.toLowerCase().includes(searchLower) ||
      (paquete.descripcion && paquete.descripcion.toLowerCase().includes(searchLower))
    );
  }, [paquetes, searchTerm]);

  const paquetesOrdenados = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = sort.key;
    const copy = [...paquetesFiltrados];

    copy.sort((a, b) => {
      const aVal =
        key === 'orden'
          ? (a.orden ?? 0)
          : key === 'titulo'
            ? (a.titulo ?? '')
            : key === 'destino'
              ? (a.destino ?? '')
              : key === 'tipo'
                ? (a.tipo ?? '')
                : key === 'precio'
                  ? (a.precio ?? 0)
                  : '';

      const bVal =
        key === 'orden'
          ? (b.orden ?? 0)
          : key === 'titulo'
            ? (b.titulo ?? '')
            : key === 'destino'
              ? (b.destino ?? '')
              : key === 'tipo'
                ? (b.tipo ?? '')
                : key === 'precio'
                  ? (b.precio ?? 0)
                  : '';

      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' }) * dir;
    });

    return copy;
  }, [paquetesFiltrados, sort.direction, sort.key]);

  // Paginación
  const paquetesPaginados = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return paquetesOrdenados.slice(startIndex, endIndex);
  }, [paquetesOrdenados, currentPage, itemsPerPage]);

  // Resetear página cuando cambie la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleExportReservas = async (packageId?: string) => {
    const currentUser = user;
    if (!currentUser) {
      toast.error('Tu sesión expiró. Volvé a iniciar sesión.');
      return;
    }

    setExporting(true);
    try {
      const token = await currentUser.getIdToken();
      const params = new URLSearchParams();
      if (packageId) params.set('packageId', packageId);
      if (searchTerm.trim()) params.set('searchTerm', searchTerm.trim());

      const response = await fetch(
        `/api/admin/reservas/export${params.toString() ? `?${params.toString()}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? await response.json().catch(() => null)
          : null;
        throw new Error(body?.error ?? 'No se pudieron exportar las reservas');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileDate = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `reservas-${fileDate}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const exportedCount = response.headers.get('X-Exported-Reservations');
      toast.success(
        exportedCount
          ? `Exportación lista: ${Number(exportedCount).toLocaleString('es-AR')} reservas`
          : 'Reservas exportadas correctamente'
      );
    } catch (error) {
      console.error('[admin/paquetes] error exportando reservas:', error);
      toast.error(error instanceof Error ? error.message : 'Error al exportar reservas');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-32 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-60 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-4 space-y-3">
              <div className="h-9 w-full sm:w-80 bg-gray-200 rounded-xl animate-pulse" />
              <div className="grid gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`paq-row-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Paquetes</h1>
                {destacadosCount > 0 && (
                  <Badge 
                    variant={destacadosCount >= 9 ? 'destructive' : 'secondary'}
                    className={destacadosCount >= 9 ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-blue-100 text-blue-800 hover:bg-blue-100'}
                  >
                    {destacadosCount}/9 destacados
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                Gestiona los paquetes turísticos
                {destacadosCount >= 9 && (
                  <span className="text-amber-600 ml-2">
                    • Solo los primeros 9 destacados se muestran en el inicio
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleExportReservas()}
                disabled={exporting}
                className="bg-white hover:bg-gray-50"
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar reservas CSV
              </Button>
              <Button asChild className="bg-black hover:bg-gray-800 text-white">
                <Link href="/admin/paquetes/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Paquete
                </Link>
              </Button>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por título, destino o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <DragDropTable
            items={paquetesPaginados}
            collectionName="paquetes"
            viewPath="/paquete"
            canDuplicate={canDuplicate}
            onDuplicate={(item) => setDuplicateId(item.id)}
            columns={[
              {
                key: 'orden',
                label: 'Orden',
                sortable: true,
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      #{item.orden}
                    </Badge>
                  </div>
                )
              },
              {
                key: 'titulo',
                label: 'Título',
                sortable: true,
                render: (item) => (
                  <div className="max-w-xs">
                    <span className="font-medium text-gray-900 line-clamp-2">
                      {item.titulo}
                    </span>
                  </div>
                )
              },
              {
                key: 'destino',
                label: 'Destino',
                sortable: true,
                render: (item) => <span className="text-gray-700">{item.destino}</span>
              },
              {
                key: 'tipo',
                label: 'Tipo',
                sortable: true,
                render: (item) => (
                  <Badge variant="outline" className="font-medium">
                    {item.tipo === 'individual' ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        Individual
                      </span>
                    ) : item.tipo === 'grupal' ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Grupal
                      </span>
                    ) : item.tipo === 'internacional' ? (
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="h-3.5 w-3.5" />
                        Internacional
                      </span>
                    ) : item.tipo === 'educativo' ? (
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Educativo
                      </span>
                    ) : item.tipo === 'eventos' ? (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Eventos
                      </span>
                    ) : item.tipo === 'recitales' ? (
                      <span className="inline-flex items-center gap-1">
                        <Music className="h-3.5 w-3.5" />
                        Recitales
                      </span>
                    ) : item.tipo === 'oferta' ? (
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        Oferta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        A medida
                      </span>
                    )}
                  </Badge>
                )
              },
              {
                key: 'precio',
                label: 'Precio',
                sortable: true,
                render: (item) => (
                  <span className="font-medium text-gray-900">
                    ${item.precio.toLocaleString('es-AR')}
                  </span>
                )
              },
              {
                key: 'estado',
                label: 'Estado',
                render: (item) => (
                  <div className="flex gap-2 flex-wrap">
                    <Badge 
                      variant={item.visible ? 'default' : 'secondary'}
                      className={item.visible ? 'bg-green-100 text-green-800 hover:bg-green-100 font-medium' : 'font-medium'}
                    >
                      <span className="inline-flex items-center gap-1">
                        {item.visible ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {item.visible ? 'Visible' : 'Oculto'}
                      </span>
                    </Badge>
                    {item.destacado && (
                      <Badge className="bg-black text-white hover:bg-black font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" />
                          Destacado
                        </span>
                      </Badge>
                    )}
                  </div>
                )
              },
              {
                key: 'reservas',
                label: 'Reservas',
                render: (item) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportReservas(item.id);
                    }}
                    className="h-8 px-2 text-sky-700 hover:text-sky-800 hover:bg-sky-50"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Exportar
                  </Button>
                )
              },
            ]}
            onItemsChange={(newItems) => {
              setPaquetes(newItems);
              fetchPaquetes(); // Recargar después de guardar
            }}
            onDelete={setDeleteId}
            editPath="/admin/paquetes"
            sort={sort}
            onSortChange={setSort}
          />
          
          {/* Paginación */}
          {paquetesFiltrados.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <AdminPagination
                currentPage={currentPage}
                totalItems={paquetesFiltrados.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemName="paquetes"
              />
            </div>
          )}
        </div>

        <AlertDialog
          open={!!duplicateId}
          onOpenChange={(open) => {
            if (!open && !duplicating) setDuplicateId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Duplicar paquete?</AlertDialogTitle>
              <AlertDialogDescription>
                {duplicateTarget
                  ? `Se va a crear una copia editable de "${duplicateTarget.titulo}".`
                  : 'Se va a crear una copia editable del paquete seleccionado con un nuevo identificador.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={duplicating}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDuplicate}
                disabled={duplicating || !canDuplicate}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                {duplicating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Duplicando...
                  </>
                ) : (
                  'Duplicar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={!!deleteId}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará el paquete permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}
