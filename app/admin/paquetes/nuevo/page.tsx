'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, Timestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils/slugify';
import { revalidateFrontPaths } from '@/lib/revalidate';
import type { Categoria } from '@/types';
import PackageForm from '@/components/admin/PackageForm';
import { usePackageEditorState } from '@/components/admin/usePackageEditorState';
import { countFeaturedPackages, fetchActiveCategorias } from '@/lib/packages/admin-queries';
import {
  DEFAULT_CONDICIONES,
  buildPackageAdminPayload,
  dataURLtoFile,
  getInvalidPackageSalidasSummary,
  hasValidPackageSalida,
  packageAdminDefaultValues,
  packageAdminFormSchema,
  type PackageAdminFormData,
} from '@/lib/packages/admin-form';
import { isPaqueteTitleTaken } from '@/lib/paquetes';

export default function NuevoPaquetePage() {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [destacadosCount, setDestacadosCount] = useState(0);
  const [selectedDestacadoPosition, setSelectedDestacadoPosition] = useState<number | null>(null);
  const router = useRouter();
  const defaultCondiciones = useMemo(() => DEFAULT_CONDICIONES.map((item) => ({ ...item })), []);
  const editor = usePackageEditorState({ defaultCondiciones });

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

  // Cargar categorías y contar destacados
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasData, destacados] = await Promise.all([fetchActiveCategorias(), countFeaturedPackages()]);
        setCategorias(categoriasData);
        setDestacadosCount(destacados);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar datos');
      }
    };

    fetchData();
  }, []);

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
    const titleTaken = await isPaqueteTitleTaken(data.titulo);
    if (titleTaken) {
      toast.error('Ya existe un paquete con este título');
      return;
    }

    setLoading(true);
    try {
      // Convertir previews a archivos y subir
      const cardFiles = editor.imagenTarjetaPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-card-${Date.now()}-${index}.jpg`)
      );
      const coverFiles = editor.imagenPortadaPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-cover-${Date.now()}-${index}.jpg`)
      );
      const galleryFiles = editor.galeriaPreview.map((preview, index) =>
        dataURLtoFile(preview, `paquete-gallery-${Date.now()}-${index}.jpg`)
      );

      toast.info('Subiendo imágenes...', { id: 'upload' });
      const [imagenTarjetaResult] = await uploadMultipleImages(cardFiles);
      const [imagenPortadaResult] = await uploadMultipleImages(coverFiles);
      const galeriaResults = galleryFiles.length > 0 ? await uploadMultipleImages(galleryFiles) : [];
      const imagenTarjetaUrl = imagenTarjetaResult.url;
      const imagenTarjetaKey = imagenTarjetaResult.key;
      const imagenPortadaUrl = imagenPortadaResult.url;
      const imagenPortadaKey = imagenPortadaResult.key;
      const galeriaUrls = galeriaResults.length > 0 ? galeriaResults.map((item) => item.url) : [];
      const galeriaKeys = galeriaResults.length > 0 ? galeriaResults.map((item) => item.key) : [];
      toast.success('Imágenes subidas correctamente', { id: 'upload' });

      const slug = slugify(data.titulo);

      // Determinar el orden a usar
      let nuevoOrden: number;
      
      if (data.destacado && selectedDestacadoPosition !== null) {
        // Usar posición elegida para destacados
        nuevoOrden = selectedDestacadoPosition;
        
        // Actualizar órdenes de paquetes destacados existentes
        const paquetesSnapshot = await getDocs(collection(db, 'paquetes'));
        const paquetesData = paquetesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          } as { id: string; orden: number; destacado?: boolean }))
          .filter(p => p.destacado === true); // Solo destacados
        
        const batch = writeBatch(db);
        
        paquetesData.forEach((paquete) => {
          if (paquete.orden >= nuevoOrden) {
            batch.update(doc(db, 'paquetes', paquete.id), {
              orden: paquete.orden + 1
            });
          }
        });
        
        await batch.commit();
      } else {
        // Orden por defecto (al final)
        const paquetesSnapshot = await getDocs(collection(db, 'paquetes'));
        const maxOrden = paquetesSnapshot.docs.length > 0 
          ? Math.max(...paquetesSnapshot.docs.map(doc => (doc.data().orden || 0))) 
          : 0;
        nuevoOrden = maxOrden + 1;
      }

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
            imagenPrincipal: imagenTarjetaUrl,
            imagenPrincipalKey: imagenTarjetaKey,
            imagenTarjeta: imagenTarjetaUrl,
            imagenTarjetaKey,
            imagenPortada: imagenPortadaUrl,
            imagenPortadaKey,
            galeria: galeriaUrls,
            galeriaKeys,
          },
          extra: {
            orden: nuevoOrden,
            fechaCreacion: Timestamp.now(),
          },
        }),
      };

      await addDoc(collection(db, 'paquetes'), sanitizedData);
      await revalidateFrontPaths(['/paquetes', `/paquete/${slug}`]);

      toast.success('✅ Paquete creado correctamente', {
        description: 'Puedes reordenarlo arrastrando desde la lista principal',
      });
      router.push('/admin/paquetes');
    } catch (error) {
      console.error('Error creating paquete:', error);
      toast.error('Error al crear paquete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto space-y-6 pb-12">
          <form onSubmit={handleSubmit(onSubmit)}>
            <PackageForm
              mode="create"
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
              onImagenTarjetaChange={editor.setImagenTarjetaPreview}
              imagenPortadaPreview={editor.imagenPortadaPreview}
              onImagenPortadaChange={editor.setImagenPortadaPreview}
              galeriaPreview={editor.galeriaPreview}
              onGaleriaChange={editor.setGaleriaPreview}
              destacadosCount={destacadosCount}
              selectedDestacadoPosition={selectedDestacadoPosition}
              onSelectedDestacadoPositionChange={setSelectedDestacadoPosition}
              loading={loading}
              title="Nuevo Paquete"
              subtitle="Crea un nuevo paquete turistico"
              submitLabel="Crear Paquete"
              submittingLabel="Creando..."
            />
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
