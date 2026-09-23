'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Registro público oculto: el proyecto no incluye logueo en el front. */
export default function RegistroPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
