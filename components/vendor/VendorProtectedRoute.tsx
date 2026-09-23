'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function VendorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (loading) return;
      if (!user) {
        router.replace('/vendedor/login');
        if (!cancelled) setChecking(false);
        return;
      }
      // Impedir acceso con cuenta admin
      if (user.email && user.email.toLowerCase() === ADMIN_EMAIL) {
        router.replace('/admin');
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const q = query(collection(db, 'vendors'), where('email', '==', user.email ?? ''), limit(1));
        const snap = await getDocs(q);
        const d0 = snap.docs[0];
        if (cancelled) return;
        if (d0 && (d0.data() as any).active) {
          setAllowed(true);
        } else {
          setAllowed(false);
          router.replace('/vendedor/login');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Verificando acceso...
        </div>
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
