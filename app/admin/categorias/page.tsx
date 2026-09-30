'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, orderBy, query, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Categoria } from '@/types';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Search, X, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import DragDropTable from '@/components/admin/DragDropTable';
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

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc'; mode: 'default' | 'custom' }>({
    key: 'orden',
    direction: 'asc',
    mode: 'default',
  });

  const fetchCategorias = async () => {
    try {
      const q = query(collection(db, 'categorias'), orderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
      setCategorias(data);
    } catch (error) {
      console.error('Error fetching categorias:', error);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const categoriaDoc = await getDoc(doc(db, 'categorias', deleteId));
      if (categoriaDoc.exists()) {
        const categoriaData = categoriaDoc.data() as Categoria;
        const keysToDelete = new Set<string>();
        if (categoriaData.imagenKey) keysToDelete.add(categoriaData.imagenKey);
        const fallbackKey = getBlobKeyFromUrl(categoriaData.imagen);
        if (fallbackKey) keysToDelete.add(fallbackKey);

        if (keysToDelete.size > 0) {
          toast.info('Eliminando imágenes...', { id: 'delete-images' });
          const deletions = Array.from(keysToDelete);
          const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
          results.forEach((result, idx) => {
            if (result.status === 'rejected') {
              console.error('[categorias] error borrando archivo:', deletions[idx], result.reason);
            }
          });
          const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
          if (deletedCount > 0) {
            toast.success(`${deletedCount} imágenes eliminadas de R2`, { id: 'delete-images' });
            toast.dismiss('delete-images');
          } else {
            toast.warning('Categoría eliminada, pero hubo errores al eliminar las imágenes', { id: 'delete-images' });
          }
        }
      }

      await deleteDoc(doc(db, 'categorias', deleteId));
      toast.success('Categoría eliminada correctamente');
      fetchCategorias();
    } catch (error) {
      console.error('Error deleting categoria:', error);
      toast.error('Error al eliminar categoría');
    } finally {
      setDeleteId(null);
    }
  };

  // Filtrar categorías por búsqueda
  const categoriasFiltradas = useMemo(() => {
    if (!searchTerm.trim()) return categorias;
    
    const searchLower = searchTerm.toLowerCase().trim();
    return categorias.filter(categoria =>
      categoria.nombre.toLowerCase().includes(searchLower) ||
      categoria.slug.toLowerCase().includes(searchLower) ||
      categoria.descripcion.toLowerCase().includes(searchLower)
    );
  }, [categorias, searchTerm]);

  const categoriasOrdenadas = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = sort.key;
    const copy = [...categoriasFiltradas];

    copy.sort((a, b) => {
      const aVal =
        key === 'orden'
          ? (a.orden ?? 0)
          : key === 'nombre'
            ? (a.nombre ?? '')
            : key === 'slug'
              ? (a.slug ?? '')
              : key === 'estado'
                ? (a.activa ? 1 : 0)
                : key === 'destacada'
                  ? (a.destacada ? 1 : 0)
                  : '';

      const bVal =
        key === 'orden'
          ? (b.orden ?? 0)
          : key === 'nombre'
            ? (b.nombre ?? '')
            : key === 'slug'
              ? (b.slug ?? '')
              : key === 'estado'
                ? (b.activa ? 1 : 0)
                : key === 'destacada'
                  ? (b.destacada ? 1 : 0)
                  : '';

      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' }) * dir;
    });

    return copy;
  }, [categoriasFiltradas, sort.direction, sort.key]);

  // Paginación
  const categoriasPaginadas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return categoriasOrdenadas.slice(startIndex, endIndex);
  }, [categoriasOrdenadas, currentPage, itemsPerPage]);

  // Resetear página cuando cambie la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`cat-row-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
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
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Categorías</h1>
              <p className="mt-1 text-sm text-gray-600">Gestiona las categorías de viajes</p>
            </div>
            <Button asChild className="bg-black hover:bg-gray-800 text-white">
              <Link href="/admin/categorias/nueva">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Categoría
              </Link>
            </Button>
          </div>

          {/* Búsqueda */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, slug o descripción..."
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
            items={categoriasPaginadas}
            collectionName="categorias"
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
                key: 'nombre',
                label: 'Nombre',
                sortable: true,
                render: (item) => <span className="font-medium text-gray-900">{item.nombre}</span>
              },
              {
                key: 'slug',
                label: 'Slug',
                sortable: true,
                render: (item) => <span className="text-gray-500 font-mono">{item.slug}</span>
              },
              {
                key: 'estado',
                label: 'Estado',
                sortable: true,
                render: (item) => (
                  <Badge 
                    variant={item.activa ? 'default' : 'secondary'}
                    className={item.activa ? 'bg-green-100 text-green-800 hover:bg-green-100 font-medium' : 'font-medium'}
                  >
                    {item.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                )
              },
              {
                key: 'destacada',
                label: 'Destacada',
                sortable: true,
                render: (item) => item.destacada ? (
                  <Badge className="bg-black text-white hover:bg-black font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      Destacada
                    </span>
                  </Badge>
                ) : (
                  <span className="text-gray-400">-</span>
                )
              },
            ]}
            onItemsChange={(newItems) => {
              setCategorias(newItems);
              fetchCategorias(); // Recargar después de guardar
            }}
            onDelete={setDeleteId}
            editPath="/admin/categorias"
            sort={sort}
            onSortChange={setSort}
          />
          
          {/* Paginación */}
          {categoriasFiltradas.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <AdminPagination
                currentPage={currentPage}
                totalItems={categoriasFiltradas.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemName="categorías"
              />
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará la categoría permanentemente.
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
