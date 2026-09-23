import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import StockDashboard from '@/components/admin/StockDashboard';
import { getAllPaquetesAdmin } from '@/lib/paquetes';

export default async function StockPage() {
  const paquetes = await getAllPaquetesAdmin();
  return (
    <ProtectedRoute>
      <AdminLayout>
        <StockDashboard paquetes={paquetes} />
      </AdminLayout>
    </ProtectedRoute>
  );
}
