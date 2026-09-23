import { 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  Auth 
} from 'firebase/auth';

// Configuración de seguridad para autenticación
export const AUTH_CONFIG = {
  // Persistencia por defecto: LOCAL (se mantiene después de cerrar navegador)
  defaultPersistence: browserLocalPersistence,
  
  // Tiempo de expiración de sesión inactiva (24 horas)
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
  
  // Tiempo de verificación de actividad (cada 5 minutos)
  activityCheckInterval: 5 * 60 * 1000, // 5 minutos
  
  // Dominios permitidos para admin (seguridad adicional)
  allowedDomains: [
    'localhost',
    '127.0.0.1'
  ],
  
  // Configuración de seguridad
  security: {
    // Máximo intentos de login fallidos
    maxLoginAttempts: 5,
    // Tiempo de bloqueo después de intentos fallidos (15 minutos)
    lockoutDuration: 15 * 60 * 1000,
    // Tiempo mínimo entre intentos de login (3 segundos)
    minTimeBetweenAttempts: 3000,
  }
} as const;

/**
 * Configura la persistencia de Firebase Auth
 * @param auth Instancia de Firebase Auth
 * @param rememberMe Si true, usa persistencia local; si false, usa persistencia de sesión
 */
export async function configureAuthPersistence(
  auth: Auth, 
  rememberMe: boolean = true
): Promise<void> {
  try {
    const persistence = rememberMe 
      ? browserLocalPersistence 
      : browserSessionPersistence;
      
    await setPersistence(auth, persistence);
    
    console.log(`✅ Persistencia configurada: ${rememberMe ? 'LOCAL' : 'SESSION'}`);
  } catch (error) {
    console.error('❌ Error configurando persistencia:', error);
    throw new Error('Error en configuración de autenticación');
  }
}

/**
 * Valida si el dominio actual está permitido para admin
 */
export function validateAdminDomain(): boolean {
  if (typeof window === 'undefined') return true; // SSR
  
  const currentDomain = window.location.hostname;
  const envDomains = (process.env.NEXT_PUBLIC_ADMIN_DOMAINS || process.env.NEXT_PUBLIC_ADMIN_DOMAIN || '')
    .split(',')
    .map(domain => domain.trim())
    .filter(Boolean);

  // Si no hay dominios configurados por env, permitir el dominio actual
  const configuredDomains = envDomains.length > 0 ? envDomains : [currentDomain];
  const allowedDomains = [...AUTH_CONFIG.allowedDomains, ...configuredDomains];

  return allowedDomains.some(domain =>
    currentDomain === domain || currentDomain.endsWith(`.${domain}`)
  );
}

/**
 * Genera un ID único para el dispositivo/navegador
 */
export function generateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  // Combinar información del navegador para crear ID único
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('device-id', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // Hash simple del fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}
