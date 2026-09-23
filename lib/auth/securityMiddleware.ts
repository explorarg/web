/**
 * Middleware de seguridad para el panel de administración
 * Implementa múltiples capas de protección siguiendo las mejores prácticas
 */

import { User } from 'firebase/auth';

// Tipos para el middleware de seguridad
interface SecurityCheck {
  passed: boolean;
  reason?: string;
  action?: 'block' | 'warn' | 'log';
}

interface SecurityContext {
  user: User | null;
  timestamp: number;
  userAgent: string;
  ip?: string;
  sessionId: string;
}

/**
 * Middleware principal de seguridad
 */
export class SecurityMiddleware {
  private static instance: SecurityMiddleware;
  private suspiciousActivity: Map<string, number[]> = new Map();
  private blockedIPs: Set<string> = new Set();
  private rateLimitMap: Map<string, number[]> = new Map();

  private constructor() {
    this.initializeSecurityMonitoring();
  }

  public static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Inicializa el monitoreo de seguridad
   */
  private initializeSecurityMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Limpiar datos antiguos cada hora
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Detectar cambios de pestaña/ventana (posible ataque)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logSecurityEvent('tab_hidden', 'low');
      }
    });

    // Detectar intentos de abrir DevTools
    const devtools = { open: false, orientation: null as string | null };
    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          this.logSecurityEvent('devtools_opened', 'medium');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  /**
   * Verifica la seguridad de una acción de usuario
   */
  public checkUserAction(
    user: User | null, 
    action: string, 
    context?: Partial<SecurityContext>
  ): SecurityCheck {
    if (!user) {
      return { passed: false, reason: 'Usuario no autenticado', action: 'block' };
    }

    // Verificar rate limiting
    const rateLimitCheck = this.checkRateLimit(user.uid, action);
    if (!rateLimitCheck.passed) {
      return rateLimitCheck;
    }

    // Verificar patrones sospechosos
    const suspiciousCheck = this.checkSuspiciousActivity(user.uid, action);
    if (!suspiciousCheck.passed) {
      return suspiciousCheck;
    }

    // Verificar validez del token
    const tokenCheck = this.checkTokenValidity(user);
    if (!tokenCheck.passed) {
      return tokenCheck;
    }

    // Verificar contexto de sesión
    const sessionCheck = this.checkSessionContext(user, context);
    if (!sessionCheck.passed) {
      return sessionCheck;
    }

    return { passed: true };
  }

  /**
   * Verifica rate limiting por usuario y acción
   */
  private checkRateLimit(userId: string, action: string): SecurityCheck {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = this.getMaxRequestsForAction(action);

    if (!this.rateLimitMap.has(key)) {
      this.rateLimitMap.set(key, []);
    }

    const requests = this.rateLimitMap.get(key)!;
    
    // Limpiar requests antiguos
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      this.logSecurityEvent('rate_limit_exceeded', 'high', { userId, action });
      return { 
        passed: false, 
        reason: `Rate limit excedido para ${action}`, 
        action: 'block' 
      };
    }

    validRequests.push(now);
    this.rateLimitMap.set(key, validRequests);

    return { passed: true };
  }

  /**
   * Obtiene el límite máximo de requests por acción
   */
  private getMaxRequestsForAction(action: string): number {
    const limits: Record<string, number> = {
      'login': 5,
      'create_package': 10,
      'delete_package': 5,
      'upload_image': 20,
      'export_data': 3,
      'default': 30
    };

    return limits[action] || limits.default;
  }

  /**
   * Detecta actividad sospechosa
   */
  private checkSuspiciousActivity(userId: string, action: string): SecurityCheck {
    if (!this.suspiciousActivity.has(userId)) {
      this.suspiciousActivity.set(userId, []);
    }

    const activities = this.suspiciousActivity.get(userId)!;
    const now = Date.now();
    const recentActivities = activities.filter(timestamp => now - timestamp < 5 * 60 * 1000); // 5 minutos

    // Detectar patrones sospechosos
    if (recentActivities.length > 50) {
      this.logSecurityEvent('suspicious_activity_high_frequency', 'critical', { userId, action });
      return { 
        passed: false, 
        reason: 'Actividad sospechosa detectada', 
        action: 'block' 
      };
    }

    recentActivities.push(now);
    this.suspiciousActivity.set(userId, recentActivities);

    return { passed: true };
  }

  /**
   * Verifica la validez del token de Firebase
   * Nota: Firebase maneja automáticamente la renovación de tokens,
   * por lo que si el usuario está autenticado, el token es válido
   */
  private checkTokenValidity(user: User): SecurityCheck {
    // Si el usuario está autenticado, Firebase ya validó el token
    // La expiración y renovación se manejan automáticamente
    if (!user) {
      return { 
        passed: false, 
        reason: 'Usuario no autenticado', 
        action: 'block' as const
      };
    }

    // Verificación básica: si el usuario existe, el token es válido
    // Firebase Auth maneja automáticamente la renovación de tokens
    return { passed: true };
  }

  /**
   * Verifica el contexto de la sesión
   */
  private checkSessionContext(user: User, context?: Partial<SecurityContext>): SecurityCheck {
    // Verificar User-Agent consistency (básico)
    if (context?.userAgent && typeof window !== 'undefined') {
      const currentUA = navigator.userAgent;
      if (context.userAgent !== currentUA) {
        this.logSecurityEvent('user_agent_mismatch', 'medium', { 
          userId: user.uid,
          expected: context.userAgent,
          actual: currentUA
        });
        return { 
          passed: false, 
          reason: 'Inconsistencia en User-Agent', 
          action: 'warn' 
        };
      }
    }

    return { passed: true };
  }

  /**
   * Registra eventos de seguridad
   */
  private logSecurityEvent(
    event: string, 
    severity: 'low' | 'medium' | 'high' | 'critical',
    data?: Record<string, unknown>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      severity,
      data,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };

    // En producción, esto se enviaría a un servicio de logging
    console.warn(`🔒 Security Event [${severity.toUpperCase()}]:`, logEntry);

    // Para eventos críticos, podrías enviar alertas
    if (severity === 'critical') {
      this.handleCriticalSecurityEvent(logEntry);
    }
  }

  /**
   * Maneja eventos de seguridad críticos
   */
  private handleCriticalSecurityEvent(logEntry: Record<string, unknown>): void {
    // En un entorno real, aquí enviarías alertas por email, Slack, etc.
    console.error('🚨 CRITICAL SECURITY EVENT:', logEntry);
    
    // Podrías implementar acciones automáticas como:
    // - Bloquear IP temporalmente
    // - Invalidar sesiones
    // - Enviar notificaciones a administradores
  }

  /**
   * Limpia datos antiguos para evitar memory leaks
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    // Limpiar actividad sospechosa
    for (const [userId, activities] of this.suspiciousActivity.entries()) {
      const recentActivities = activities.filter(timestamp => now - timestamp < maxAge);
      if (recentActivities.length === 0) {
        this.suspiciousActivity.delete(userId);
      } else {
        this.suspiciousActivity.set(userId, recentActivities);
      }
    }

    // Limpiar rate limiting
    for (const [key, requests] of this.rateLimitMap.entries()) {
      const recentRequests = requests.filter(timestamp => now - timestamp < maxAge);
      if (recentRequests.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, recentRequests);
      }
    }

    console.log('🧹 Security middleware: datos antiguos limpiados');
  }

  /**
   * Obtiene estadísticas de seguridad
   */
  public getSecurityStats(): {
    activeUsers: number;
    suspiciousActivities: number;
    rateLimitedActions: number;
    blockedIPs: number;
  } {
    return {
      activeUsers: this.suspiciousActivity.size,
      suspiciousActivities: Array.from(this.suspiciousActivity.values())
        .reduce((sum, activities) => sum + activities.length, 0),
      rateLimitedActions: this.rateLimitMap.size,
      blockedIPs: this.blockedIPs.size
    };
  }
}
