'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import SeatLayoutEditor from '@/components/admin/SeatLayoutEditor';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function EditarPlantillaMicroPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? String(params.id) : '';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user || !id) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/seat-layouts/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || 'No se pudo cargar la plantilla');
        }
        const data = await res.json();
        if (!cancelled) setItem(data?.item ?? null);
      } catch (error) {
        toast.error('No pudimos cargar la plantilla');
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <div className="py-10 text-sm text-gray-600">Cargando…</div>
        ) : (
          <SeatLayoutEditor initial={item} />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

