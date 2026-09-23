# Debug Session: seat-selection-transaction

- Status: OPEN
- Date: 2026-07-17
- Symptom: Al seleccionar una butaca en checkout aparece `Firestore transactions require all reads to be executed before all writes.`

## Hypotheses

1. La transacción del carrito escribe un documento y luego vuelve a leer stock/asientos.
2. El flujo con `selectedSeats` activa una rama distinta al flujo sin butacas y rompe el orden de lecturas/escrituras.
3. Una función auxiliar dentro de la transacción hace lecturas tardías después de un `set` o `update`.
4. Conviven ramas nuevas y viejas del checkout/cart y la selección de butaca entra en una ruta legacy.
5. La disponibilidad de asientos se valida parcialmente fuera y dentro de la transacción.

## Evidence Log

- Confirmado por revisión del flujo de transacciones en `app/api/cart/items/route.ts`.
- Hallazgo 1: en `PATCH /api/cart/items`, al cambiar butacas se hacía `tx.set(seatResRef, ...)` y luego `await tx.get(templateRef)` para recalcular extras.
- Hallazgo 2: en el mismo `PATCH`, al cambiar cantidad se escribía `stockHolds` antes de leer `reservationHolds`.
- Hallazgo 3: en `POST /api/cart/items`, se escribía `cartRef` y/o `stockHolds` antes de terminar de leer `seatLayouts` y `seatReservations`.
- Hallazgo 4: el mismo patrón aparecía en rutas auxiliares del dominio: `app/api/holds/release/route.ts`, `app/api/cart/validate/route.ts` y `app/api/admin/seats/route.ts`.

## Fix

- `app/api/cart/items/route.ts`
  - Reordenadas las transacciones de `POST` y `PATCH` para completar todas las lecturas antes de cualquier escritura.
  - Las mutaciones de `stockHolds` y `seatReservations` ahora se preparan en memoria y se aplican al final.
  - Se reutiliza la plantilla de butacas ya leída para evitar una segunda lectura tardía al recalcular extras.
- `app/api/holds/release/route.ts`
  - Reordenadas lecturas de item, mapa de asientos y plantilla antes de actualizar hold/stock/asientos.
- `app/api/cart/validate/route.ts`
  - Reordenada la expiración de items vencidos para leer `stockHolds`, `seatReservations` y `seatLayouts` antes de escribir estados.
- `app/api/admin/seats/route.ts`
  - Pospuesta la inicialización del documento de asientos hasta después de leer la reserva cuando la acción requiere `reservationId`.

## Verification

- Pendiente de reproducción manual del usuario con la sesión `seat-selection-transaction`.
- La instrumentación `pre-fix` sigue activa en `app/api/cart/items/route.ts` para comparar si el error persiste.
