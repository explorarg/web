import { User } from 'firebase/auth';
import { AUTH_CONFIG, generateDeviceId } from './authConfig';

// Tipos para gestión de sesión
interface SessionData {
  userId: string;
  email: string;
  lastActivity: number;
  deviceId: string;
  loginTime: number;
  rememberMe: boolean;
}

interface LoginAttempt {
  email: string;
  timestamp: number;
  success: boolean;
  ip?: string;
}

// Claves para localStorage/sessionStorage
const STORAGE_KEYS = {
  SESSION: 'aura_admin_session',
  LAST_ACTIVITY: 'aura_last_activity',
  LOGIN_ATTEMPTS: 'aura_login_attempts',
  DEVICE_ID: 'aura_device_id'
} as const;

/**
 * Gestor de sesiones seguro para el panel admin
 */
export class SessionManager {
  private static instance: SessionManager;
  private activityTimer: NodeJS.Timeout | null = null;
  private deviceId: string;

  private constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.initializeActivityTracking();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Obtiene o crea un ID único para el dispositivo
   */
  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
  }

  /**
   * Inicializa el seguimiento de actividad del usuario
   */
  private initializeActivityTracking(): void {
    if (typeof window === 'undefined') return;

    // Eventos que indican actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.updateLastActivity();
    };

    // Agregar listeners de actividad
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Verificar sesión periódicamente
    this.startSessionCheck();
  }

  /**
   * Inicia la verificación periódica de sesión
   */
  private startSessionCheck(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }

    this.activityTimer = setInterval(() => {
      this.checkSessionValidity();
    }, AUTH_CONFIG.activityCheckInterval);
  }

  /**
   * Actualiza el timestamp de última actividad
   */
  private updateLastActivity(): void {
    if (typeof window === 'undefined') return;
    
    const now = Date.now();
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, now.toString());
  }

  /**
   * Verifica si la sesión sigue siendo válida
   */
  private checkSessionValidity(): boolean {
    if (typeof window === 'undefined') return false;

    const lastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
    if (!lastActivity) return false;

    const timeSinceActivity = Date.now() - parseInt(lastActivity);
    
    // Si ha pasado más tiempo del permitido, invalidar sesión
    if (timeSinceActivity > AUTH_CONFIG.sessionTimeout) {
      this.clearSession();
      return false;
    }

    return true;
  }

  /**
   * Crea una nueva sesión después del login exitoso
   */
  public createSession(user: User, rememberMe: boolean = true): void {
    if (typeof window === 'undefined') return;

    const sessionData: SessionData = {
      userId: user.uid,
      email: user.email || '',
      lastActivity: Date.now(),
      deviceId: this.deviceId,
      loginTime: Date.now(),
      rememberMe
    };

    // Guardar en el storage apropiado
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
    
    this.updateLastActivity();
    
    console.log(`✅ Sesión creada para ${user.email} (${rememberMe ? 'persistente' : 'temporal'})`);
  }

  /**
   * Obtiene los datos de la sesión actual
   */
  public getSession(): SessionData | null {
    if (typeof window === 'undefined') return null;

    // Intentar obtener de localStorage primero, luego sessionStorage
    let sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!sessionStr) {
      sessionStr = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    }

    if (!sessionStr) return null;

    try {
      const session: SessionData = JSON.parse(sessionStr);
      
      // Verificar validez de la sesión
      if (!this.checkSessionValidity()) {
        return null;
      }

      return session;
    } catch (error) {
      console.error('❌ Error parseando sesión:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Limpia la sesión actual
   */
  public clearSession(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    console.log('🧹 Sesión limpiada');
  }

  /**
   * Registra un intento de login
   */
  public recordLoginAttempt(email: string, success: boolean): void {
    if (typeof window === 'undefined') return;

    const attempt: LoginAttempt = {
      email: email.toLowerCase(),
      timestamp: Date.now(),
      success
    };

    const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    let attempts: LoginAttempt[] = [];
    
    if (attemptsStr) {
      try {
        attempts = JSON.parse(attemptsStr);
      } catch (error) {
        console.error('Error parseando intentos de login:', error);
      }
    }

    attempts.push(attempt);
    
    // Mantener solo los últimos intentos (últimas 24 horas)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    attempts = attempts.filter(attempt => attempt.timestamp > oneDayAgo);
    
    localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
  }

  /**
   * Verifica si el usuario está bloqueado por intentos fallidos
   */
  public isUserBlocked(email: string): boolean {
    if (typeof window === 'undefined') return false;

    const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (!attemptsStr) return false;

    try {
      const attempts: LoginAttempt[] = JSON.parse(attemptsStr);
      const userAttempts = attempts.filter(
        attempt => 
          attempt.email === email.toLowerCase() && 
          !attempt.success &&
          Date.now() - attempt.timestamp < AUTH_CONFIG.security.lockoutDuration
      );

      return userAttempts.length >= AUTH_CONFIG.security.maxLoginAttempts;
    } catch (error) {
      console.error('Error verificando bloqueo:', error);
      return false;
    }
  }

  /**
   * Obtiene el tiempo restante de bloqueo
   */
  public getBlockTimeRemaining(email: string): number {
    if (!this.isUserBlocked(email)) return 0;

    const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (!attemptsStr) return 0;

    try {
      const attempts: LoginAttempt[] = JSON.parse(attemptsStr);
      const failedAttempts = attempts.filter(
        attempt => 
          attempt.email === email.toLowerCase() && 
          !attempt.success
      );

      if (failedAttempts.length === 0) return 0;

      const lastFailedAttempt = failedAttempts[failedAttempts.length - 1];
      const timeElapsed = Date.now() - lastFailedAttempt.timestamp;
      const timeRemaining = AUTH_CONFIG.security.lockoutDuration - timeElapsed;

      return Math.max(0, timeRemaining);
    } catch (error) {
      console.error('Error calculando tiempo de bloqueo:', error);
      return 0;
    }
  }

  /**
   * Limpia los intentos de login exitosos para un usuario
   */
  public clearLoginAttempts(email: string): void {
    if (typeof window === 'undefined') return;

    const attemptsStr = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
    if (!attemptsStr) return;

    try {
      let attempts: LoginAttempt[] = JSON.parse(attemptsStr);
      // Mantener solo los intentos de otros usuarios
      attempts = attempts.filter(attempt => attempt.email !== email.toLowerCase());
      localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify(attempts));
    } catch (error) {
      console.error('Error limpiando intentos:', error);
    }
  }

  /**
   * Destruye la instancia (para cleanup)
   */
  public destroy(): void {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }
}
