# Debug Session: mp-preference-500
- **Status**: [OPEN]
- **Issue**: `POST /api/mercadopago/preference` responde 500 durante el checkout con carrito activo.
- **Debug Server**: Pending
- **Log File**: .dbg/trae-debug-log-mp-preference-500.ndjson

## Reproduction Steps
1. Seleccionar fecha y butacas.
2. Llegar al checkout con carrito activo.
3. Completar datos del titular y enviar la creación de preferencia.
4. Observar `POST /api/mercadopago/preference 500`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Mercado Pago rechaza el `payer` o algún `item` enviado en la preferencia. | High | Low | Rejected |
| B | El total económico del carrito y los `items` armados para Mercado Pago no coinciden. | High | Medium | Rejected |
| C | El endpoint rompe antes de llamar a Mercado Pago por un dato persistido con formato inesperado en `cart/items`. | Medium | Low | Rejected |
| D | El error ocurre sólo en la rama `cartId` del endpoint y la rama directa funciona. | Medium | Low | Rejected |
| E | El frontend no está mostrando el `detail` del 500 y nos deja sin visibilidad del rechazo real. | Medium | Low | Confirmed |
| F | Mercado Pago rechaza `auto_return: "approved"` cuando `back_urls.success` apunta a `localhost` o red privada. | High | Low | Confirmed |

## Log Evidence
- Pre-fix request reproducida contra `cartId=1aIh26D5V5TLuvJiVR3k`: `{"error":"No se pudo crear la preferencia de pago.","detail":{"message":"auto_return invalid. back_url.success must be defined","error":"invalid_auto_return","status":400,"cause":null}}`
- Instrumentación pre-fix registró:
  - `preference POST received`
  - `creating Mercado Pago preference`
  - `Mercado Pago preference failed`
- El payload armado para Mercado Pago incluía `successUrl=http://localhost:3000/...`, `amountTotal=3310000` y `mpItemsPreview` coherente con base + extras.
- Post-fix request reproducida contra el mismo `cartId`: devolvió `url`, `preferenceId`, `intentId` y `orderId` correctamente.

## Verification Conclusion
- Causa raíz confirmada: `lib/mercadopago.ts` forzaba `auto_return: "approved"` incluso cuando el `successUrl` era local, y Mercado Pago rechazaba esa combinación.
- Fix aplicado:
  - `lib/mercadopago.ts` ya no fuerza `auto_return` por default.
  - `app/api/mercadopago/preference/route.ts` sólo envía `auto_return: "approved"` cuando el `successUrl` es público, no `localhost` ni red privada.
- Estado: pendiente de confirmación del usuario en UI/flujo real.
