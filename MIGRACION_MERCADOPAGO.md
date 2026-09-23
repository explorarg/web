# Guía de Mercado Pago - Explorarg

## Resumen de Cambios Realizados

El proyecto opera con **Mercado Pago** como pasarela de pago principal para la experiencia de checkout de Explorarg en Argentina.

---

## 🆕 Nuevos Archivos Creados

### Backend (APIs)

| Archivo | Descripción |
|---------|-------------|
| `lib/mercadopago.ts` | Configuración y utilidades del SDK de Mercado Pago |
| `app/api/mercadopago/preference/route.ts` | Crea preferencias de pago y devuelve URL de checkout |
| `app/api/mercadopago/webhook/route.ts` | Recibe notificaciones de pago de Mercado Pago |

### Configuración

| Archivo | Cambios |
|---------|---------|
| `lib/site-config.json` | Actualizado con marca Explorarg (nombre, colores, contacto, textos) |
| `lib/emails/reserva-confirmada.ts` | Plantillas de email con marca Explorarg y voucher profesional |
| `components/landing-reserva/types.ts` | Agregados campos de Mercado Pago al tipo Reservation |

---

## 🔐 Variables de Entorno Requeridas

Agregar al archivo `.env.local`:

```bash
# ===============================
# MERCADO PAGO (Obligatorio)
# ===============================

# Access Token de Mercado Pago (obtener desde: https://www.mercadopago.com.ar/developers/panel)
# Usar credenciales de PRODUCCIÓN para pagos reales
# Usar credenciales de TEST (Sandbox) para pruebas
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxx

# Public Key (opcional, para Checkout Pro en frontend)
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxx

# URL del sitio (para webhooks)
NEXT_PUBLIC_SITE_URL=https://explorarg.com

# Email de soporte
SUPPORT_EMAIL=reservas@explorarg.com
```

---

## 🧪 Pasos para Probar en Ambiente de Sandbox

### 1. Crear cuenta de desarrollador en Mercado Pago

1. Ir a https://www.mercadopago.com.ar/developers
2. Crear cuenta o iniciar sesión
3. Ir a "Tu negocio" > "Configuración" > "Credenciales"
4. Copiar las credenciales de **Sandbox** (pruebas)

### 2. Configurar el webhook en Mercado Pago

1. En el panel de desarrollador, ir a "Tu negocio" > "Webhooks"
2. Agregar URL: `https://tusitio.com/api/mercadopago/webhook`
3. Seleccionar eventos:
   - `payment` (pagos)
4. Guardar

### 3. Probar el flujo completo

1. Crear una experiencia/paquete con reservas habilitadas
2. Configurar precio y fechas disponibles
3. Ir a la página pública de la experiencia
4. Seleccionar fecha y cantidad de personas
5. Completar datos del formulario
6. Pagar (usar tarjetas de prueba de Mercado Pago)

### Tarjetas de Prueba (Sandbox)

| Tarjeta | Número | Código | Vencimiento |
|---------|--------|--------|-------------|
| Mastercard | 5031 7557 3453 0604 | 123 | 11/25 |
| Visa | 4509 9535 6623 3704 | 123 | 11/25 |
| American Express | 3711 803032 57522 | 1234 | 11/25 |

Para simular estados específicos:
- Aprobado: Usar cualquier tarjeta de prueba
- Rechazado: Usar monto $11 ("monto rechazado")
- Pendiente: Usar monto $11,01 ("monto pendiente")

---

## 📊 Estructura de Datos en Firestore

### Nueva colección: `mercadoPagoNotifications`

Almacena logs de notificaciones recibidas:

```javascript
{
  notificationId: "mp_123456789_2024-01-15T10:30:00",
  type: "payment",
  action: "payment.created",
  paymentId: "1234567890",
  externalReference: "exp-abc123-1705315800000",
  reservationId: "mp_1234567890",
  status: "processed", // received | processed | ignored | failed
  reason: null,
  error: null,
  processedAt: Timestamp
}
```

