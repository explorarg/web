'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { revalidateFrontPaths } from '@/lib/revalidate';
import { db } from '@/lib/firebase';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { deleteBlobByKey, getBlobKeyFromUrl } from '@/lib/utils/blob';
import { Categoria } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { slugify } from '@/lib/utils/slugify';
import ImageUploader from '@/components/admin/ImageUploader';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  destacada: z.boolean(),
  activa: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export default function EditarCategoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagenPreview, setImagenPreview] = useState<string[]>([]);
  const [imagenOriginal, setImagenOriginal] = useState<string>('');
  const [imagenKey, setImagenKey] = useState<string>('');
  const [originalImagenKey, setOriginalImagenKey] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const destacada = watch('destacada');
  const activa = watch('activa');

  useEffect(() => {
    const fetchCategoria = async () => {
      try {
        const docRef = doc(db, 'categorias', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Categoria;
          setValue('nombre', data.nombre);
          setValue('descripcion', data.descripcion);
          setValue('destacada', data.destacada);
          setValue('activa', data.activa);
          if (data.imagen) {
            setImagenOriginal(data.imagen);
            setImagenPreview([data.imagen]);
            const derivedKey = data.imagenKey ?? getBlobKeyFromUrl(data.imagen);
            setImagenKey(derivedKey ?? '');
            setOriginalImagenKey(derivedKey ?? null);
          } else {
            setImagenKey('');
            setOriginalImagenKey(null);
          }
        } else {
          toast.error('Categoría no encontrada');
          router.push('/admin/categorias');
        }
      } catch (error) {
        console.error('Error fetching categoria:', error);
        toast.error('Error al cargar categoría');
      } finally {
        setLoading(false);
      }
    };

    fetchCategoria();
  }, [id, router, setValue]);

  const onSubmit = async (data: FormData) => {
    if (imagenPreview.length === 0) {
      toast.error('Debes agregar una imagen de portada');
      return;
    }

    setSaving(true);
    try {
      let imagenUrl = imagenOriginal;
      let imagenKeyToSave = imagenKey;
      const imagenCambio = imagenPreview[0] !== imagenOriginal;

      if (imagenCambio) {
        toast.info('Subiendo nueva imagen...', { id: 'upload' });
        const files = imagenPreview.map((preview, index) =>
          fetch(preview)
            .then((res) => res.blob())
            .then((blob) => new File([blob], `categoria-${Date.now()}-${index}.jpg`, { type: 'image/jpeg' }))
        );
        const resolvedFiles = await Promise.all(files);
        const [uploaded] = await uploadMultipleImages(resolvedFiles);
        imagenUrl = uploaded.url;
        imagenKeyToSave = uploaded.key;
        const keyToDelete = originalImagenKey ?? getBlobKeyFromUrl(imagenOriginal);
        if (keyToDelete) {
          await deleteBlobByKey(keyToDelete).catch((error) => {
            console.error('[categorias] error borrando blob:', error);
          });
        }
        toast.success('Imagen actualizada correctamente', { id: 'upload' });
      }

      const slug = slugify(data.nombre);

      await updateDoc(doc(db, 'categorias', id), {
        nombre: data.nombre,
        slug,
        descripcion: data.descripcion,
        destacada: data.destacada,
        activa: data.activa,
        imagen: imagenUrl,
        imagenKey: imagenKeyToSave || undefined,
      });
      await revalidateFrontPaths(['/paquetes', `/categoria/${slug}`]);

      toast.success('Categoría actualizada correctamente');
      router.push('/admin/categorias');
    } catch (error) {
      console.error('Error updating categoria:', error);
      toast.error('Error al actualizar categoría');
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
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/categorias">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Editar Categoría</h1>
              <p className="text-gray-600 mt-1">Modifica la información de la categoría</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Información de la Categoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    {...register('nombre')}
                    placeholder="Ej: Europa"
                    className="mt-1.5"
                  />
                  {errors.nombre && (
                    <p className="text-base text-red-500 mt-1">{errors.nombre.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="descripcion">Descripción *</Label>
                  <Textarea
                    id="descripcion"
                    {...register('descripcion')}
                    placeholder="Describe esta categoría..."
                    rows={4}
                    className="mt-1.5"
                  />
                  {errors.descripcion && (
                    <p className="text-base text-red-500 mt-1">{errors.descripcion.message}</p>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Gestión de Orden Visual */}
            <DragDropOrderManager
              collectionName="categorias"
              currentId={id}
            />

            {/* Imagen de Portada */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Imagen de Portada</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  images={imagenPreview}
                  onImagesChange={setImagenPreview}
                  maxImages={1}
                  label="Imagen de portada *"
                  description="Sube una imagen para la categoría. Tamaño recomendado: 1200x800px."
                />
                {imagenPreview.length === 0 && (
                  <p className="text-sm text-amber-600 mt-3 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    La imagen de portada es obligatoria
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Configuración y Visibilidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between py-3 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="destacada" className="text-lg font-medium cursor-pointer">Categoría destacada</Label>
                    <p className="text-sm text-gray-500 pr-4">
                      Aparecerá en la sección destacados de la homepage
                    </p>
                  </div>
                  <Switch
                    id="destacada"
                    checked={destacada}
                    onCheckedChange={(checked) => setValue('destacada', checked)}
                    className="mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between py-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="activa" className="text-lg font-medium cursor-pointer">Categoría activa</Label>
                    <p className="text-sm text-gray-500 pr-4">
                      Visible para los usuarios en el sitio web
                    </p>
                  </div>
                  <Switch
                    id="activa"
                    checked={activa}
                    onCheckedChange={(checked) => setValue('activa', checked)}
                    className="mt-0.5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botones de Acción */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" asChild size="lg">
                <Link href="/admin/categorias">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                size="lg"
                className="bg-black hover:bg-gray-800 text-white min-w-[180px]"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

