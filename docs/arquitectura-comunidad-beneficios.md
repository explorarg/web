# Arquitectura: Sistema de Comunidad y Beneficios

> **Proyecto y marca:** Explorarg  
> **Versión:** 1.0  
> **Fecha:** 2026-09-29  
> **Estado:** Diseño

## Estado de Implementación

Este documento define el objetivo completo, pero no implica que todas las funciones estén desplegadas. Estado actual del código:

- **Implementado:** registro/login Firebase, perfil privado editable, historial de compras y redenciones, asociación autenticada en checkout Mercado Pago, sincronización idempotente de pagos, panel admin `/admin/comunidad`, directorio de miembros y CRUD de beneficios/cupones. En checkout se valida precio del paquete en servidor, se aplica un beneficio automático elegible o un cupón ingresado (no se acumulan entre sí), se reserva el uso al crear la preferencia y se confirma/libera desde webhooks o el proceso de expiración.
- **Pendiente:** apilamiento configurable, restricciones por categoría/paquete, condiciones de carrito/rangos, tiers automáticos, referidos de clientes, notificaciones y reportes.
- El descuento se aplica únicamente al subtotal base de paquetes; extras y cargos quedan excluidos. Por ahora las promociones se limitan a pagos en ARS. Los cupones/beneficios nuevos se crean **inactivos**.
- El panel inicial usa las colecciones Firestore `beneficios`, `cupones` y `usuarios`. La autenticación administrativa se valida en servidor y las operaciones de escritura usan Firebase Admin.
- Hasta definir soporte multidivisa para promociones, el checkout promocional se limita a **ARS** y los importes fijos/mínimos se interpretan en centavos.

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Modelo de Datos](#2-modelo-de-datos)
3. [Tipos de Beneficios](#3-tipos-de-beneficios)
4. [Motor de Reglas](#4-motor-de-reglas)
5. [Panel de Administración](#5-panel-de-administración)
6. [Flujo del Usuario](#6-flujo-del-usuario)
7. [Seguridad](#7-seguridad)
8. [Componentes Frontend](#8-componentes-frontend)
9. [API / Server Actions](#9-api--server-actions)
10. [Fases de Implementación](#10-fases-de-implementación)
11. [Consideraciones Clave](#11-consideraciones-clave)
12. [Glosario](#12-glosario)

---

## 1. Visión General

> **IMPORTANTE — Identidad del producto:** el proyecto y la comunidad se llaman **Explorarg**. Usar “Explorarg” en todo el producto, interfaz, documentación, emails y comunicaciones de la comunidad. No usar “Ovni Viajes” ni “Ovni Viajes y Turismo” como marca; cualquier aparición anterior de esos nombres es incorrecta y debe considerarse reemplazada por Explorarg. Las pantallas deben heredar la identidad visual existente del proyecto (paleta, tipografía, logotipo, componentes y patrones de navegación), no crear una marca paralela.

### Objetivo

Implementar un sistema de comunidad con registro de usuarios, autenticación y beneficios configurables desde el panel de administración. El sistema debe permitir:

- Registro y login de usuarios
- Beneficios automáticos (bienvenida, fidelidad, volumen, tier)
- Cupones de descuento con límites de uso
- Reglas configurables por el admin sin modificar código
- Tracking completo de uso de beneficios

### Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│                    PANEL ADMIN                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Usuarios  │ │Beneficios│ │Cupones   │ │Reglas     │  │
│  │Comunidad │ │Config    │ │Gestión   │ │Motor      │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  FIRESTORE (DB)                         │
│  usuarios │ beneficios │ cupones │ reglas │ reservas    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   SITIO PÚBLICO                         │
│  Registro → Login → Ver beneficios → Reservar con desc. │
└─────────────────────────────────────────────────────────┘
```

### Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Flexibilidad** | Nuevos tipos de beneficios sin cambiar código |
| **Seguridad** | Motor de reglas server-side, no confiar en el cliente |
| **Performance** | Cálculo de descuentos optimizado, sin N+1 queries |
| **UX** | Mostrar siempre el ahorro al usuario de forma clara |
| **Trazabilidad** | Todo descuento queda registrado con su origen |

---

## 2. Modelo de Datos

### 2.1 Colección `usuarios`

Perfil extendido del usuario, vinculado a Firebase Auth.

```typescript
interface Usuario {
  // Identificación
  uid: string;                    // Firebase Auth UID (document ID)
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  avatarUrl?: string;
  
  // Rol y estado
  rol: 'cliente' | 'admin';
  activo: boolean;
  fechaRegistro: Timestamp;
  ultimaActividad?: Timestamp;
  
  // Métricas para beneficios
  totalCompras: number;           // Cantidad de paquetes comprados
  totalGastado: number;           // Monto total acumulado (en centavos USD)
  cantidadReservas: number;       // Total de reservas realizadas
  
  // Beneficios y cupones
  beneficiosUsados: string[];     // IDs de beneficios ya aplicados
  cuponesUsados: string[];        // IDs de cupones canjeados
  
  // Referidos
  codigoReferido?: string;        // Código único del usuario
  referidoPor?: string;           // UID de quien lo refirió
  cantidadReferidos: number;      // Cuántos usuarios refirió
  
  // Tier / Nivel
  tier: 'bronce' | 'plata' | 'oro' | 'platino';
  tierAsignadoManual: boolean;    // Si fue asignado por admin
  
  // Preferencias
  notificaciones: {
    email: boolean;
    whatsapp: boolean;
    beneficiosNuevos: boolean;
  };
}
```

**Índices necesarios:**
- `rol` + `fechaRegistro` (listar admins, ordenar por fecha)
- `tier` + `totalGastado` (rankings, reportes)
- `codigoReferido` (búsqueda única al registrarse)

---

### 2.2 Colección `beneficios`

Beneficios configurables por el admin.

```typescript
interface Beneficio {
  id: string;
  
  // Información general
  nombre: string;                 // "Descuento Bienvenida", "2do Paquete -20%"
  descripcion: string;            // Descripción visible al usuario
  tipo: TipoBeneficio;            // Ver sección 3
  
  // Estado
  activo: boolean;
  visible: boolean;               // Si se muestra públicamente
  prioridad: number;              // Mayor = se evalúa primero (0-100)
  
  // Configuración del beneficio
  config: BeneficioConfig;
  
  // Vigencia
  fechaInicio?: Timestamp;        // Cuándo empieza a estar disponible
  fechaFin?: Timestamp;           // Cuándo expira (null = sin expiración)
  
  // Metadata
  fechaCreacion: Timestamp;
  creadoPor: string;              // UID del admin
  ultimaModificacion: Timestamp;
  modificadoPor: string;
}

type TipoBeneficio = 
  | 'bienvenida'          // Descuento para usuarios nuevos
  | 'fidelidad'           // Por cantidad de compras
  | 'volumen'             // Por gasto acumulado
  | 'temporal'            // Promoción por tiempo limitado
  | 'segunda_compra'      // Descuento específico 2do paquete
  | 'tier'                // Beneficio por nivel
  | 'referido'           // Por referir usuarios
  | 'exclusivo'           // Acceso a paquetes/categorías exclusivas
  | 'envio_gratis'        // Envío gratis (si aplica)
  | 'personalizado';      // Regla custom configurada por admin

interface BeneficioConfig {
  // Descuento
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valorDescuento: number;         // 20 = 20% o $20 (en centavos si es fijo)
  
  // Límites de uso
  usosMaximos?: number;           // Total de veces que se puede usar (null = ilimitado)
  usosActuales: number;           // Contador de uso
  usosPorUsuario: number;         // Default: 1
  
  // Condiciones de elegibilidad
  condiciones: Condicion[];
  
  // Restricciones de aplicación
  montoMinimoCompra?: number;     // Solo aplica si compra > X (centavos)
  categoriasAplicables?: string[]; // IDs de categorías (null = todas)
  paquetesAplicables?: string[];   // IDs específicos (null = todos)
  noAcumulableCon?: string[];      // IDs de beneficios excluyentes
}

interface Condicion {
  campo: 'totalCompras' | 'totalGastado' | 'cantidadReservas' | 
         'diasDesdeRegistro' | 'cantidadReferidos' | 'tier' |
         'primeraCompra' | 'esSegundoPaquete';
  operador: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'entre';
  valor: number | string | boolean | [number, number];
}
```

---

### 2.3 Colección `cupones`

Cupones de descuento canjeables por código.

```typescript
interface Cupon {
  id: string;
  
  // Identificación
  codigo: string;                 // "BIENVENIDA20", "VERANO50" (único, mayúsculas)
  descripcion: string;
  
  // Tipo de descuento
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valor: number;                  // 20 = 20% o $20 (centavos si es fijo)
  
  // Límites de uso
  usosTotales: number;            // Máximo de usos globales (null = ilimitado)
  usosActuales: number;           // Contador actual
  usosPorUsuario: number;         // Default: 1
  
  // Vigencia
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  
  // Restricciones
  montoMinimoCompra?: number;     // Solo aplica si compra > X (centavos)
  categoriasAplicables?: string[]; // IDs de categorías (null = todas)
  paquetesAplicables?: string[];   // IDs específicos (null = todos)
  soloUsuariosNuevos?: boolean;   // Solo para usuarios con 0 compras
  
  // Estado
  activo: boolean;
  
  // Metadata
  fechaCreacion: Timestamp;
  creadoPor: string;
}
```

**Índices necesarios:**
- `codigo` (búsqueda única, case-insensitive)
- `activo` + `fechaFin` (cupones vigentes)

---

### 2.4 Colección `reglasBeneficio`

Motor de reglas configurable por el admin.

```typescript
interface Regla {
  id: string;
  
  // Información general
  nombre: string;                 // "Descuento 3er paquete"
  descripcion?: string;
  activa: boolean;
  prioridad: number;              // Mayor = se evalúa primero
  
  // Condiciones (AND lógico entre todas)
  condiciones: ReglaCondicion[];
  
  // Acción a cumplir
  accion: ReglaAccion;
  
  // Exclusiones
  excluyeCon: string[];           // IDs de reglas/beneficios excluyentes
  
  // Metadata
  fechaCreacion: Timestamp;
  creadoPor: string;
}

interface ReglaCondicion {
  campo: 'totalCompras' | 'totalGastado' | 'cantidadReservas' | 
         'diasDesdeRegistro' | 'cantidadReferidos' | 'tier' |
         'primeraCompra' | 'esSegundoPaquete' | 'categoriaPaquete' |
         'tipoPaquete' | 'montoCarrito';
  operador: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'entre' | 'in';
  valor: number | string | boolean | string[] | [number, number];
}

interface ReglaAccion {
  tipo: 'descuento_porcentaje' | 'descuento_fijo' | 'envio_gratis' | 
        'upgrade_tier' | 'acceso_exclusivo' | 'notificacion';
  valor: number;                  // Porcentaje, monto, o tier a asignar
  aplicarA: 'carrito' | 'paquete_especifico' | 'envio';
}
```

---

### 2.5 Colección `beneficiosUsados`

Tracking de todos los beneficios y cupones canjeados.

```typescript
interface BeneficioUsado {
  id: string;
  
  // Quién
  usuarioId: string;
  
  // Qué
  tipo: 'beneficio' | 'cupon' | 'regla';
  beneficioId?: string;
  cuponId?: string;
  reglaId?: string;
  
  // En qué reserva
  reservaId: string;
  paqueteId: string;
  paqueteTitulo: string;
  
  // Cuánto
  montoOriginal: number;          // Precio sin descuento (centavos)
  montoDescuento: number;         // Cuánto se descontó (centavos)
  montoFinal: number;             // Precio con descuento (centavos)
  
  // Cuándo
  fechaUso: Timestamp;
  
  // Contexto
  detalle: string;                // "Bienvenida: 20% off primer paquete"
}
```

**Índices necesarios:**
- `usuarioId` + `fechaUso` (historial del usuario)
- `beneficioId` + `fechaUso` (reporte por beneficio)
- `cuponId` + `fechaUso` (reporte por cupón)
- `reservaId` (búsqueda por reserva)

---

### 2.6 Colección `configuracionBeneficios`

Configuración global del sistema de beneficios.

```typescript
interface ConfiguracionBeneficios {
  id: string;                     // "global" (documento único)
  
  // Reglas de apilamiento
  permitirApilamiento: boolean;   // Si se pueden combinar múltiples beneficios
  maxBeneficiosPorReserva: number; // Máximo de descuentos apilables (default: 2)
  
  // Exclusiones globales
  cuponesExcluyenBeneficios: boolean; // Si un cupón anula beneficios automáticos
  beneficiosSeExcluyenEntreSi: boolean; // Si dos beneficios no pueden combinarse
  
  // Comportamiento
  aplicarAutomaticamente: boolean; // Aplicar mejor beneficio sin pedir código
  mostrarAhorroEnCarrito: boolean; // Mostrar desglose en el carrito
  
  // Notificaciones
  notificarBeneficioDesbloqueado: boolean;
  notificarCuponExpirado: boolean; // Avisar 3 días antes de expirar
  
  // Tiers (configuración de niveles)
  tiers: {
    bronce: { minimoGasto: number; beneficios: string[] };
    plata: { minimoGasto: number; beneficios: string[] };
    oro: { minimoGasto: number; beneficios: string[] };
    platino: { minimoGasto: number; beneficios: string[] };
  };
}
```

---

## 3. Tipos de Beneficios

### 3.1 Tabla de Tipos

| Tipo | Descripción | Ejemplo | Automático |
|------|-------------|---------|------------|
| **Bienvenida** | Descuento para usuarios nuevos (primeras N compras) | "20% off en tu primer paquete" | Sí |
| **Fidelidad** | Descuento progresivo por cantidad de compras | "3er paquete: 15% off" | Sí |
| **Volumen** | Descuento por gasto acumulado | "Gastó >$5000: 10% off permanente" | Sí |
| **Temporal** | Promoción por tiempo limitado | "Verano 2026: 25% off" | Sí |
| **Segunda compra** | Descuento específico 2do paquete | "2do paquete: 20% off" | Sí |
| **Tier** | Beneficio por nivel de lealtad | "Oro: envío gratis + 5% off" | Sí |
| **Referido** | Beneficio por referir amigos | "Referí 3: 30% off" | Sí |
| **Exclusivo** | Acceso a paquetes/categorías exclusivas | "Miembros: acceso anticipado" | No |
| **Cupon** | Código canjeable con límites | "CUPON50: $50 off, 100 usos" | No |
| **Personalizado** | Regla custom configurada por admin | "Categoría A + 2do paquete: 15% off" | Sí |

### 3.2 Detalle por Tipo

#### Bienvenida
```typescript
{
  tipo: 'bienvenida',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 20,
    usosPorUsuario: 1,
    condiciones: [
      { campo: 'primeraCompra', operador: '==', valor: true }
    ]
  }
}
```

#### Fidelidad
```typescript
{
  tipo: 'fidelidad',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 15,
    condiciones: [
      { campo: 'totalCompras', operador: '==', valor: 3 }
    ]
  }
}
```

#### Volumen
```typescript
{
  tipo: 'volumen',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 10,
    condiciones: [
      { campo: 'totalGastado', operador: '>=', valor: 500000 } // $5000 en centavos
    ]
  }
}
```

#### Segunda Compra
```typescript
{
  tipo: 'segunda_compra',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 20,
    condiciones: [
      { campo: 'esSegundoPaquete', operador: '==', valor: true }
    ]
  }
}
```

#### Tier
```typescript
{
  tipo: 'tier',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 5,
    condiciones: [
      { campo: 'tier', operador: 'in', valor: ['oro', 'platino'] }
    ]
  }
}
```

#### Referido
```typescript
{
  tipo: 'referido',
  config: {
    tipoDescuento: 'porcentaje',
    valorDescuento: 30,
    condiciones: [
      { campo: 'cantidadReferidos', operador: '>=', valor: 3 }
    ]
  }
}
```

---

## 4. Motor de Reglas

### 4.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────┐
│              MOTOR DE BENEFICIOS                        │
│                                                         │
│  Input: Usuario + Carrito/Reserva + Cupón (opcional)   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. OBTENER PERFIL USUARIO                       │   │
│  │    - totalCompras, totalGastado, tier, etc.     │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 2. FILTRAR BENEFICIOS CANDIDATOS                │   │
│  │    - activo == true                             │   │
│  │    - dentro de vigencia                         │   │
│  │    - usosActuales < usosMaximos                 │   │
│  │    - usuario no lo usó antes                    │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 3. EVALUAR CONDICIONES                          │   │
│  │    - Para cada beneficio, verificar condiciones │   │
│  │    - Todas deben cumplirse (AND lógico)         │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 4. CALCULAR DESCUENTOS APLICABLES               │   │
│  │    - Aplicar descuento a monto del carrito      │   │
│  │    - Verificar montoMinimoCompra                │   │
│  │    - Verificar restricciones de categoría       │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 5. APLICAR PRIORIDADES Y EXCLUSIONES            │   │
│  │    - Ordenar por prioridad                      │   │
│  │    - Aplicar exclusiones entre beneficios        │   │
│  │    - Respetar maxBeneficiosPorReserva           │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 6. PROCESAR CUPÓN (si aplica)                   │   │
│  │    - Validar código                             │   │
│  │    - Verificar límites                          │   │
│  │    - Calcular descuento adicional               │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 7. RETORNAR RESULTADO                           │   │
│  │    - descuentoTotal                             │   │
│  │    - detalleDescuentos[]                        │   │
│  │    - montoFinal                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Algoritmo de Evaluación

```typescript
// Pseudocódigo del motor de beneficios

function calcularBeneficios(
  usuario: Usuario,
  carrito: Carrito,
  cuponCodigo?: string
): ResultadoBeneficios {
  
  // 1. Obtener configuración global
  const config = getConfiguracionBeneficios();
  
  // 2. Obtener beneficios activos
  const beneficiosActivos = getBeneficiosActivos();
  
  // 3. Filtrar por elegibilidad
  const elegibles = beneficiosActivos.filter(b => 
    b.activo &&
    estaEnVigencia(b) &&
    !usuario.beneficiosUsados.includes(b.id) &&
    (b.config.usosMaximos === null || b.config.usosActuales < b.config.usosMaximos) &&
    cumpleCondiciones(usuario, carrito, b.config.condiciones) &&
    cumpleRestricciones(carrito, b.config)
  );
  
  // 4. Ordenar por prioridad
  elegibles.sort((a, b) => b.prioridad - a.prioridad);
  
  // 5. Aplicar exclusiones y límite de apilamiento
  const seleccionados: Beneficio[] = [];
  for (const beneficio of elegibles) {
    if (seleccionados.length >= config.maxBeneficiosPorReserva) break;
    if (config.beneficiosSeExcluyenEntreSi && 
        seleccionados.some(s => s.config.noAculableCon?.includes(beneficio.id))) continue;
    seleccionados.push(beneficio);
  }
  
  // 6. Calcular descuentos
  let montoDescuentoTotal = 0;
  const detalleDescuentos: DetalleDescuento[] = [];
  
  for (const beneficio of seleccionados) {
    const descuento = calcularDescuento(beneficio, carrito.subtotal);
    montoDescuentoTotal += descuento;
    detalleDescuentos.push({
      tipo: 'beneficio',
      id: beneficio.id,
      nombre: beneficio.nombre,
      monto: descuento
    });
  }
  
  // 7. Procesar cupón (si aplica)
  if (cuponCodigo && !config.cuponesExcluyenBeneficios) {
    const cupon = validarCupon(cuponCodigo, usuario, carrito);
    if (cupon) {
      const descuentoCupon = calcularDescuento(cupon, carrito.subtotal - montoDescuentoTotal);
      montoDescuentoTotal += descuentoCupon;
      detalleDescuentos.push({
        tipo: 'cupon',
        id: cupon.id,
        nombre: `Cupón ${cupon.codigo}`,
        monto: descuentoCupon
      });
    }
  }
  
  // 8. Retornar resultado
  return {
    descuentoTotal: montoDescuentoTotal,
    detalleDescuentos,
    montoFinal: carrito.subtotal - montoDescuentoTotal,
    ahorroPorcentaje: (montoDescuentoTotal / carrito.subtotal) * 100
  };
}
```

### 4.3 Prioridades de Aplicación

| Prioridad | Tipo | Descripción |
|-----------|------|-------------|
| 100 | Cupón | Código explícito del usuario |
| 90 | Bienvenida | Descuento de primer compra |
| 80 | Tier | Beneficio por nivel |
| 70 | Fidelidad | Por cantidad de compras |
| 60 | Volumen | Por gasto acumulado |
| 50 | Segunda compra | 2do paquete |
| 40 | Referido | Por referidos |
| 30 | Temporal | Promociones |
| 20 | Exclusivo | Acceso especial |
| 10 | Personalizado | Reglas custom |

### 4.4 Reglas de Exclusión

```
┌─────────────────────────────────────────────────────────┐
│              EXCLUSIONES                                │
│                                                         │
│  Cupón + Beneficio automático                           │
│  ├─ Si config.cuponesExcluyenBeneficios = true          │
│  │  → Solo se aplica el cupón                           │
│  └─ Si config.cuponesExcluyenBeneficios = false         │
│     → Se aplican ambos (si maxBeneficiosPorReserva > 1) │
│                                                         │
│  Beneficio + Beneficio                                  │
│  ├─ Si config.beneficiosSeExcluyenEntreSi = true        │
│  │  → Solo se aplica el de mayor prioridad              │
│  └─ Si config.beneficiosSeExcluyenEntreSi = false       │
│     → Se aplican ambos (si maxBeneficiosPorReserva > 1) │
│                                                         │
│  Exclusiones específicas                                │
│  └─ config.noAculableCon define exclusiones puntuales   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Panel de Administración

### 5.1 Estructura de Rutas

```
/admin/comunidad
├── /dashboard          → Stats generales
├── /usuarios           → Gestión de usuarios
├── /beneficios         → CRUD de beneficios
├── /cupones            → Gestión de cupones
├── /reglas             → Motor de reglas
├── /configuracion      → Parámetros globales
└── /reportes           → Reportes y analytics
```

### 5.2 Dashboard

**Métricas principales:**
- Usuarios registrados (total, últimos 30 días)
- Beneficios más usados (top 5)
- Cupones más canjeados (top 5)
- Monto total descontado (mensual)
- Tasa de conversión (visitas → reservas con descuento)
- Distribución de tiers

**Gráficos:**
- Línea temporal: nuevos usuarios vs beneficios usados
- Barras: descuento por tipo de beneficio
- Pie: distribución de tiers

### 5.3 Gestión de Usuarios

**Funcionalidades:**
- Listar usuarios con búsqueda y filtros
- Ver perfil detallado (compras, beneficios usados, tier)
- Asignar tier manualmente
- Activar/desactivar usuario
- Ver historial de beneficios usados
- Enviar notificación manual

**Filtros:**
- Por tier
- Por fecha de registro
- Por cantidad de compras
- Por gasto acumulado
- Por estado (activo/inactivo)

### 5.4 Gestión de Beneficios

**Funcionalidades:**
- Listar beneficios (activos/inactivos/todos)
- Crear nuevo beneficio (formulario dinámico según tipo)
- Editar beneficio existente
- Activar/desactivar beneficio
- Ver estadísticas de uso (cuántas veces se usó, cuánto se descontó)
- Duplicar beneficio (clonar configuración)

**Formulario dinámico:**
- Según el `tipo` seleccionado, mostrar campos relevantes
- Validación en tiempo real de condiciones
- Preview del beneficio (cómo se vería al usuario)

### 5.5 Gestión de Cupones

**Funcionalidades:**
- Listar cupones con filtros (activos, expirados, por uso)
- Crear cupón individual
- Generar cupones masivos (prefijo + cantidad + sufijo aleatorio)
- Ver uso por cupón (quién, cuándo, en qué reserva)
- Activar/desactivar cupón
- Exportar lista de códigos (CSV)

**Generador masivo:**
```
Prefijo: VERANO
Cantidad: 100
Sufijo: aleatorio (4 caracteres)
Resultado: VERANO-AB12, VERANO-CD34, ...
```

### 5.6 Motor de Reglas

**Constructor visual:**
```
┌─────────────────────────────────────────────────────────┐
│  REGLA: Descuento 3er paquete                           │
│                                                         │
│  SI (todas las condiciones se cumplen):                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ totalCompras >= 3                               │   │
│  │ Y                                               │   │
│  │ tier != 'bronce'                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ENTONCES:                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Aplicar 15% de descuento                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Excluye con: [Descuento Bienvenida]                   │
│                                                         │
│  [Guardar] [Probar] [Activar/Desactivar]               │
└─────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Crear regla con constructor visual
- Probar regla con usuario de prueba (simular)
- Editar regla existente
- Activar/desactivar regla
- Ver historial de evaluaciones

### 5.7 Configuración Global

**Parámetros configurables:**
- Permitir apilamiento de beneficios
- Máximo de beneficios por reserva
- Cupones excluyen beneficios (sí/no)
- Beneficios se excluyen entre sí (sí/no)
- Aplicar automáticamente el mejor beneficio
- Mostrar ahorro en carrito
- Notificar beneficio desbloqueado
- Notificar cupón por expirar

**Configuración de tiers:**
```
Bronce:  $0 - $999     → Sin beneficios adicionales
Plata:   $1000 - $4999 → 5% off + envío gratis
Oro:     $5000 - $9999 → 10% off + envío gratis + acceso anticipado
Platino: $10000+       → 15% off + envío gratis + acceso exclusivo
```

### 5.8 Reportes

**Reportes disponibles:**
- Uso de beneficios por período
- ROI de descuentos (descuento vs ingresos generados)
- Usuarios por tier
- Cupones más efectivos
- Tasa de canje de cupones
- Beneficios más rentables

**Exportación:**
- CSV
- Excel (opcional)

---

## 6. Flujo del Usuario

### 6.1 Registro

```
1. Usuario completa formulario de registro
   → Nombre, email, teléfono, contraseña
   
2. Se crea usuario en Firebase Auth

3. Se crea perfil en /usuarios
   → totalCompras: 0
   → totalGastado: 0
   → tier: 'bronce'
   → codigoReferido: generado automáticamente
   
4. Se evalúan beneficios automáticos
   → Si hay beneficio de bienvenida activo:
     → Mostrar banner: "¡Bienvenido! Tienes 20% off en tu primer paquete"
   
5. Si se registró con código de referido:
   → Incrementar cantidadReferidos del referente
   → Evaluar beneficios de referido
```

### 6.2 Login

```
1. Usuario ingresa credenciales

2. Se obtiene perfil de /usuarios

3. Se cargan beneficios disponibles
   → Beneficios automáticos elegibles
   → Cupones vigentes
   
4. Se muestra panel de beneficios en el perfil
```

### 6.3 Selección de Paquete

```
1. Usuario navega a un paquete

2. Se muestra precio con descuento aplicable (si hay)
   → Precio original: $1000
   → Descuento bienvenida: -20%
   → Precio final: $800
   → Ahorro: $200

3. Usuario puede ingresar cupón (opcional)
   → Input de código de cupón
   → Validación en tiempo real
   → Se recalcula precio final
```

### 6.4 Reserva

```
1. Usuario confirma reserva

2. Se ejecuta motor de beneficios (server-side)
   → Se calcula descuento final
   → Se validan todas las condiciones
   
3. Se crea reserva con detalle de descuento
   → montoOriginal
   → montoDescuento
   → montoFinal
   → detalleDescuentos[]
   
4. Se registra en /beneficiosUsados
   → Se actualizan contadores
   
5. Se actualiza perfil de usuario
   → totalCompras += 1
   → totalGastado += montoFinal
   → Reevaluar tier
   
6. Se evalúan nuevos beneficios desbloqueados
   → Si desbloqueó nuevo tier: notificar
   → Si alcanzó nueva meta: notificar
```

### 6.5 Post-Compra

```
1. Se actualiza perfil de usuario
   → totalCompras, totalGastado, tier
   
2. Se evalúan beneficios desbloqueados
   → Nuevo tier alcanzado
   → Nueva meta de fidelidad
   → Nuevo beneficio de volumen
   
3. Se envían notificaciones (si configurado)
   → Email: "¡Felicidades! Alcanzaste el tier Oro"
   → WhatsApp: "Tienes 10% off en tu próxima compra"
   
4. Se actualiza historial de beneficios usados
```

---

## 7. Seguridad

### 7.1 Reglas de Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helpers
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }
    
    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }
    
    // Beneficios: lectura pública, escritura solo admin
    match /beneficios/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Cupones: lectura pública, escritura solo admin
    match /cupones/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Reglas: lectura pública, escritura solo admin
    match /reglasBeneficio/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Usuarios: lectura propia o admin, escritura propia o admin
    match /usuarios/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid);
      allow update: if isOwner(uid) || isAdmin();
      allow delete: if isAdmin();
    }
    
    // Beneficios usados: lectura propia o admin, escritura solo via Cloud Function
    match /beneficiosUsados/{id} {
      allow read: if isAuthenticated() && 
        (isAdmin() || resource.data.usuarioId == request.auth.uid);
      allow write: if false; // Solo via Cloud Function
    }
    
    // Configuración: lectura pública, escritura solo admin
    match /configuracionBeneficios/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

### 7.2 Consideraciones de Seguridad

| Riesgo | Mitigación |
|--------|------------|
| Manipulación de precios desde cliente | Motor de reglas 100% server-side |
| Uso de cupones ajenos | Validación de usosPorUsuario en server |
| Abuso de beneficios | Límites de uso y condiciones en server |
| Suplantación de identidad | Firebase Auth + reglas de Firestore |
| Race conditions en contadores | Transacciones Firestore |
| Exposición de datos sensibles | Reglas de lectura restrictivas |

### 7.3 Cloud Functions Necesarias

| Función | Trigger | Descripción |
|---------|---------|-------------|
| `onUserCreate` | Creación de usuario | Inicializar perfil, evaluar bienvenida |
| `onReservaCreate` | Creación de reserva | Aplicar beneficios, actualizar contadores |
| `onCuponUse` | Uso de cupón | Incrementar contador, validar límites |
| `onTierChange` | Cambio de tier | Notificar usuario, actualizar beneficios |
| `onReferido` | Nuevo referido | Incrementar contador, evaluar beneficios |

---

## 8. Componentes Frontend

### 8.1 Componentes del Sitio Público

| Componente | Ubicación | Función |
|------------|-----------|---------|
| `BenefitsBanner` | Homepage | Muestra beneficios activos del usuario |
| `CouponInput` | Checkout | Input para cupón + validación en tiempo real |
| `DiscountBreakdown` | Checkout | Desglose de descuentos aplicados |
| `UserBenefitsPanel` | Perfil usuario | Lista de beneficios disponibles/usados |
| `TierProgress` | Perfil usuario | Barra de progreso hacia siguiente tier |
| `ReferralCard` | Perfil usuario | Código de referido + enlace para compartir |
| `BenefitCard` | Homepage / Categorías | Tarjeta de beneficio individual |

### 8.2 Componentes del Panel Admin

| Componente | Ubicación | Función |
|------------|-----------|---------|
| `AdminBenefitsManager` | /admin/beneficios | CRUD completo de beneficios |
| `AdminCouponGenerator` | /admin/cupones | Generador masivo de códigos |
| `AdminCouponList` | /admin/cupones | Lista con filtros y uso |
| `AdminRuleBuilder` | /admin/reglas | Constructor visual de reglas |
| `AdminUserList` | /admin/usuarios | Lista con búsqueda y filtros |
| `AdminUserDetail` | /admin/usuarios/[id] | Perfil detallado + acciones |
| `AdminDashboard` | /admin/comunidad | Métricas y gráficos |
| `AdminConfigForm` | /admin/configuracion | Formulario de configuración global |

### 8.3 Componentes Compartidos

| Componente | Función |
|------------|---------|
| `DiscountBadge` | Badge de descuento (ej: "-20%") |
| `PriceWithDiscount` | Precio original tachado + precio con descuento |
| `BenefitIcon` | Icono según tipo de beneficio |
| `TierBadge` | Badge de tier (bronce, plata, oro, platino) |
| `CouponCard` | Tarjeta de cupón con código y estado |

---

## 9. API / Server Actions

### 9.1 Server Actions (Next.js)

```typescript
// app/actions/beneficios.ts

// Obtener beneficios disponibles para el usuario
export async function getBeneficiosDisponibles(usuarioId: string): Promise<Beneficio[]>

// Calcular descuentos para una reserva
export async function calcularDescuentos(
  usuarioId: string,
  paqueteId: string,
  cuponCodigo?: string
): Promise<ResultadoBeneficios>

// Validar cupón
export async function validarCupon(
  codigo: string,
  usuarioId: string,
  paqueteId: string
): Promise<{ valido: boolean; mensaje: string; descuento?: number }>

// Aplicar beneficio a reserva
export async function aplicarBeneficios(
  reservaId: string,
  beneficiosIds: string[],
  cuponId?: string
): Promise<void>

// Obtener historial de beneficios del usuario
export async function getHistorialBeneficios(usuarioId: string): Promise<BeneficioUsado[]>

// Obtener perfil de usuario con métricas
export async function getPerfilUsuario(usuarioId: string): Promise<Usuario>
```

### 9.2 API Routes (opcional, si se necesita acceso externo)

```
GET    /api/beneficios              → Listar beneficios activos
GET    /api/beneficios/:id          → Detalle de beneficio
GET    /api/cupones/:codigo         → Validar cupón
GET    /api/usuario/:id/beneficios  → Beneficios disponibles del usuario
POST   /api/reservas/:id/descuentos → Calcular descuentos
```

---

## 10. Fases de Implementación

### Fase 1 — Fundación (Semana 1-2)

**Objetivo:** Tener la base de datos y autenticación funcionando.

- [ ] Crear colecciones en Firestore (`usuarios`, `beneficios`, `cupones`, `reglasBeneficio`, `beneficiosUsados`, `configuracionBeneficios`)
- [ ] Configurar reglas de seguridad de Firestore
- [ ] Extender registro de usuarios para crear perfil en `/usuarios`
- [ ] Crear Server Actions básicas (obtener perfil, listar beneficios)
- [ ] Crear tipos TypeScript para todas las colecciones

**Entregable:** Usuario puede registrarse, login, y ver su perfil básico.

---

### Fase 2 — Motor Básico (Semana 3-4)

**Objetivo:** Beneficios automáticos y cupones funcionando.

- [ ] Implementar motor de beneficios (server-side)
- [ ] CRUD de beneficios en panel admin
- [ ] CRUD de cupones en panel admin
- [ ] Input de cupón en checkout
- [ ] Mostrar descuento en página de paquete
- [ ] Tracking de beneficios usados

**Entregable:** Admin puede crear beneficios y cupones, usuario puede ver y aplicar descuentos.

---

### Fase 3 — Motor Avanzado (Semana 5-6)

**Objetivo:** Motor de reglas configurable y sistema de tiers.

- [ ] CRUD de reglas en panel admin
- [ ] Constructor visual de reglas
- [ ] Sistema de tiers automático
- [ ] Notificaciones de beneficios desbloqueados
- [ ] Generador masivo de cupones
- [ ] Exclusiones y apilamiento

**Entregable:** Admin puede configurar reglas complejas sin código, sistema de tiers automático.

---

### Fase 4 — Optimización (Semana 7-8)

**Objetivo:** Reportes, analytics y pulido de UX.

- [ ] Dashboard con métricas
- [ ] Reportes exportables
- [ ] Notificaciones por email/WhatsApp
- [ ] Optimización de queries Firestore
- [ ] Tests del motor de beneficios
- [ ] Documentación de usuario final

**Entregable:** Sistema completo con reportes y notificaciones.

---

## 11. Consideraciones Clave

### 11.1 Performance

| Aspecto | Solución |
|---------|----------|
| Cálculo de beneficios | Server-side, cachear perfil de usuario |
| Contadores de cupones | Transacciones Firestore para evitar race conditions |
| Queries de beneficios | Índices compuestos en Firestore |
| Carga de página | Server Components para datos estáticos |

### 11.2 Escalabilidad

- El motor de reglas debe permitir agregar nuevos tipos sin cambiar código
- Los contadores de uso deben ser atómicos (transacciones)
- Las queries deben estar indexadas desde el inicio

### 11.3 UX

- Mostrar siempre el precio original tachado + precio con descuento
- Mostrar el ahorro total en el carrito
- Notificar beneficios desbloqueados de forma proactiva
- Permitir ver el historial de beneficios usados

### 11.4 Mantenibilidad

- Tipos TypeScript bien definidos
- Documentación de cada beneficio y regla
- Logs de evaluación de beneficios (para debug)
- Tests automatizados del motor de reglas

---

## 12. Glosario

| Término | Definición |
|---------|------------|
| **Beneficio** | Descuento o ventaja configurada por el admin |
| **Cupón** | Código canjeable con límites de uso |
| **Regla** | Condición configurable que activa un beneficio |
| **Tier** | Nivel de lealtad del usuario (bronce, plata, oro, platino) |
| **Apilamiento** | Aplicar múltiples beneficios a la misma reserva |
| **Exclusión** | Regla que impide combinar dos beneficios |
| **Motor de Reglas** | Sistema que evalúa condiciones y aplica beneficios |
| **Descuento** | Reducción de precio aplicada a una reserva |

---

## Anexos

### A. Ejemplos de Configuración

#### Ejemplo 1: Bienvenida + Cupón
```typescript
// Beneficio de bienvenida
{
  nombre: "Descuento Bienvenida",
  tipo: "bienvenida",
  config: {
    tipoDescuento: "porcentaje",
    valorDescuento: 20,
    condiciones: [{ campo: "primeraCompra", operador: "==", valor: true }]
  }
}

// Cupón de verano
{
  codigo: "VERANO50",
  tipoDescuento: "monto_fijo",
  valor: 5000, // $50 en centavos
  usosTotales: 100,
  usosPorUsuario: 1
}
```

#### Ejemplo 2: Tier Oro
```typescript
// Regla de tier
{
  nombre: "Beneficios Tier Oro",
  condiciones: [{ campo: "tier", operador: "==", valor: "oro" }],
  accion: { tipo: "descuento_porcentaje", valor: 10 }
}

// Configuración de tier
{
  oro: {
    minimoGasto: 500000, // $5000 en centavos
    beneficios: ["envio_gratis", "acceso_anticipado"]
  }
}
```

### B. Recursos Adicionales

- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Zod Validation](https://zod.dev/)

---

**Documento generado para el desarrollo del Sistema de Comunidad y Beneficios de Explorarg.**