### Campos agregados a `checkoutIntents`:

```javascript
{
  // ... campos existentes ...
  provider: "mercadopago",
  externalReference: "exp-xxx-timestamp",
  mercadoPagoPreferenceId: "abc123",
  mercadoPagoInitPoint: "https://mp.com/checkout",
  mercadoPagoPaymentId: "1234567890",
  mercadoPagoStatus: "approved"
}
```

### Campos agregados a `reservas`:

```javascript
{
  // ... campos existentes ...
  paymentMethod: "mercadopago",
  mercadoPagoPaymentId: "1234567890",
  mercadoPagoPreferenceId: "abc123",
  mercadoPagoStatus: "approved",
  mercadoPagoStatusDetail: "accredited",
  externalReference: "exp-xxx-timestamp",
  paidAt: Timestamp,
  voucherSent: true,
  voucherSentAt: Timestamp
}
```

---

## 🔄 Flujo de Pago con Mercado Pago

```
1. Usuario selecciona fecha y personas
   ↓
2. Frontend llama POST /api/mercadopago/preference
   ↓
3. Backend crea preferencia en MP
   ↓
4. Backend guarda checkoutIntent en Firestore
   ↓
5. Backend devuelve URL de checkout de MP
   ↓
6. Frontend redirige a Mercado Pago
   ↓
7. Usuario completa pago en MP
   ↓
8. MP redirige a /checkout/success (o /cancel)
   ↓
9. MP envía webhook POST /api/mercadopago/webhook
   ↓
10. Backend crea/actualiza reserva en Firestore
   ↓
11. Backend desconta cupos del stock
   ↓
12. Backend encola email de confirmación
   ↓
13. Cliente recibe voucher por email
```

---

## ⚠️ Consideraciones Importantes

### Seguridad

1. **Nunca exponer MERCADO_PAGO_ACCESS_TOKEN en el frontend**
   - Usar solo en backend (API routes)
   - El token tiene permisos para crear pagos y consultar datos

2. **Validar webhooks**
   - El webhook actual valida que venga de Mercado Pago mediante la estructura de la notificación
   - En producción, considerar agregar validación de firma si es necesario

3. **External Reference**
   - Es el ID único que vincula la preferencia con el pago
   - Permite idempotencia (evitar duplicar reservas)

### Estados de Pago

Mercado Pago tiene estos estados:

| Estado | Acción del sistema |
|--------|-------------------|
| `approved` | Reserva → completed, enviar voucher, descontar cupos |
| `pending` | Reserva → pending, esperar webhook posterior |
| `in_process` | Reserva → reserved, pendiente de acreditación |
| `rejected` | No crear reserva (o marcar como cancelled) |
| `cancelled` | No crear reserva |
| `refunded` | Reserva → cancelled, liberar cupos |

### Cupos y Stock

- Los cupos se descuentan **solo** cuando el pago está `approved`
- Reservas `pending` o `in_process` **no** descuentan cupos
- Si un pago es rechazado posteriormente, la reserva queda en `cancelled` pero los cupos ya fueron descontados (esto es intencional para evitar sobreventas)

---

## 🚀 Pasos para Producción

### 1. Obtener credenciales de producción

1. Ir a https://www.mercadopago.com.ar/developers
2. Ir a "Credenciales" y cambiar a "Producción"
3. Copiar Access Token de producción
4. Actualizar `.env.local`:
   ```
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxx
   ```

### 2. Configurar webhook de producción

1. En el panel de MP, ir a Webhooks
2. Agregar URL de producción: `https://explorarg.com/api/mercadopago/webhook`
3. Seleccionar evento `payment`
4. Guardar

### 3. Verificar limpieza del proyecto

Confirmar que:
- No queden variables de entorno legacy de proveedores anteriores
- No existan rutas ni jobs legacy de pagos anteriores
- La UI solo ofrezca Mercado Pago o flujos manuales donde corresponda

