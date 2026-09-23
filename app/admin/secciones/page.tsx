'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, orderBy as firestoreOrderBy, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidateFrontPaths } from '@/lib/revalidate';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, RotateCcw, Trash2 } from 'lucide-react';

type TipoPaquete = 'paquete' | 'f1';
type TipoSeccion = TipoPaquete | 'subtitle';

interface SeccionItem {
  key: string;
  id: string;
  tipo: TipoSeccion;
  paqueteId?: string;
  titulo: string;
  categoriaId?: string;
  categoriaNombre?: string;
  etiqueta?: string;
  orden?: number;
  fechaCreacion?: Date;
}

interface Categoria {
  id: string;
  nombre: string;
}

function SortableRow({
  item,
  disabled,
  onSubtitleChange,
  onSubtitleDelete,
}: {
  item: SeccionItem;
  disabled: boolean;
  onSubtitleChange: (id: string, value: string) => void;
  onSubtitleDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className={`rounded-lg p-2 ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab hover:bg-gray-50'}`}
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {item.tipo === 'subtitle' ? (
            <Input
              value={item.titulo}
              onChange={(e) => onSubtitleChange(item.id, e.target.value)}
              className="h-8 text-sm font-medium"
              placeholder="Subtítulo"
            />
          ) : (
            <p className="font-medium truncate text-gray-900">{item.titulo}</p>
          )}
          <Badge variant="secondary" className="text-xs">
            {item.tipo === 'subtitle' ? 'Subtítulo' : item.tipo === 'f1' ? 'F1' : 'Paquete'}
          </Badge>
          {item.etiqueta && (
            <Badge className="bg-black text-white hover:bg-black text-xs">{item.etiqueta}</Badge>
          )}
        </div>
        {item.tipo !== 'subtitle' && (
          <p className="text-sm text-gray-500">{item.categoriaNombre || 'Sin clasificar'}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-400">#{item.orden || '-'}</div>
        {item.tipo === 'subtitle' && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onSubtitleDelete(item.id)}
            className="h-8 w-8 text-gray-500 hover:text-red-600"
            aria-label="Eliminar subtítulo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SeccionesPage() {
  const [items, setItems] = useState<SeccionItem[]>([]);
  const [originalItems, setOriginalItems] = useState<SeccionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoPaquete>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'orden' | 'titulo' | 'fecha'>('orden');
  const [newSubtitle, setNewSubtitle] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [categoriasSnap, paquetesSnap, paquetesF1Snap, seccionesSnap] = await Promise.all([
          getDocs(collection(db, 'categorias')),
          getDocs(query(collection(db, 'paquetes'), firestoreOrderBy('orden', 'asc'))),
          getDocs(query(collection(db, 'paquetes_f1'), firestoreOrderBy('orden', 'asc'))),
          getDocs(query(collection(db, 'secciones'), firestoreOrderBy('orden', 'asc'))),
        ]);

        const categorias = categoriasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
        const categoriasMap = new Map(categorias.map((cat) => [cat.id, cat.nombre]));

        const paquetesMap = new Map(
          paquetesSnap.docs.map((doc) => [
            doc.id,
            {
              id: doc.id,
              titulo: doc.data().titulo as string,
              categoriaId: doc.data().categoriaId as string | undefined,
              etiqueta: doc.data().etiqueta as string | undefined,
              fechaCreacion: doc.data().fechaCreacion?.toDate?.(),
              orden: doc.data().orden as number | undefined,
            },
          ])
        );

        const paquetesF1Map = new Map(
          paquetesF1Snap.docs.map((doc) => [
            doc.id,
            {
              id: doc.id,
              titulo: doc.data().titulo as string,
              categoriaId: doc.data().categoriaId as string | undefined,
              etiqueta: doc.data().etiqueta as string | undefined,
              fechaCreacion: doc.data().fechaCreacion?.toDate?.(),
              orden: doc.data().orden as number | undefined,
            },
          ])
        );

        const seccionesDocs = seccionesSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as { paqueteId?: string; tipo: TipoSeccion; orden: number; titulo?: string }),
        }));

        let merged: SeccionItem[] = [];

        if (seccionesDocs.length > 0) {
          const referenced = new Set(
            seccionesDocs
              .filter((item) => item.tipo !== 'subtitle')
              .map((item) => `${item.tipo}_${item.paqueteId || ''}`)
          );

          merged = seccionesDocs
            .sort((a, b) => (a.orden || 0) - (b.orden || 0))
            .reduce<SeccionItem[]>((acc, item) => {
              if (item.tipo === 'subtitle') {
                acc.push({
                  key: item.id,
                  id: item.id,
                  tipo: 'subtitle',
                  titulo: item.titulo || 'Subtítulo',
                  orden: item.orden,
                });
                return acc;
              }

              const source = item.tipo === 'f1' ? paquetesF1Map.get(item.paqueteId || '') : paquetesMap.get(item.paqueteId || '');
              if (!source) return acc;
              acc.push({
                key: `${item.tipo}_${source.id}`,
                id: source.id,
                paqueteId: source.id,
                tipo: item.tipo,
                titulo: source.titulo,
                categoriaId: source.categoriaId,
                categoriaNombre: source.categoriaId ? categoriasMap.get(source.categoriaId) : undefined,
                etiqueta: source.etiqueta,
                fechaCreacion: source.fechaCreacion,
                orden: item.orden,
              });
              return acc;
            }, []);

          const paquetesNoListados = Array.from(paquetesMap.values())
            .filter((item) => !referenced.has(`paquete_${item.id}`))
            .map((item, index) => ({
              key: `paquete_${item.id}`,
              id: item.id,
              paqueteId: item.id,
              tipo: 'paquete' as const,
              titulo: item.titulo,
              categoriaId: item.categoriaId,
              categoriaNombre: item.categoriaId ? categoriasMap.get(item.categoriaId) : undefined,
              etiqueta: item.etiqueta,
              fechaCreacion: item.fechaCreacion,
              orden: (merged[merged.length - 1]?.orden || merged.length) + index + 1,
            }));

          const f1NoListados = Array.from(paquetesF1Map.values())
            .filter((item) => !referenced.has(`f1_${item.id}`))
            .map((item, index) => ({
              key: `f1_${item.id}`,
              id: item.id,
              paqueteId: item.id,
              tipo: 'f1' as const,
              titulo: item.titulo,
              categoriaId: item.categoriaId,
              categoriaNombre: item.categoriaId ? categoriasMap.get(item.categoriaId) : undefined,
              etiqueta: item.etiqueta,
              fechaCreacion: item.fechaCreacion,
              orden: (merged[merged.length - 1]?.orden || merged.length) + paquetesNoListados.length + index + 1,
            }));

          merged = [...merged, ...paquetesNoListados, ...f1NoListados];
        } else {
          const paquetes = Array.from(paquetesMap.values()).map((item) => ({
            key: `paquete_${item.id}`,
            id: item.id,
            paqueteId: item.id,
            tipo: 'paquete' as const,
            titulo: item.titulo,
            categoriaId: item.categoriaId,
            categoriaNombre: item.categoriaId ? categoriasMap.get(item.categoriaId) : undefined,
            etiqueta: item.etiqueta,
            fechaCreacion: item.fechaCreacion,
            orden: item.orden,
          }));

          const paquetesF1 = Array.from(paquetesF1Map.values()).map((item) => ({
            key: `f1_${item.id}`,
            id: item.id,
            paqueteId: item.id,
            tipo: 'f1' as const,
            titulo: item.titulo,
            categoriaId: item.categoriaId,
            categoriaNombre: item.categoriaId ? categoriasMap.get(item.categoriaId) : undefined,
            etiqueta: item.etiqueta,
            fechaCreacion: item.fechaCreacion,
            orden: item.orden,
          }));

          merged = [...paquetes, ...paquetesF1]
            .map((item, index) => ({
              ...item,
              orden: item.orden ?? 9999 + index,
            }))
            .sort((a, b) => (a.orden || 0) - (b.orden || 0));
        }

        setItems(merged);
        setOriginalItems(merged);
      } catch (error) {
        console.error('Error fetching secciones:', error);
        toast.error('Error al cargar secciones');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const categoriasDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (item.categoriaId && item.categoriaNombre) {
        map.set(item.categoriaId, item.categoriaNombre);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [items]);

  const filteredItems = useMemo(() => {
    let data = [...items];
    if (tipoFiltro !== 'todos') {
      data = data.filter((item) => item.tipo === tipoFiltro);
    }
    if (categoriaFiltro !== 'todas') {
      data = data.filter((item) => item.categoriaId === categoriaFiltro);
    }
    if (etiquetaFiltro.trim()) {
      const term = etiquetaFiltro.trim().toLowerCase();
      data = data.filter((item) => (item.etiqueta || '').toLowerCase().includes(term));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      data = data.filter((item) => item.titulo.toLowerCase().includes(term));
    }

    const hasFilters =
      tipoFiltro !== 'todos' || categoriaFiltro !== 'todas' || etiquetaFiltro.trim() !== '' || searchTerm.trim() !== '';
    if (hasFilters) {
      data = data.filter((item) => item.tipo !== 'subtitle');
    }

    if (sortBy === 'titulo') {
      data.sort((a, b) => a.titulo.localeCompare(b.titulo));
    }
    if (sortBy === 'fecha') {
      data.sort((a, b) => (a.fechaCreacion?.getTime() || 0) - (b.fechaCreacion?.getTime() || 0));
    }
    if (sortBy === 'orden') {
      data.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    }
    return data;
  }, [items, tipoFiltro, categoriaFiltro, etiquetaFiltro, searchTerm, sortBy]);

  const canReorder =
    sortBy === 'orden' &&
    tipoFiltro === 'todos' &&
    categoriaFiltro === 'todas' &&
    etiquetaFiltro.trim() === '' &&
    searchTerm.trim() === '';

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((current) => {
        const oldIndex = current.findIndex((item) => item.key === active.id);
        const newIndex = current.findIndex((item) => item.key === over.id);
        return arrayMove(current, oldIndex, newIndex).map((item, index) => ({
          ...item,
          orden: index + 1,
        }));
      });
    }
  };

  const handleSave = async () => {
    if (!canReorder) {
      toast.error('Para ordenar, seleccioná "Orden" y limpiá los filtros');
      return;
    }
    setSaving(true);
    try {
      const batch = writeBatch(db);
      items.forEach((item, index) => {
        if (item.tipo === 'subtitle') {
          const ref = doc(db, 'secciones', item.id);
          batch.set(ref, {
            tipo: 'subtitle',
            titulo: item.titulo,
            orden: index + 1,
          });
          return;
        }

        const docId = `${item.tipo}_${item.id}`;
        const ref = doc(db, 'secciones', docId);
        batch.set(ref, {
          paqueteId: item.id,
          tipo: item.tipo,
          orden: index + 1,
        });
      });
      await batch.commit();
      await revalidateFrontPaths(['/']);
      setOriginalItems(items);
      toast.success('Orden guardado correctamente');
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error al guardar el orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(originalItems);
    toast.info('Orden restaurado');
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Secciones</h1>
            <p className="text-gray-600 mt-1">
              Ordená y filtrá los paquetes normales y F1 en un orden personalizado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-600">Tipo</label>
              <Select value={tipoFiltro} onValueChange={(value) => setTipoFiltro(value as typeof tipoFiltro)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="paquete">Paquetes</SelectItem>
                  <SelectItem value="f1">F1</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-600">Categoría</label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categoriasDisponibles.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-gray-600">Etiqueta</label>
              <Input
                className="mt-1"
                value={etiquetaFiltro}
                onChange={(e) => setEtiquetaFiltro(e.target.value)}
                placeholder="Ej: Premium"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Orden</label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orden">Orden personalizado</SelectItem>
                  <SelectItem value="titulo">Título</SelectItem>
                  <SelectItem value="fecha">Fecha creación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Input
                placeholder="Buscar por título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Input
                placeholder='Nuevo subtítulo (ej: "Paquetes" o "F1")'
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const value = newSubtitle.trim();
                  if (!value) return;
                  const id = `subtitle_${Date.now()}`;
          const next = [
                    ...items,
                    {
                      key: id,
                      id,
                      tipo: 'subtitle' as const,
                      titulo: value,
                      orden: items.length + 1,
                    },
                  ];
                  setItems(next);
                  setNewSubtitle('');
                }}
              >
                Agregar subtítulo
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="text-white [&_svg]:text-white">
              <Save className="mr-2 h-4 w-4" />
              Guardar orden
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
            {!canReorder && (
              <span className="text-sm text-amber-600">
                Para ordenar, limpiá filtros y seleccioná “Orden personalizado”.
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`filter-skel-${i}`} className="space-y-2">
                    <div className="h-4 w-20 bg-gray-200 rounded-md animate-pulse" />
                    <div className="h-9 w-full bg-gray-200 rounded-xl animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`search-skel-${i}`} className="h-9 w-full bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-5 w-64 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`row-skel-${i}`}
                    className="h-16 rounded-xl border border-gray-200 bg-white shadow-sm animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredItems.map((item) => item.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <SortableRow
                      key={item.key}
                      item={item}
                      disabled={!canReorder}
                      onSubtitleChange={(id, value) => {
                        setItems((current) =>
                          current.map((entry) =>
                            entry.id === id && entry.tipo === 'subtitle'
                              ? { ...entry, titulo: value }
                              : entry
                          )
                        );
                      }}
                      onSubtitleDelete={(id) => {
                        setItems((current) => current.filter((entry) => entry.id !== id));
                        const existed = originalItems.some((entry) => entry.id === id && entry.tipo === 'subtitle');
                        if (existed) {
                          deleteDoc(doc(db, 'secciones', id)).catch((error) => {
                            console.error('Error deleting subtitle:', error);
                            toast.error('No pudimos eliminar el subtítulo');
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
