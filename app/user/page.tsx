'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Perfil de usuario oculto: el proyecto no incluye logueo en el front. */
export default function UserProfilePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
