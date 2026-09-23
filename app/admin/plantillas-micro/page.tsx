import AdminLayout from '@/components/admin/AdminLayout';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import SeatLayoutsDashboard from '@/components/admin/SeatLayoutsDashboard';

export default function PlantillasMicroPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <SeatLayoutsDashboard />
      </AdminLayout>
    </ProtectedRoute>
  );
}

