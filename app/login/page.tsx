'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Login público oculto: solo se usa el login del admin (/admin/login). */
export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