### 4. Pruebas en producción

Antes de habilitar para clientes:
1. Hacer una reserva con tarjeta real (monto mínimo)
2. Verificar que se cree la reserva en Firestore
3. Verificar que se envíe el email de confirmación
4. Verificar que se descuenten los cupos
5. Verificar que aparezca en el panel de admin

---

## 📧 Emails y Vouchers

Los emails ahora incluyen:
- Logo y branding de Explorarg
- Código de reserva único
- Datos completos del paquete
- WhatsApp directo para consultas
- Legajo RNAV de agencia habilitada
- Footer profesional

### Reenviar voucher manualmente

Desde el panel de admin, al cambiar una reserva a estado `completed`:
1. Verificar que `voucherSent` sea `false` (o forzar reenvío)
2. El sistema envía automáticamente el email de confirmación

---

## 🔧 Troubleshooting

### "Falta configurar MERCADO_PAGO_ACCESS_TOKEN"

Verificar que la variable esté definida en `.env.local` y reiniciar el servidor de desarrollo.

### "No se pudo crear la preferencia de pago"

Revisar logs del servidor. Posibles causas:
- Access token inválido o expirado
- Experiencia no tiene precio configurado
- Error de conexión con API de Mercado Pago

### Webhook no se recibe

1. Verificar que la URL del webhook esté accesible públicamente
2. Verificar que el endpoint responda con 200 OK
3. Revisar logs en `mercadoPagoNotifications` collection

### Reserva no se crea después del pago

1. Verificar que el webhook se recibió (colección `mercadoPagoNotifications`)
2. Verificar que el pago tenga estado `approved`
3. Revisar logs del webhook en la consola del servidor

### Emails no se envían

1. Verificar configuración de Resend (RESEND_API_KEY)
2. Verificar que existan documentos en colección `emailJobs`
3. El cron job de emails debe estar configurado para procesar la cola

---

## 📚 Documentación Adicional

- [Documentación oficial Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs)
- [API Reference - Preferencias](https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post)
- [API Reference - Pagos](https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_id/get)
- [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)

---

## ✨ Cambios Realizados por Fase

### Fase 1: Marca Explorarg ✅
- Actualizado `site-config.json` con nombre, colores, textos institucionales
- Configurados datos de contacto (email, teléfono, WhatsApp, dirección)
- Actualizados textos de servicios y beneficios
- SEO optimizado para "viajes argentina", "turismo"

### Fase 2: SDK Mercado Pago ✅
- Instalado SDK oficial de Mercado Pago
- Creado `lib/mercadopago.ts` con:
  - Configuración del cliente
  - Creación de preferencias
  - Consulta de pagos
  - Mapeo de estados

### Fase 3: API de Preferencias ✅
- Creado `app/api/mercadopago/preference/route.ts`
- Valida cupos disponibles antes de crear preferencia
- Crea checkoutIntent para trazabilidad
- Devuelve URL de checkout de Mercado Pago

### Fase 4: Webhook de Notificaciones ✅
- Creado `app/api/mercadopago/webhook/route.ts`
- Procesa notificaciones de tipo `payment`
- Crea/actualiza reservas automáticamente
- Desconta cupos cuando el pago es aprobado
- Encola emails de confirmación
- Guarda logs de todas las notificaciones

### Fase 5: Tipos Actualizados ✅
- Actualizado tipo `Reservation` con campos de Mercado Pago
- Agregados campos de voucher (`voucherSent`, `voucherSentAt`, `paidAt`)

### Fase 6: Emails Profesionales ✅
- Rediseñado voucher de reserva con marca Explorarg
- Header con gradiente y logo
- Badge de "Reserva Confirmada"
- Layout profesional con tablas estilizadas
- Footer con datos legales (Legajo RNAV)

---

**Fecha de migración:** Mayo 2026  
**Desarrollado por:** Tucs Digital para Explorarg
