'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { SessionManager } from '@/lib/auth/sessionManager';
import { configureAuthPersistence, validateAdminDomain } from '@/lib/auth/authConfig';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionManager] = useState(() => SessionManager.getInstance());

  // Función para cerrar sesión de forma segura
  const logout = useCallback(async () => {
    try {
      const auth = getAuthInstance();
      sessionManager.clearSession();
      await signOut(auth);
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error cerrando sesión:', error);
    }
  }, [sessionManager]);

  useEffect(() => {
    // Validar dominio permitido
    if (!validateAdminDomain()) {
      console.warn('⚠️ Dominio no autorizado para panel admin');
      setLoading(false);
      return;
    }

    // Lazy load auth solo cuando sea necesario
    const auth = getAuthInstance();
    
    // Configurar persistencia por defecto
    configureAuthPersistence(auth, true).catch(console.error);

    // Listener de cambios de autenticación
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Verificar sesión existente
        const existingSession = sessionManager.getSession();
        
        if (existingSession && existingSession.userId === firebaseUser.uid) {
          // Sesión válida existente
          setUser(firebaseUser);
          console.log('✅ Sesión restaurada para:', firebaseUser.email);
        } else if (existingSession && existingSession.userId !== firebaseUser.uid) {
          // Sesión de otro usuario, limpiar
          console.warn('⚠️ Sesión de usuario diferente detectada, limpiando...');
          sessionManager.clearSession();
          signOut(getAuthInstance());
          setUser(null);
        } else {
          // Nueva sesión, crear registro
          sessionManager.createSession(firebaseUser, true);
          setUser(firebaseUser);
          console.log('✅ Nueva sesión creada para:', firebaseUser.email);
        }
      } else {
        // No hay usuario autenticado
        sessionManager.clearSession();
        setUser(null);
      }
      
      setLoading(false);
    });

    // Verificar sesión al cargar
    const existingSession = sessionManager.getSession();
    if (existingSession) {
      console.log('🔄 Verificando sesión existente...');
    }

    // Cleanup al desmontar
    return () => {
      unsubscribe();
    };
  }, [sessionManager]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      // No destruir sessionManager aquí ya que es singleton
    };
  }, []);

  return { 
    user, 
    loading, 
    logout,
    sessionManager 
  };
}

