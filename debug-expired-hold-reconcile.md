# Debug Session: expired-hold-reconcile
- **Status**: [OPEN]
- **Issue**: Una orden con pago aprobado queda como `checkout_started` y no se materializa en `reserva` porque el `reservationHold` vence antes de completar el webhook o la reconciliación.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Evidence |
|----|------------|------------|----------|
| A | El pago está aprobado, pero la validación de `expiresAt` del `reservationHold` bloquea la materialización | High | Pending |
| B | Las butacas siguen asignadas al mismo `holdId`, por lo que se puede rescatar sin sobreventa | High | Pending |
| C | El reconciliador falla antes por falta de datos en `cartItems` o `seatReservations` | Medium | Pending |
| D | La compra vieja no se puede rescatar porque el flujo libera los asientos antes de intentar reservar | Medium | Pending |
| E | La UI pública desplegada no incluye todavía el último cambio de simplificación | High | Pending |

## Evidence
- `POST /api/orders/reconcile` para la orden `dQAnSd6uXc8qFzftIvsz` devuelve `500` con `Error procesando carrito`.
- La orden sigue en `status: checkout_started` y `payment.status: created` después del pago aprobado.
- El flujo del webhook exige `reservationHold.status = active` y `expiresAt > now` antes de crear la reserva.
- Cuando esa validación falla, la orden queda en `needs_review` y antes se liberaban hold y asientos aunque el pago ya estuviera aprobado.

## Next Step
- Instrumentar el reconciliador y el webhook para distinguir si el bloqueo real es por hold vencido, asientos liberados o inconsistencia del carrito.

## Findings
- Hipótesis A: Confirmada. El bloqueo principal era la validación estricta de `hold` y `cartItem` activos/no vencidos.
- Hipótesis B: Compatible con el flujo actual. Si la butaca sigue `available` o asociada al mismo `holdId`, la orden puede rescatarse sin sobreventa.
- Hipótesis C: No fue la causa principal en este caso.
- Hipótesis D: Confirmada parcialmente. Ante una validación fallida con pago aprobado, el flujo liberaba recursos en vez de dejar la orden lista para rescate.
- Evidencia adicional: el webhook devolvió `Firestore transactions require all reads to be executed before all writes.`, confirmando que la transacción escribía `cart/order` antes de terminar de leer holds, reservas y asientos.

## Fix Applied
- `app/api/mercadopago/webhook/route.ts` ahora guarda `failureReasonDetail` para identificar el motivo exacto de `needs_review`.
- El webhook permite rescatar órdenes aprobadas aunque el `hold` o el `cartItem` hayan expirado o ya estén `released/consumed`, siempre que la butaca siga disponible o ligada a la misma orden.
- Si la validación falla con un pago aprobado, la orden pasa a `needs_review` sin liberar automáticamente hold/asientos.
- Al materializar la reserva, el flujo consume hold/cartItem y actualiza butacas incluso si estaban `available` por una liberación previa segura.
- El catch de `Error procesando carrito` ahora devuelve `detail` en la respuesta para exponer el error real del próximo intento de reconciliación.
- La primera transacción del webhook ahora encola las escrituras y las aplica al final, garantizando que todas las lecturas ocurran antes de `update/set`.
