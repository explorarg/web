# 📊 Diagnóstico Completo del Proyecto

**Fecha de generación:** Mayo 2026  
**Proyecto:** Viajes y Turismo (exploarg)  
**Framework:** Next.js 16 + React 19 + TypeScript  
**Base de datos:** Firebase Firestore  

---

## 📋 Índice

1. [Visión General](#-visión-general)
2. [Estructura de Secciones](#-estructura-de-secciones)
3. [Frontend Público](#-frontend-público)
4. [Panel de Administración](#-panel-de-administración)
5. [Portal de Vendedores](#-portal-de-vendedores)
6. [Sistema de Reservas](#-sistema-de-reservas)
7. [APIs y Endpoints](#-apis-y-endpoints)
8. [Base de Datos](#-base-de-datos)
9. [Autenticación y Seguridad](#-autenticación-y-seguridad)
10. [Integraciones Externas](#-integraciones-externas)
11. [Herramientas y Utilidades](#-herramientas-y-utilidades)
12. [Configuración del Sistema](#-configuración-del-sistema)

---

## 🎯 Visión General

Aplicación web completa para agencia de viajes con múltiples roles de usuario:
- **Visitantes:** Pueden navegar paquetes, buscar, filtrar y contactar
- **Clientes:** Pueden realizar reservas y pagos online
- **Vendedores:** Portal propio con seguimiento de comisiones
- **Administradores:** Control total del contenido y reservas

### Stack Tecnológico Principal

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Frontend** | React 19, TypeScript, Tailwind CSS 4 |
| **UI Components** | shadcn/ui + Radix UI primitives |
| **Base de Datos** | Firebase Firestore (NoSQL) |
| **Autenticación** | Firebase Authentication |
| **Pagos** | Mercado Pago + ventas manuales |
| **Almacenamiento** | Cloudflare R2 (imágenes) |
| **Emails** | Resend API |
| **Animaciones** | Framer Motion |

---

## 🗂️ Estructura de Secciones

```
app/
├── 📱 Frontend Público
│   ├── page.tsx              # Homepage
│   ├── paquetes/             # Listado de paquetes con filtros
│   ├── paquete/[slug]/       # Detalle de paquete
│   ├── categoria/[slug]/     # Página de categoría
│   ├── blog/                 # Blog/Noticias
│   ├── contacto/             # Formulario de contacto
│   ├── experiencias/         # Landing pages de experiencias
│   ├── checkout/             # Flujo de pago
│   ├── login/                # Login clientes
│   ├── registro/             # Registro clientes
│   └── user/                 # Peril de usuario
│
├── 🔐 Panel de Administración
│   └── admin/
│       ├── page.tsx          # Dashboard
│       ├── login/            # Login admin
│       ├── paquetes/         # CRUD paquetes
│       ├── categorias/       # CRUD categorías
│       ├── experiencias/     # CRUD experiencias
│       ├── reservas/         # Gestión de reservas
│       ├── clientes/         # Gestión de clientes
│       ├── consultas/        # Consultas recibidas
│       ├── newsletter/       # Suscriptores newsletter
│       ├── vendedores/       # Gestión de vendedores
│       ├── referidos/        # Seguimiento de referidos
│       ├── stock/            # Control de stock/cupos
│       ├── banners/          # Gestión de banners
│       ├── blog/             # Gestión de posts
│       └── documentacion/    # Docs internas
│
└── 💼 Portal de Vendedores
    └── vendedor/
        ├── page.tsx          # Dashboard vendedor
        ├── login/            # Login vendedores
        ├── reservas/         # Sus reservas referidas
        └── enlaces/          # Links de referido
```

---

## 🌐 Frontend Público

### Páginas Principales

| Ruta | Descripción | Funcionalidades |
|------|-------------|-----------------|
| `/` | Homepage | Hero search, paquetes destacados, categorías, newsletter |
| `/paquetes` | Catálogo | Filtros avanzados (categoría, tipo, destino, precio), búsqueda, ordenamiento |
| `/paquete/[slug]` | Detalle | Galería, descripción rica, salidas, CTAs WhatsApp/Reserva, schema SEO |
| `/categoria/[slug]` | Categoría | Listado de paquetes por categoría |
| `/blog` | Blog | Posts de blog con contenido enriquecido |
| `/contacto` | Contacto | Formulario de contacto + info de empresa |
| `/experiencias/[slug]` | Landing | Páginas de conversión para experiencias específicas |
| `/checkout` | Checkout | Flujo de reserva y pago (Mercado Pago) |

### Funcionalidades del Frontend

- ✅ **Búsqueda en tiempo real** por título, destino, descripción
- ✅ **Filtros combinados:** categoría, tipo (individual/grupal/a-medida/internacional/educativo/eventos/recitales), destino, servicios incluidos
- ✅ **Galerías de imágenes** con lightbox
- ✅ **Integración WhatsApp** con mensajes predefinidos
- ✅ **Formularios validados** con Zod + React Hook Form
- ✅ **Diseño 100% responsive** (mobile-first)
- ✅ **SEO optimizado:** metadata dinámica, Schema.org, sitemap, Open Graph
- ✅ **Schema.org:** generación automática de structured data para paquetes turísticos

### Componentes Principales

```
components/
├── Hero.tsx                    # Hero section con imágenes responsive
├── HeroSearch.tsx              # Búsqueda en hero
├── HomeClient.tsx              # Homepage interactiva
├── PaquetesClient.tsx          # Cliente de listado con filtros
├── PaqueteCard.tsx             # Tarjeta de paquete
├── PaqueteHero.tsx             # Hero de detalle de paquete
├── PaqueteSidebar.tsx          # Sidebar con precio y CTAs
├── ImageGallery.tsx            # Galería con lightbox
├── ConsultaModal.tsx           # Modal de consulta rápida
├── ContactForm.tsx             # Formulario de contacto
├── Footer.tsx                  # Pie de página
├── Navbar.tsx                  # Navegación principal
├── WhatsAppButton.tsx          # Botón flotante WhatsApp
├── SchemaOrg.tsx               # Schema.org dinámico
├── ShareBar.tsx                # Botones de compartir
├── PageTransition.tsx          # Transiciones de página
├── ScrollSmoother.tsx          # Scroll suave (Lenis)
├── BlogCard.tsx                # Tarjeta de blog
├── BlogListClient.tsx          # Listado de blog
├── F1PaqueteContent.tsx        # Contenido especial F1
├── F1TicketModal.tsx             # Modal tickets F1
└── ui/                         # Componentes shadcn/ui
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── form.tsx
    ├── input.tsx
    ├── select.tsx
    ├── table.tsx
    └── ... (18 componentes base)
```

---

## 🔐 Panel de Administración

### Secciones del Admin

| Sección | Ruta | Funcionalidades |
|---------|------|-----------------|
| **Dashboard** | `/admin` | Estadísticas, reservas recientes, accesos rápidos |
| **Paquetes** | `/admin/paquetes` | CRUD completo, editor Tiptap, salidas, imágenes múltiples, ordenamiento drag & drop |
| **Categorías** | `/admin/categorias` | CRUD, subida de imágenes, ordenamiento, destacados |
| **Experiencias** | `/admin/experiencias` | CRUD experiencias con configuración de reservas |
| **Reservas** | `/admin/reservas` | Gestión de reservas, cambio de estado, adjuntos, historial |
| **Clientes** | `/admin/clientes` | Listado de clientes registrados |
| **Consultas** | `/admin/consultas` | Mensajes de contacto, marcar como leídas |
| **Newsletter** | `/admin/newsletter` | Suscriptores, exportación |
| **Vendedores** | `/admin/vendedores` | CRUD vendedores, configuración de comisiones |
| **Referidos** | `/admin/referidos` | Seguimiento de ventas por referido |
| **Stock** | `/admin/stock` | Control de cupos por fecha |
| **Banners** | `/admin/banners` | Gestión de banners publicitarios |
| **Blog** | `/admin/blog` | CRUD posts de blog |

### Componentes del Admin

```
components/admin/
├── AdminLayout.tsx              # Layout con navegación lateral
├── ProtectedRoute.tsx             # Guard de autenticación
├── AdminPagination.tsx            # Paginación de tablas
├── AdminReservaForm.tsx           # Formulario de reserva (admin)
├── AdminTestimonialsSection.tsx   # Gestión de testimonios
├── BookingCalendarAdmin.tsx       # Calendario de reservas
├── DragDropOrderManager.tsx       # Reordenamiento drag & drop
├── DragDropTable.tsx              # Tabla con drag & drop
├── EditableList.tsx               # Lista editable inline
├── ImageUploader.tsx              # Subida de imágenes a R2
├── OrderManager.tsx               # Gestión de órdenes
├── RichTextEditor.tsx             # Editor Tiptap con toolbar
├── SalidasManager.tsx             # Gestión de fechas de salida
├── StockDashboard.tsx             # Dashboard de stock
├── TestimonialLibraryModal.tsx    # Biblioteca de testimonios
└── VideoSectionAdmin.tsx          # Gestión de videos
```

### Funcionalidades Específicas del Admin

- ✅ **Editor de texto rico (Tiptap):** con imágenes, videos YouTube, links, alineación
- ✅ **Gestión de salidas:** fechas de ida/vuelta, precios por salida, cupos, observaciones
- ✅ **Sistema de "incluye/no incluye":** lista de servicios
- ✅ **Destino automático:** se obtiene del nombre de la categoría seleccionada
- ✅ **Máximo 9 paquetes destacados** en homepage
- ✅ **Reordenamiento drag & drop** de paquetes y categorías
- ✅ **Control de visibilidad:** publicar/ocultar paquetes
- ✅ **Gestión de reservas:** crear manualmente, cambiar estado, adjuntar archivos

---

## 💼 Portal de Vendedores

### Funcionalidades

| Ruta | Descripción |
|------|-------------|
| `/vendedor` | Dashboard con resumen de ventas y comisiones |
| `/vendedor/login` | Login para vendedores |
| `/vendedor/reservas` | Listado de reservas referidas |
| `/vendedor/enlaces` | Generación de links de referido |

### Características del Portal

- ✅ **Sistema de referidos:** cada vendedor tiene código único
- ✅ **Comisiones configurables:** porcentaje o monto fijo por venta
- ✅ **Tracking de conversiones:** seguimiento de ventas por link
- ✅ **Dashboard de métricas:** ventas totales, comisiones acumuladas
- ✅ **Restricción por experiencia:** vendedores pueden tener acceso limitado a ciertas experiencias
- ✅ **Estados de pago:** pending → accrued → paid

### Modelo de Comisiones

```typescript
// Comisión por porcentaje
{ type: 'percent', value: 10, currency: 'ars' } // 10% de comisión

// Comisión fija
{ type: 'fixed', value: 5000, currency: 'ars' } // $50 ARS fijos
```

---

## 🎫 Sistema de Reservas

### Flujo de Reserva

1. **Landing/Experiencia** → Usuario selecciona fecha y cantidad de personas
2. **Widget de Reserva** → Configuración de reserva (depósito, métodos de pago)
3. **Checkout** → Mercado Pago
4. **Confirmación** → Email automático + registro en Firestore
5. **Webhook Mercado Pago** → Actualización automática de estado

### Estados de Reserva

| Estado | Descripción |
|--------|-------------|
| `pending` | Pendiente de pago |
| `reserved` | Pagado (seña/depósito) |
| `completed` | Completado/confirmado |
| `cancelled` | Cancelado/reembolsado |

### Métodos de Pago

- **Mercado Pago:** Checkout principal para pagos online
- **Admin:** Reservas manuales creadas desde el panel

### Configuración de Reservas por Experiencia

```typescript
interface BookingConfig {
  enabled: boolean;                    // Reservas activadas
  title: string;                       // Título del widget
  subtitle1: string;                     // Subtítulo superior
  subtitle2: string;                   // Subtítulo inferior
  hasSpecificDates: boolean;            // Fechas específicas o flexibles
  dates: BookingDate[];                // Fechas disponibles con cupos
  depositAmount: number;               // Monto de seña (en centavos)
  maxPeoplePerBooking?: number;        // Límite de personas
  currency: 'ars' | 'brl' | 'usd';     // Moneda
  paymentMethods: {
    mercadoPago: boolean;              // Pago online con Mercado Pago
  };
  referralCommission?: {               // Comisión especial para esta experiencia
    type: 'percent' | 'fixed';
    value: number;
    currency: BookingCurrency;
  };
}
```

---

## 🔌 APIs y Endpoints

### Estructura de APIs

```
app/api/
├── admin/
│   ├── referidos/           # Gestión de referidos
│   ├── reservas/            # CRUD reservas admin
│   ├── stock/               # Control de stock
│   └── vendors/             # CRUD vendedores
├── checkout/
│   ├── finalize/            # Finalizar checkout
│   ├── status/              # Estado de reserva
│   └── verify/              # Verificar reserva
├── cron/
│   ├── email/               # Envío de emails programados
│   └── emails/              # Cola de emails
├── mercadopago/
│   ├── preference/          # Crear preferencia de pago
│   └── webhook/             # Webhook de Mercado Pago
├── debug/                   # Endpoints de debug
├── delete-image/            # Eliminar imágenes
├── experiencias/            # APIs de experiencias
├── home/                    # Datos de homepage
├── testimonials/            # Testimonios
├── upload/                  # Subida de archivos
└── vendor/                  # APIs para vendedores
```

### Endpoints Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/checkout/verify` | POST | Verificar disponibilidad antes de checkout |
| `/api/checkout/finalize` | POST | Completar reserva después de pago |
| `/api/mercadopago/preference` | POST | Crear preferencia de pago |
| `/api/mercadopago/webhook` | POST | Recibir eventos de Mercado Pago |
| `/api/upload` | POST | Subir imágenes a R2 |
| `/api/delete-image` | POST | Eliminar imágenes de R2 |
| `/api/admin/reservas` | GET/POST | CRUD reservas (admin) |
| `/api/admin/vendors` | GET/POST/PUT/DELETE | CRUD vendedores |
| `/api/vendor/` | GET | Datos para portal vendedor |

---

## 🗄️ Base de Datos

### Colecciones Firestore

| Colección | Propósito | Documentos Clave |
|-----------|-----------|------------------|
| `paquetes` | Paquetes turísticos | Datos, precios, salidas, imágenes |
| `categorias` | Categorías de paquetes | Nombre, orden, imagen, estado |
| `experiencias` | Experiencias reservables | Landing pages con configuración de reserva |
| `reservas` | Reservas de clientes | Datos del cliente, pago, estado, historial |
| `clientes` | Perfiles de clientes | Datos de contacto, historial |
| `consultas` | Mensajes de contacto | Formulario de contacto |
| `newsletter` | Suscriptores | Emails suscritos |
| `vendors` | Vendedores/referidos | Datos, comisiones, estado |
| `referralLinks` | Links de referido | Código, vendedor, experiencia |
| `blog` | Posts de blog | Contenido, imágenes, estado |

### Modelo de Datos Principal

```typescript
// Paquete turístico
interface Paquete {
  id: string;
  titulo: string;
  slug: string;
  descripcion: string;              // HTML del editor rico
  descripcionCorta?: string;
  destino?: string;                 // Automático desde categoría
  categoriaId?: string;
  categoriaIds?: string[];          // Múltiples categorías
  tipo: 'individual' | 'grupal' | 'a-medida' | 'internacional' | 'educativo' | 'eventos' | 'recitales';
  tipos?: Array<...>;              // Múltiples tipos
  precio: number;
  precioDescuentoPrimerosCupos?: number;
  moneda: 'USD' | 'ARS' | 'EUR';
  mostrarDesde: boolean;           // Mostrar "Desde $X"
  duracion: string;
  incluye: string[];
  noIncluye: string[];
  tiposTransporte?: string[];
  salidas: Salida[];
  imagenPrincipal: string;         // URL de R2
  imagenTarjeta?: string;
  imagenPortada?: string;
  galeria: string[];
  tickets?: TicketPack[];        // Tickets F1/Eventos
  condiciones?: PaqueteCondicion[];
  visible: boolean;
  destacado: boolean;
  orden: number;
  ctaWhatsApp: boolean;
  fechaCreacion: Timestamp;
}

// Reserva
interface Reservation {
  id: string;
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  date: string;                    // YYYY-MM-DD o "sin-fecha"
  people: number;
  amountTotal: number;             // Monto total de la reserva
  currency: 'ars' | 'brl' | 'usd';
  paymentMethod: 'mercadopago' | 'admin';
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  customerCountry?: string;
  customerDocument?: string;
  customerComments?: string;
  status: 'pending' | 'reserved' | 'completed' | 'cancelled';
  statusHistory: ReservationHistoryItem[];
  attachments?: ReservationAttachment[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdByAdmin?: boolean;
  referredBy?: ReservationReferralInfo;  // Info de referido
  
  // Snapshots para auditoría
  pricingSnapshot?: ReservationPricingSnapshot;
  capacitySnapshot?: ReservationCapacitySnapshot;
  experienceSnapshot?: ReservationExperienceSnapshot;
}

// Vendedor
interface Vendor {
  id: string;
  name: string;
  email: string;
  active: boolean;
  defaultCommission: {
    type: 'percent' | 'fixed';
    value: number;
    currency: 'ars' | 'brl' | 'usd';
  };
  allowedExperiences?: string[] | null;  // Null = todas
  paymentDetails?: {
    cbu?: string;
    alias?: string;
    mercadoPagoEmail?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🔒 Autenticación y Seguridad

### Sistema de Auth

| Rol | Método | Acceso |
|-----|--------|--------|
| **Admin** | Firebase Auth (email/password) | Panel completo |
| **Vendedor** | Firebase Auth (email/password) | Portal de vendedor |
| **Cliente** | Firebase Auth (email/password o Google) | Checkout y perfil |

### Medidas de Seguridad

```
lib/auth/
├── authConfig.ts              # Configuración de persistencia y timeouts
├── sessionManager.ts          # Gestión de sesiones en localStorage
└── securityMiddleware.ts      # Validaciones de seguridad
```

- ✅ **Persistencia configurable:** Local (recordarme) vs Session
- ✅ **Timeout de sesión:** 24 horas de inactividad
- ✅ **Validación de dominio:** Solo dominios permitidos para admin
- ✅ **Rate limiting:** Máximo 5 intentos de login fallidos (bloqueo 15 min)
- ✅ **Device fingerprinting:** Identificación única de dispositivos
- ✅ **Lazy loading de Auth:** Auth de Firebase solo carga en páginas protegidas

### Protección de Rutas

```typescript
// Admin
<ProtectedRoute>
  <AdminLayout>...</AdminLayout>
</ProtectedRoute>

// Vendedor
<VendorProtectedRoute>
  <VendorLayout>...</VendorLayout>
</VendorProtectedRoute>
```

---

## 🔗 Integraciones Externas

### 1. Mercado Pago (Pagos)

```typescript
// lib/mercadopago.ts
- Configuración del SDK de Mercado Pago
- Utilidades para preferencias y consultas de pago
```

- Checkout Pro para pagos online
- Webhooks para confirmaciones automáticas
- Integración con reservas y ventas

### 2. Cloudflare R2 (Imágenes)

```typescript
// lib/blob.ts, lib/utils/upload.ts
- Upload de imágenes desde admin
- URLs públicas con CDN
- Eliminación automática al borrar recursos
```

### 3. Firebase

```typescript
// lib/firebase.ts
- Firestore: Base de datos NoSQL
- Auth: Autenticación de usuarios
- Lazy loading: Auth solo en rutas protegidas
```

### 4. Resend (Emails)

```typescript
// lib/resend.ts, lib/emails/
- Confirmaciones de reserva
- Notificaciones a admin
- Emails transaccionales
```

### 5. WhatsApp

```typescript
// lib/utils/whatsapp.ts
- Links de WhatsApp con mensaje predefinido
- Botón flotante en todas las páginas
- CTAs en páginas de paquetes
```

---

## 🛠️ Herramientas y Utilidades

### Utilidades Principales

```
lib/utils/
├── blob.ts                    # Gestión de Cloudflare R2
├── clientes.ts                # CRUD de clientes
├── currency.ts                # Formateo de monedas
├── deleteImages.ts            # Eliminación de imágenes
├── imageValidation.ts         # Validación de imágenes
├── packageFeatures.tsx        # Features de paquetes
├── phoneNumber.ts             # Formateo de teléfonos
├── serialize.ts               # Serialización Firestore
├── slugify.ts                 # Generación de slugs
├── upload.ts                  # Subida de archivos
└── whatsapp.ts                # Generación de links WhatsApp
```

### Funciones Destacadas

| Utilidad | Propósito |
|----------|-----------|
| `serialize.ts` | Convierte Timestamps de Firestore a objetos serializables para Next.js |
| `slugify.ts` | Genera slugs URL-friendly a partir de títulos |
| `upload.ts` | Subida de imágenes a R2 con validación |
| `deleteImages.ts` | Limpieza de imágenes huérfanas |
| `currency.ts` | Formateo de precios por moneda |

### Hooks Personalizados

```typescript
// hooks/useAuth.ts
export function useAuth() {
  return { user, loading, logout, sessionManager };
}
```

- ✅ Gestión de estado de autenticación
- ✅ Persistencia de sesión
- ✅ Logout seguro

---

## ⚙️ Configuración del Sistema

### Variables de Entorno Requeridas

```bash
# Firebase (públicas - usadas en cliente)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Mercado Pago (servidor)
MERCADO_PAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=

# Cloudflare R2 (servidor)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_BASE=

# Resend (servidor)
RESEND_API_KEY=

# Configuración del sitio (públicas)
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_ADMIN_EMAIL=
```

### Configuración del Sitio

```typescript
// lib/siteConfig.ts
- Nombre del sitio
- Descripción
- Colores de marca
- Información de contacto
- Redes sociales
- Datos legales (CUIT, Razón social)
- Contenido de secciones (hero, servicios, valores, about)
```

### Configuración Next.js

```typescript
// next.config.ts
- Optimización de imágenes (WebP/AVIF)
- Cache de 1 año para imágenes
- Server Actions con límite de 10MB
- Optimización de imports (lucide-react)
- Remove console en producción
```

---

## 📊 Resumen de Funcionalidades

### Por Tipo de Usuario

| Funcionalidad | Visitante | Cliente | Vendedor | Admin |
|--------------|-----------|---------|----------|-------|
| Ver paquetes | ✅ | ✅ | ✅ | ✅ |
| Buscar/Filtrar | ✅ | ✅ | ✅ | ✅ |
| Contactar WhatsApp | ✅ | ✅ | ✅ | ✅ |
| Reservar/Pagar | ❌ | ✅ | ❌ | ✅ |
| Ver perfil | ❌ | ✅ | ✅ | ✅ |
| Dashboard | ❌ | ❌ | ✅ | ✅ |
| Crear paquetes | ❌ | ❌ | ❌ | ✅ |
| Gestionar reservas | ❌ | ❌ | ❌ | ✅ |
| Ver comisiones | ❌ | ❌ | ✅ | ✅ |
| Generar referidos | ❌ | ❌ | ✅ | ✅ |
| Gestión de vendedores | ❌ | ❌ | ❌ | ✅ |
| Blog/Newsletter | ❌ | ❌ | ❌ | ✅ |

### Estado de Implementación

| Módulo | Estado | Notas |
|--------|--------|-------|
| Frontend público | ✅ Completo | SEO, responsive, filtros avanzados |
| Panel admin | ✅ Completo | CRUD completo, editor rico, drag & drop |
| Portal vendedores | ✅ Completo | Dashboard, comisiones, referidos |
| Sistema de reservas | ✅ Completo | Mercado Pago, webhooks, emails |
| Base de datos | ✅ Configurada | Firestore con índices |
| Almacenamiento imágenes | ✅ Configurado | Cloudflare R2 |
| Autenticación | ✅ Implementada | Firebase Auth con sesiones seguras |
| Emails transaccionales | ✅ Configurado | Resend API |

---

## 🔄 Flujos de Trabajo Clave

### 1. Creación de Paquete (Admin)

```
1. Admin accede a /admin/paquetes/nuevo
2. Completa formulario (título, descripción Tiptap, imágenes)
3. Selecciona categoría (destino se asigna automáticamente)
4. Configura salidas (fechas, precios, cupos)
5. Define "incluye/no incluye"
6. Activa/desactiva visibilidad
7. Guarda → Registro en Firestore
```

### 2. Proceso de Reserva (Cliente)

```
1. Cliente navega experiencia
2. Selecciona fecha y cantidad de personas
3. Ingresa datos personales
4. Selecciona método de pago (Mercado Pago)
5. Paga → Webhook de Mercado Pago confirma
6. Reserva creada en Firestore (status: reserved)
7. Email de confirmación enviado
```

### 3. Sistema de Referidos (Vendedor)

```
1. Admin crea vendedor en /admin/vendedores
2. Vendedor inicia sesión en /vendedor/login
3. Genera link de referido para experiencia específica
4. Comparte link con cliente
5. Cliente reserva usando link
6. Sistema calcula comisión automáticamente
7. Vendedor ve venta en su dashboard
```

---

## 📝 Notas Técnicas Importantes

### Optimizaciones Implementadas

- ✅ **Lazy loading de Firebase Auth:** Solo carga en rutas protegidas, evita iframe.js en público
- ✅ **Optimización de imágenes:** Next.js Image con WebP/AVIF, cache 1 año
- ✅ **Serialización Firestore:** Conversión automática de Timestamps a strings para SSR
- ✅ **Debounced search:** Búsqueda con debounce para evitar re-renders
- ✅ **Pagination:** Tablas paginadas para grandes volúmenes de datos
- ✅ **Server Components:** Uso extensivo de Server Components de Next.js

### Limitaciones Conocidas

- Máximo 9 paquetes destacados en homepage
- Las imágenes se almacenan en R2 (no en Firebase Storage)
- El destino se sincroniza con la categoría pero no se actualiza automáticamente si cambia el nombre
- Los índices compuestos de Firestore deben crearse manualmente en Firebase Console

### Requisitos de Firebase

Índices compuestos necesarios:

```
paquetes:
  - visible (asc) + destacado (asc) + orden (asc)
  - categoriaId (asc) + visible (asc) + orden (asc)

categorias:
  - activa (asc) + destacada (asc) + orden (asc)

reservas:
  - experienceId (asc) + status (asc) + createdAt (desc)
  - referredBy.vendorId (asc) + createdAt (desc)
```

---

## 🚀 Próximas Mejoras Sugeridas

- [ ] Actualización automática de destino cuando cambia el nombre de categoría
- [ ] Sistema de notificaciones push para nuevas reservas
- [ ] Exportación de datos a CSV (reservas, vendedores)
- [ ] Sistema de backup automático de Firestore
- [ ] Analytics integrado (Google Analytics 4 / Plausible)
- [ ] Sistema de reviews/ratings de clientes
- [ ] Chat en vivo para atención al cliente
- [ ] App móvil (PWA)

---

**Documento generado automáticamente para diagnóstico del proyecto.**
