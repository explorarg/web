"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  writeBatch,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { revalidateFrontPaths } from '@/lib/revalidate';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { db } from '@/lib/firebase';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { GripVertical, Loader2, Save, Trash2, Plus, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface BannerItem {
  id: string;
  imageUrl: string;
  orden: number;
  activa: boolean;
  target?: 'home' | 'blog' | 'both';
  imageKey?: string;
}

function SortableBanner({ banner, index }: { banner: BannerItem; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-1 items-center gap-4"
      {...attributes}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F9FAFB] text-base font-semibold text-primary">
          {index + 1}
        </div>
        <button
          type="button"
          className="text-[#4B5563] hover:text-primary"
          {...listeners}
          aria-label="Reordenar banner"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </div>
      <div className="relative h-16 w-28 overflow-hidden rounded-xl border border-secondary/40 bg-[#F9FAFB]">
        <Image
          src={banner.imageUrl}
          alt={`Banner ${index + 1}`}
          fill
          className="object-cover"
        />
      </div>
      <div className="ml-auto flex items-center gap-4" />
    </div>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [originalBanners, setOriginalBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [targetFilter, setTargetFilter] = useState<'all' | 'home'>('all');

  const hasChanges = useMemo(() => {
    if (banners.length !== originalBanners.length) return true;
    return banners.some((banner, index) => banner.id !== originalBanners[index]?.id);
  }, [banners, originalBanners]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'banners'), firestoreOrderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => {
        const bannerData = docSnap.data() as Omit<BannerItem, 'id'> & { imageKey?: string };
        return {
          id: docSnap.id,
          imageKey: bannerData.imageKey,
          imageUrl: bannerData.imageUrl,
          orden: bannerData.orden,
          activa: bannerData.activa,
          target: bannerData.target,
        };
      });
      setBanners(data);
      setOriginalBanners(data);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('No pudimos cargar los banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    if (targetFilter !== 'all') return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = banners.findIndex((item) => item.id === active.id);
    const newIndex = banners.findIndex((item) => item.id === over.id);

    setBanners(arrayMove(banners, oldIndex, newIndex));
  };

  const handleSaveOrder = async () => {
    if (targetFilter !== 'all') return;
    try {
      setSavingOrder(true);
      const batch = writeBatch(db);

      banners.forEach((banner, index) => {
        const ref = doc(db, 'banners', banner.id);
        batch.update(ref, { orden: index + 1 });
      });

      await batch.commit();
      await revalidateFrontPaths(['/']);
      toast.success('Orden actualizado');
      setOriginalBanners(banners);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('No pudimos guardar el orden');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleToggleActive = async (banner: BannerItem) => {
    try {
      await updateDoc(doc(db, 'banners', banner.id), { activa: !banner.activa });
      await revalidateFrontPaths(['/']);
      setBanners((prev) =>
        prev.map((item) =>
          item.id === banner.id ? { ...item, activa: !item.activa } : item
        )
      );
      setOriginalBanners((prev) =>
        prev.map((item) =>
          item.id === banner.id ? { ...item, activa: !item.activa } : item
        )
      );
    } catch (error) {
      console.error('Error updating banner:', error);
      toast.error('No pudimos actualizar el estado');
    }
  };

  const handleDelete = async (bannerId: string) => {
    if (!confirm('¿Eliminar este banner?')) return;
    try {
      const banner = banners.find((item) => item.id === bannerId);
      if (banner) {
        const keysToDelete = new Set<string>();
        if (banner.imageKey) keysToDelete.add(banner.imageKey);
        const fallbackKey = getBlobKeyFromUrl(banner.imageUrl);
        if (fallbackKey) keysToDelete.add(fallbackKey);
        if (keysToDelete.size > 0) {
          toast.info('Eliminando imágenes...', { id: 'delete-images' });
          const deletions = Array.from(keysToDelete);
          const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
          results.forEach((result, idx) => {
            if (result.status === 'rejected') {
              console.error('[banners] error borrando archivo:', deletions[idx], result.reason);
            }
          });
          const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
          if (deletedCount > 0) {
            toast.success(`${deletedCount} imágenes eliminadas de R2`, { id: 'delete-images' });
            toast.dismiss('delete-images');
          } else {
            toast.warning('Banner eliminado, pero hubo errores al eliminar la imagen', { id: 'delete-images' });
          }
        }
      }
      await deleteDoc(doc(db, 'banners', bannerId));
      await revalidateFrontPaths(['/']);
      toast.success('Banner eliminado');
      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('No pudimos eliminar el banner');
    }
  };

  const filteredBanners =
    targetFilter === 'all'
      ? banners
      : banners.filter((banner) => {
          const target = banner.target || 'home';
          return target === 'home' || target === 'both';
        });

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Banners</h1>
              <p className="text-gray-600 mt-1">
                Administrá los banners activos y el orden de aparición. Modelo recomendado: 1920 x 500 px.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-gray-200 p-1 text-xs">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'home', label: 'Home' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTargetFilter(item.value as 'all' | 'home')}
                    className={`rounded-full px-3 py-1 font-semibold transition ${
                      targetFilter === item.value ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button asChild className="bg-black hover:bg-gray-800 text-white">
                <Link href="/admin/banners/nuevo">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo banner
                </Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Orden de banners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-base text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando banners...
                </div>
              ) : filteredBanners.length === 0 ? (
                <p className="text-base text-gray-500">Todavía no hay banners.</p>
              ) : (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={filteredBanners} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {filteredBanners.map((banner, index) => (
                          <div
                            key={banner.id}
                            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-lg"
                          >
                            <SortableBanner banner={banner} index={index} />
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="border-gray-200 text-gray-600">
                                Home
                              </Badge>
                              <Badge
                                variant="outline"
                                className={banner.activa ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
                              >
                                {banner.activa ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Activo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Inactivo
                                  </span>
                                )}
                              </Badge>
                              <Switch
                                checked={banner.activa}
                                onCheckedChange={() => handleToggleActive(banner)}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDelete(banner.id)}
                                className="hover:bg-red-50 hover:border-red-200 text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveOrder} disabled={!hasChanges || savingOrder || targetFilter !== 'all'}>
                      {savingOrder ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Guardar orden
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
