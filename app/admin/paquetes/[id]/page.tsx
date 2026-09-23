'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { slugify } from '@/lib/utils/slugify';
import { revalidateFrontPaths } from '@/lib/revalidate';
import type { Paquete, Categoria } from '@/types';
import PackageForm from '@/components/admin/PackageForm';
import { usePackageEditorState } from '@/components/admin/usePackageEditorState';
import { countFeaturedPackages, fetchActiveCategorias } from '@/lib/packages/admin-queries';
import {
  DEFAULT_CONDICIONES,
  buildPackageAdminPayload,
  dataURLtoFile,
  getInvalidPackageSalidasSummary,
  hasValidPackageSalida,
  normalizePackageCategoryIds,
  packageAdminDefaultValues,
  packageAdminFormSchema,
  type PackageAdminFormData,
} from '@/lib/packages/admin-form';
import { isPaqueteTitleTaken } from '@/lib/paquetes';

export default function EditarPaquetePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [destacadosCount, setDestacadosCount] = useState(0);
  const [wasDestacado, setWasDestacado] = useState(false);
  const router = useRouter();
  const defaultCondiciones = useMemo(() => DEFAULT_CONDICIONES.map((item) => ({ ...item })), []);
  const editor = usePackageEditorState({ defaultCondiciones });
  const hydrateFromPackage = editor.hydrateFromPackage;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<PackageAdminFormData>({
    resolver: zodResolver(packageAdminFormSchema),
    defaultValues: packageAdminDefaultValues,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catData, destacadosOtros] = await Promise.all([fetchActiveCategorias(), countFeaturedPackages(id)]);
        setCategorias(catData);
        setDestacadosCount(destacadosOtros);

        // Cargar paquete
        const docRef = doc(db, 'paquetes', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Paquete;
          setWasDestacado(data.destacado); // Guardar estado original
          setValue('titulo', data.titulo);
          setValue('descripcion', data.descripcion);
          setValue('descripcionCorta', data.descripcionCorta || '');
          setValue('etiqueta', data.etiqueta || '');
          setValue('categoriaIds', normalizePackageCategoryIds(data.categoriaIds ?? [], data.categoriaId ?? null));
          setValue('tipos', (data.tipos ?? [data.tipo]) as PackageAdminFormData['tipos']);
          setValue('precio', data.precio);
          setValue(
            'gastosAdministrativos',
            typeof (data as any).gastosAdministrativos === 'number'
              ? (data as any).gastosAdministrativos
              : (data as any).precioDescuentoPrimerosCupos ?? 0
          );
          setValue('moneda', 'ARS');
          setValue('mostrarDesde', data.mostrarDesde ?? true); // Default true para retrocompatibilidad
          setValue('duracion', data.duracion);
          setValue('capacidadMaxima', typeof data.capacidadMaxima === 'number' ? data.capacidadMaxima : 0);
          setValue('minPassengers', typeof (data as any).minPassengers === 'number' ? Number((data as any).minPassengers) : 1);
          setValue('maxPassengers', typeof (data as any).maxPassengers === 'number' ? Number((data as any).maxPassengers) : 40);
          setValue('cancellationPolicy', String((data as any).cancellationPolicy ?? 'moderada'));
          setValue('travelRequirements', String((data as any).travelRequirements ?? ''));
          setValue('adminNotes', String((data as any).adminNotes ?? ''));
          setValue('transportCompany', String((data as any).transportCompany ?? ''));
          setValue('transportOrigin', String((data as any).transportOrigin ?? ''));
          setValue('transportDestination', String((data as any).transportDestination ?? ''));
          setValue('visible', data.visible);
          setValue('destacado', data.destacado);
          setValue('ctaWhatsApp', data.ctaWhatsApp);
          hydrateFromPackage(data, { getBlobKeyFromUrl });
        } else {
          toast.error('Paquete no encontrado');
          router.push('/admin/paquetes');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hydrateFromPackage, id, router, setValue]);

  const onSubmit = async (data: PackageAdminFormData) => {
    if (!hasValidPackageSalida(editor.salidas)) {
      toast.error('Debes cargar al menos una salida con fecha válida');
      return;
    }
    const invalidSalidas = getInvalidPackageSalidasSummary(editor.salidas);
    if (invalidSalidas.invalidCount > 0) {
      toast.error('Hay salidas incompletas o inválidas', {
        description: invalidSalidas.reasons.slice(0, 3).join(' · ') + (invalidSalidas.invalidCount > 3 ? '…' : ''),
      });
      return;
    }

    if (editor.imagenTarjetaPreview.length === 0 || editor.imagenPortadaPreview.length === 0) {
      toast.error('Debes agregar imagen de tarjeta y de portada');
      return;
    }
    if (editor.seatSelectionEnabled && !editor.seatLayoutId.trim()) {
      toast.error('Activaste butacas por defecto pero falta elegir la plantilla global del paquete');
      return;
    }

    // Check for unique title
    const titleTaken = await isPaqueteTitleTaken(data.titulo, id);
    if (titleTaken) {
      toast.error('Ya existe un paquete con este título');
      return;
    }

    setSaving(true);
    try {
      const isDataUrl = (value: string) => value.startsWith('data:');
      const cardPreview = editor.imagenTarjetaPreview[0] ?? '';
      const coverPreview = editor.imagenPortadaPreview[0] ?? '';

      const finalCard = {
        url: cardPreview,
        key: editor.imagenTarjetaKey || getBlobKeyFromUrl(cardPreview) || '',
      };
      if (isDataUrl(cardPreview)) {
        toast.info('Subiendo imagen de tarjeta...', { id: 'upload-card' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(cardPreview, `paquete-card-${Date.now()}.jpg`),
        ]);
        finalCard.url = result.url;
        finalCard.key = result.key;
        const keyToDelete = editor.originalImagenTarjetaKey ?? getBlobKeyFromUrl(editor.imagenTarjetaOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[paquetes] error borrando imagen de tarjeta:', error);
          });
        }
        toast.success('Imagen de tarjeta actualizada', { id: 'upload-card' });
      }

      const finalCover = {
        url: coverPreview,
        key: editor.imagenPortadaKey || getBlobKeyFromUrl(coverPreview) || '',
      };
      if (isDataUrl(coverPreview)) {
        toast.info('Subiendo imagen de portada...', { id: 'upload-cover' });
        const [result] = await uploadMultipleImages([
          dataURLtoFile(coverPreview, `paquete-cover-${Date.now()}.jpg`),
        ]);
        finalCover.url = result.url;
        finalCover.key = result.key;
        const keyToDelete = editor.originalImagenPortadaKey ?? getBlobKeyFromUrl(editor.imagenPortadaOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[paquetes] error borrando imagen de portada:', error);
          });
        }
        toast.success('Imagen de portada actualizada', { id: 'upload-cover' });
      }

      let uploadedGalleryResults: { url: string; key: string }[] = [];
      const dataUrlGaleria = editor.galleryAssets.filter((asset) => isDataUrl(asset.url));
      if (dataUrlGaleria.length > 0) {
        toast.info('Subiendo imágenes de galería...', { id: 'upload-gal' });
        const files = dataUrlGaleria.map((asset, index) =>
          dataURLtoFile(asset.url, `paquete-gallery-${Date.now()}-${index}.jpg`)
        );
        uploadedGalleryResults = await uploadMultipleImages(files);
        toast.success('Galería actualizada', { id: 'upload-gal' });
      }

      const finalGalleryAssets = editor.galleryAssets.map((asset) => {
        if (isDataUrl(asset.url)) {
          const nextResult = uploadedGalleryResults.shift();
          if (!nextResult) {
            return { url: asset.url, key: asset.key ?? '' };
          }
          return { url: nextResult.url, key: nextResult.key };
        }
        const key = asset.key ?? getBlobKeyFromUrl(asset.url) ?? '';
        return { url: asset.url, key };
      });

      const galeriaUrls = finalGalleryAssets.map((asset) => asset.url);
      const galeriaKeys = finalGalleryAssets.map((asset) => asset.key);

      const keysToDelete = new Set<string>();
      if (editor.originalImagenTarjetaKey && finalCard.key && editor.originalImagenTarjetaKey !== finalCard.key) {
        keysToDelete.add(editor.originalImagenTarjetaKey);
      }
      if (editor.originalImagenPortadaKey && finalCover.key && editor.originalImagenPortadaKey !== finalCover.key) {
        keysToDelete.add(editor.originalImagenPortadaKey);
      }
      const finalGalleryKeySet = new Set(galeriaKeys.filter((key): key is string => Boolean(key)));
      editor.originalGaleriaKeys.forEach((key) => {
        if (key && !finalGalleryKeySet.has(key)) {
          keysToDelete.add(key);
        }
      });

      if (keysToDelete.size > 0) {
        const deletions = Array.from(keysToDelete);
        const results = await Promise.allSettled(deletions.map((key) => deleteBlobByKey(key)));
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            console.error('[paquetes] error borrando blob:', deletions[idx], result.reason);
          }
        });
      }

      const slug = slugify(data.titulo);

      const fixedSalidas = editor.salidas.map((salida) => {
        const enabled = Boolean((salida as any)?.seatSelectionEnabled);
        const layoutId = String((salida as any)?.seatLayoutId ?? '').trim();
        if (enabled && !layoutId && editor.seatLayoutId.trim()) {
          return { ...(salida as any), seatLayoutId: editor.seatLayoutId.trim() } as any;
        }
        return salida;
      });
      const fixedInvalidSeats = fixedSalidas.some((salida) => Boolean((salida as any)?.seatSelectionEnabled) && !String((salida as any)?.seatLayoutId ?? '').trim());
      if (fixedInvalidSeats) {
        toast.error('Hay salidas con butacas activas pero sin plantilla asignada');
        return;
      }

      const sanitizedData = {
        slug,
        ...buildPackageAdminPayload({
          data,
          categorias,
          includeItems: editor.includeItems,
          selectedTransportes: editor.selectedTransportes,
          tagItems: editor.tagItems,
          noIncludeItems: editor.noIncludeItems,
          extrasOpcionales: editor.extrasOpcionales,
          condicionesItems: editor.condicionesItems,
          itineraryItems: editor.itineraryItems,
          salidas: fixedSalidas,
          pickupPoints: editor.pickupPoints,
          seatSelectionEnabled: editor.seatSelectionEnabled,
          seatLayoutId: editor.seatLayoutId,
          transportCompany: editor.transportCompany,
          transportOrigin: editor.transportOrigin,
          transportDestination: editor.transportDestination,
          fechaVencimiento: editor.fechaVencimiento,
          reservationPricing: editor.reservationPricing,
          roomTypes: editor.roomTypes,
          roomTypeOptions: editor.roomTypeOptions,
          imageData: {
            imagenPrincipal: finalCard.url,
            imagenPrincipalKey: finalCard.key,
            imagenTarjeta: finalCard.url,
            imagenTarjetaKey: finalCard.key,
            imagenPortada: finalCover.url,
            imagenPortadaKey: finalCover.key,
            galeria: galeriaUrls,
            galeriaKeys,
          },
        }),
      };

      await updateDoc(doc(db, 'paquetes', id), sanitizedData);
      const slugNew = slugify(data.titulo);
      await revalidateFrontPaths(['/paquetes', `/paquete/${slugNew}`]);

      toast.success('Paquete actualizado correctamente');
      router.push('/admin/paquetes');
    } catch (error) {
      console.error('Error updating paquete:', error);
      toast.error('Error al actualizar paquete');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <form onSubmit={handleSubmit(onSubmit)}>
          <PackageForm
            mode="edit"
            categorias={categorias}
            register={register}
            control={control}
            watch={watch}
            setValue={setValue}
            errors={errors}
            includeItems={editor.includeItems}
            onIncludeItemsChange={editor.setIncludeItems}
            selectedTransportes={editor.selectedTransportes}
            onSelectedTransportesChange={editor.setSelectedTransportes}
            tagItems={editor.tagItems}
            onTagItemsChange={editor.setTagItems}
            noIncludeItems={editor.noIncludeItems}
            onNoIncludeItemsChange={editor.setNoIncludeItems}
            extrasOpcionales={editor.extrasOpcionales}
            onExtrasOpcionalesChange={editor.setExtrasOpcionales}
            condicionesItems={editor.condicionesItems}
            onCondicionesItemsChange={editor.setCondicionesItems}
            itineraryItems={editor.itineraryItems}
            onItineraryItemsChange={editor.setItineraryItems}
            salidas={editor.salidas}
            onSalidasChange={editor.setSalidas}
            pickupPoints={editor.pickupPoints}
            onPickupPointsChange={editor.setPickupPoints}
            seatSelectionEnabled={editor.seatSelectionEnabled}
            onSeatSelectionEnabledChange={editor.setSeatSelectionEnabled}
            seatLayoutId={editor.seatLayoutId}
            onSeatLayoutIdChange={editor.setSeatLayoutId}
            transportCompany={editor.transportCompany}
            onTransportCompanyChange={editor.setTransportCompany}
            transportOrigin={editor.transportOrigin}
            onTransportOriginChange={editor.setTransportOrigin}
            transportDestination={editor.transportDestination}
            onTransportDestinationChange={editor.setTransportDestination}
            fechaVencimiento={editor.fechaVencimiento}
            onFechaVencimientoChange={editor.setFechaVencimiento}
            reservationPricing={editor.reservationPricing}
            onReservationPricingChange={editor.setReservationPricing}
            roomTypes={editor.roomTypes}
            onRoomTypesChange={editor.setRoomTypes}
            roomTypeOptions={editor.roomTypeOptions}
            onRoomTypeOptionsChange={editor.setRoomTypeOptions}
            imagenTarjetaPreview={editor.imagenTarjetaPreview}
            onImagenTarjetaChange={editor.handleImagenTarjetaChange}
            imagenPortadaPreview={editor.imagenPortadaPreview}
            onImagenPortadaChange={editor.handleImagenPortadaChange}
            galeriaPreview={editor.galeriaPreview}
            onGaleriaChange={editor.handleGaleriaChange}
            destacadosCount={destacadosCount}
            wasDestacado={wasDestacado}
            currentId={id}
            loading={saving}
            title="Editar Paquete"
            subtitle="Modifica la informacion del paquete"
            submitLabel="Guardar Cambios"
            submittingLabel="Guardando..."
          />
        </form>
      </AdminLayout>
    </ProtectedRoute>
  );
}
