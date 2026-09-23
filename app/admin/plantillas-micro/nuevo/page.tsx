'use client';

import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import SeatLayoutEditor from '@/components/admin/SeatLayoutEditor';

export default function NuevaPlantillaMicroPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <SeatLayoutEditor />
      </AdminLayout>
    </ProtectedRoute>
  );
}

