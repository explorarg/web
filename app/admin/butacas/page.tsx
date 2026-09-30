import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import SeatsDashboard from '@/components/admin/SeatsDashboard';
import { getAllPaquetesAdmin } from '@/lib/paquetes';

export default async function ButacasAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const paquetes = (await getAllPaquetesAdmin()).filter((paquete) => paquete.visible !== false);
  const sp = (await searchParams) ?? {};
  const initialPackageId = typeof sp.packageId === 'string' ? sp.packageId : '';
  const initialDate = typeof sp.date === 'string' ? sp.date : '';
  return (
    <ProtectedRoute>
      <AdminLayout>
        <SeatsDashboard paquetes={paquetes} initialPackageId={initialPackageId} initialDate={initialDate} />
      </AdminLayout>
    </ProtectedRoute>
  );
}
