'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { validateAdminDomain } from '@/lib/auth/authConfig';
import { ADMIN_EMAIL } from '@/lib/constants';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [domainValid, setDomainValid] = useState(true);
  const [emailAllowed, setEmailAllowed] = useState(true);

  useEffect(() => {
    // Verificar dominio permitido
    const isValidDomain = validateAdminDomain();
    setDomainValid(isValidDomain);
    
    if (!isValidDomain) {
      console.warn('⚠️ Acceso denegado: dominio no autorizado');
      return;
    }

    // Redirigir al login si no hay usuario autenticado
    if (!loading && !user) {
      router.replace('/admin/login');
      return;
    }

    // Restringir por email del administrador
    if (!loading && user && user.email && user.email.toLowerCase() !== ADMIN_EMAIL) {
      setEmailAllowed(false);
      router.replace('/admin/login');
    }
  }, [user, loading, router]);

  // Mostrar error de dominio no autorizado
  if (!domainValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-4">
            Este dominio no está autorizado para acceder al panel de administración.
          </p>
          <p className="text-base text-gray-500">
            Contacta al administrador del sistema si crees que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  // Mostrar error de email no autorizado
  if (!emailAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-4">
            Solo <span className="font-semibold">{ADMIN_EMAIL}</span> puede acceder al panel.
          </p>
        </div>
      </div>
    );
  }

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-gray-900 mx-auto mb-2" />
          <p className="text-base text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, no mostrar nada (se redirige al login)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

