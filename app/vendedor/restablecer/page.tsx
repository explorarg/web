import { Suspense } from 'react';
import VendorPasswordResetPageClient from '@/components/vendor/VendorPasswordResetPageClient';

export default function VendorPasswordResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[linear-gradient(180deg,#F3FCFD_0%,#FFFFFF_45%,#F5FAFF_100%)]" />}>
      <VendorPasswordResetPageClient />
    </Suspense>
  );
}
