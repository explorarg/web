# Debug Session: mp-webhook-order
- **Status**: [OPEN]
- **Issue**: Mercado Pago redirige con pago aprobado, pero la orden puede quedar en `created` o tardar en reflejar `paid` en Firestore.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-mp-webhook-order.ndjson

## Reproduction Steps
1. Iniciar checkout con carrito real.
2. Pagar con Mercado Pago hasta obtener redirección a `/checkout/success?orderId=...&status=approved`.
3. Verificar si `orders/<orderId>` queda en `created` o `checkout_started`.
4. Confirmar si llega y se procesa `POST /api/mercadopago/webhook`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Mercado Pago no está enviando el webhook a la URL configurada | High | Low | Pending |
| B | El webhook llega, pero el endpoint lo rechaza o falla antes de actualizar la orden | High | Low | Pending |
| C | El webhook procesa el pago, pero no encuentra `checkoutIntent` u `order` y sale por rama `ignored` | High | Low | Pending |
| D | El webhook actualiza la reserva pero no la orden por una condición de transacción o idempotencia | Medium | Medium | Pending |
| E | La orden sí se actualiza, pero la lectura posterior usa datos viejos o inconsistentes | Low | Low | Pending |

## Log Evidence
- `GET https://explorarg.vercel.app/api/orders/hfzjqdtIhNgcFtBwqZif` devuelve `status: "checkout_started"` y `payment.status: "created"` después del pago aprobado.
- `GET https://explorarg.vercel.app/api/mercadopago/webhook?challenge=test` responde correctamente, por lo que el endpoint público existe.
- `GET https://explorarg.com/api/mercadopago/webhook` no responde y `https://explorarg.com/checkout/success?...` muestra error.
- `components/checkout/CheckoutClient.tsx` arma `successUrl` y `pendingUrl` con `window.location.origin`.
- `app/api/mercadopago/preference/route.ts` armaba `notification_url` con `NEXT_PUBLIC_SITE_URL` o fallback.
- `POST https://explorarg.vercel.app/api/orders/reconcile` devuelve `405 Method Not Allowed` y `X-Matched-Path: /api/orders/[orderId]`, señal de que la ruta de reconciliación todavía no está desplegada en producción.
- `GET https://explorarg.vercel.app/checkout/success?...external_reference=order-dQAnSd6uXc8qFzftIvsz...` devuelve aún el texto `No detectamos el identificador de sesión`, confirmando que producción no estaba resolviendo `orderId` desde `external_reference`.
- `/admin/ventas` estaba cargando `reservas` y `orders` directo desde el navegador; se migra a `GET /api/admin/ventas` autenticado para evitar inconsistencias de lectura cliente.

## Verification Conclusion
- Hipótesis A: Muy probable. Si `NEXT_PUBLIC_SITE_URL` está en `https://explorarg.com` o falta y cae al default, Mercado Pago notifica a un dominio caído.
- Hipótesis B: Posible, pero menos probable con la evidencia actual porque no hay señales de actualización parcial en la orden.
- Hipótesis C: Posible, aunque no hay evidencia directa todavía.
- Hipótesis D: Poco probable con la evidencia actual.
- Hipótesis E: Rechazada para el caso observado; la orden realmente sigue en `checkout_started`.
- Evidencia adicional: `admin/ventas` reutiliza `admin/reservas` y lista `reservas`, no `orders`; por eso una orden en `checkout_started` nunca aparece como venta.

## Fix Applied
- `app/api/mercadopago/preference/route.ts` ahora resuelve el `baseUrl` desde el origen real de la request (`x-forwarded-host` / `request.url`) y usa ese valor para `notification_url`, `successUrl` y `pendingUrl` fallback.
- Se mantuvo instrumentación temporal en `preference`, `webhook` y `orders/[orderId]` para verificar el recorrido en la próxima reproducción.
- Se agregó `app/api/orders/reconcile/route.ts` para reinyectar por backend una orden aprobada pero no materializada, reutilizando el mismo procesador del webhook.
- `components/checkout/OrderVerification.tsx` ahora intenta esa reconciliación una sola vez cuando Mercado Pago ya devolvió `approved` pero la orden sigue sin cerrar.
- `app/checkout/success/page.tsx` ahora reconstruye `orderId` desde `external_reference`, muestra `paymentId`, `merchantOrderId` y `preferenceId`, y deja de caer a la rama “sin identificador de sesión” cuando la URL de MP sí trae la referencia de orden.
- Se agregó `app/api/admin/ventas/route.ts` y `app/admin/reservas/page.tsx` ahora consume ventas desde ese endpoint admin autenticado, devolviendo `reservas + orders` de forma consistente.
