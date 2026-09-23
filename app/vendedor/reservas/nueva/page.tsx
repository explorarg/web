'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SITE_NAME } from '@/lib/constants';
import AdminReservaForm from '@/components/admin/AdminReservaForm';
import type { Paquete } from '@/types';
import type { Vendor } from '@/types/vendor';

type LockedVendor = Pick<Vendor, 'id' | 'name' | 'email'>;

export default function VendorNuevaReservaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<LockedVendor | null>(null);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/vendor/profile', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error ?? 'No pudimos cargar tu perfil');
        }
        const data = await response.json();
        if (!data?.vendor) {
          if (!cancelled) setVendor(null);
          toast.error('No se encontró tu perfil de vendedor');
          return;
        }

        if (cancelled) return;

        setVendor({
          id: String(data.vendor.id),
          name: String(data.vendor.name ?? user.email),
          email: String(data.vendor.email ?? user.email),
        });
        setPaquetes(Array.isArray(data.packages) ? (data.packages as Paquete[]) : []);
      } catch (error) {
        console.error('[vendedor/reservas/nueva] Error cargando formulario:', error);
        if (!cancelled) {
          setVendor(null);
          setPaquetes([]);
        }
        toast.error('No pudimos cargar los datos para crear la reserva');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-6 w-40 rounded-md bg-gray-200 animate-pulse" />
                  <div className="h-4 w-60 rounded-md bg-gray-200 animate-pulse" />
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`vendor-form-skeleton-${index}`} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando formulario...
                </div>
              </div>
            </div>
          ) : !vendor ? (
            <Card className="mx-auto max-w-xl border border-dashed border-gray-200 bg-white/80 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  No se encontró tu perfil de vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-600">
                <p>
                  Tu usuario no está vinculado a un vendedor activo. Consultá con el equipo de {SITE_NAME}{' '}
                  para habilitar tu acceso.
                </p>
              </CardContent>
            </Card>
          ) : paquetes.length === 0 ? (
            <Card className="mx-auto max-w-xl border border-dashed border-gray-200 bg-white/80 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  No tenés paquetes asignados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-gray-600">
                <p>
                  Consultá con el equipo de {SITE_NAME} para que te habiliten paquetes para crear
                  reservas manuales.
                </p>
              </CardContent>
            </Card>
          ) : (
            <AdminReservaForm
              paquetes={paquetes}
              submissionMode="vendor"
              lockedVendor={vendor}
              existingReservationsHref="/vendedor/reservas"
              successRedirectBuilder={() => '/vendedor/reservas'}
            />
          )}
        </div>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
