import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import ReservaSearchDashboard from '@/components/admin/ReservaSearchDashboard';
import { getAllPaquetesAdmin } from '@/lib/paquetes';

export default async function AdminReservasBuscarPage() {
  const paquetes = await getAllPaquetesAdmin();
  return (
    <ProtectedRoute>
      <AdminLayout>
        <ReservaSearchDashboard paquetes={paquetes} />
      </AdminLayout>
    </ProtectedRoute>
  );
}

