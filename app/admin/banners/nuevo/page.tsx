'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import ImageUploader from '@/components/admin/ImageUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { uploadMultipleImages } from '@/lib/utils/upload';
import { revalidateFrontPaths } from '@/lib/revalidate';

const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function NuevoBannerPage() {
  const [imagesPreview, setImagesPreview] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [target, setTarget] = useState<'home' | 'blog' | 'both'>('home');

  const handleUpload = async () => {
    if (imagesPreview.length === 0) {
      toast.error('Sube al menos una imagen');
      return;
    }

    setUploading(true);
    try {
      const files = imagesPreview.map((preview, index) =>
        dataURLtoFile(preview, `banner-${Date.now()}-${index}.jpg`)
      );
      const uploads = await uploadMultipleImages(files);
      const bannersSnapshot = await getDocs(collection(db, 'banners'));
      const maxOrden =
        bannersSnapshot.docs.length > 0
          ? Math.max(...bannersSnapshot.docs.map((doc) => (doc.data().orden || 0)))
          : 0;

      const addPromises = uploads.map((upload, index) =>
        addDoc(collection(db, 'banners'), {
          imageUrl: upload.url,
          imageKey: upload.key,
          orden: maxOrden + index + 1,
          activa: true,
          target,
          fechaCreacion: Timestamp.now(),
        })
      );

      await Promise.all(addPromises);
      await revalidateFrontPaths(['/']);
      toast.success('Banners guardados');
      setImagesPreview([]);
    } catch (error) {
      console.error('Error uploading banners:', error);
      toast.error('No pudimos subir los banners');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Nuevo banner</h1>
              <p className="text-gray-600 mt-1">
                Subí imágenes para el carrusel principal (modelo recomendado: 1920 x 500 px).
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/banners">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Subir nuevos banners</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Dónde se muestra</label>
                <Select value="home" onValueChange={() => setTarget('home')}>
                  <SelectTrigger className="h-9 w-full rounded-xl border-gray-200 bg-gray-50/70 text-sm focus:border-primary focus:ring-primary/30">
                    <SelectValue placeholder="Home" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ImageUploader
                images={imagesPreview}
                onImagesChange={setImagesPreview}
                maxImages={6}
                label="Imágenes del banner"
                description="Solo imágenes. Modelo recomendado: 1920x500px (proporción 3.84:1)."
              />
              <div className="flex justify-end">
                <Button onClick={handleUpload} disabled={uploading} className="text-white [&_svg]:text-white">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    'Guardar banners'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
