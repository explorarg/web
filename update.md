Necesito que analices profundamente el proyecto actual de Explorarg y modifiques el flujo de reservas para convertirlo en un sistema profesional tipo e-commerce turístico, con carrito de compras, checkout unificado, bloqueo temporal de cupos y selección visual de butacas del micro estilo “cine”.

Contexto general:
El proyecto actual ya cuenta con frontend turístico, paquetes, experiencias, checkout, panel admin, reservas, vendedores/referidos, Firebase Firestore, Firebase Auth, Resend, Cloudflare R2 y estructura de reservas. La idea es evolucionarlo para que Explorarg no tenga una reserva aislada por paquete, sino un flujo moderno de compra donde el usuario pueda acumular reservas de distintos paquetes y finalizar todo junto desde /checkout.

\==================================================
OBJETIVO PRINCIPAL
==================

Modificar el sistema para que funcione como un carrito de compras turístico:

1. Cada paquete o experiencia debe poder agregarse al carrito.
2. El usuario debe poder acumular reservas de distintos paquetes.
3. Debe existir una página /carrito.
4. El checkout actual debe reutilizarse y adaptarse como /checkout.
5. El sistema debe bloquear cupos temporalmente para evitar sobreventas.
6. El usuario debe poder seleccionar butacas del micro de forma visual, estilo cine.
7. El panel admin debe permitir administrar plantillas de chasis/butacas de micros.
8. El sistema debe ser escalable para futuros tipos de transporte, paquetes, salidas y configuraciones.

No hacer una solución rígida. Debe quedar dinámico, mantenible y preparado para crecer.

\==================================================
NUEVO FLUJO DE COMPRA
=====================

El flujo final debe ser:

1. Usuario entra al detalle de un paquete.
2. Selecciona:
   - fecha/salida disponible
   - cantidad de pasajeros
   - mayores
   - menores
   - tipo de habitación si corresponde
   - ascenso / punto de salida si corresponde
   - coche cama / semicama / categoría de transporte si corresponde
   - butacas disponibles si el paquete lo requiere
3. Agrega la reserva al carrito.
4. El sistema bloquea temporalmente esos cupos y butacas.
5. El usuario puede seguir navegando y agregar otros paquetes.
6. En /carrito puede revisar todo lo agregado.
7. En /checkout completa datos finales y paga con Mercado Pago.
8. Al aprobarse el pago, se confirma la reserva, se descuentan cupos definitivos y se envían vouchers.
9. Si el tiempo de bloqueo expira, los cupos y butacas deben liberarse automáticamente.

\==================================================
PÁGINA /CARRITO
===============

Crear o adaptar una página /carrito con diseño profesional.

Debe mostrar:

- Lista de paquetes agregados.
- Nombre del paquete.
- Fecha/salida seleccionada.
- Cantidad de pasajeros.
- Mayores y menores.
- Tipo de habitación.
- Punto de ascenso.
- Tipo de coche o servicio.
- Butacas seleccionadas.
- Precio unitario.
- Subtotal por paquete.
- Total general.
- Tiempo restante de reserva/bloqueo.
- Botón para eliminar item.
- Botón para modificar selección.
- Botón para continuar comprando.
- Botón para finalizar compra.

Debe validar constantemente que los cupos sigan disponibles.

Si un item venció o perdió disponibilidad, mostrar mensaje claro y pedir al usuario actualizar la selección.

\==================================================
CHECKOUT /CHECKOUT
==================

Usar el checkout actual como base, pero adaptarlo para recibir múltiples items desde el carrito.

El checkout debe permitir:

- Completar datos del comprador/titular.
- Completar datos de pasajeros si corresponde.
- Confirmar datos de contacto.
- Aceptar términos y condiciones.
- Aceptar política de señas/no reintegro.
- Confirmar que el usuario entiende las reglas del viaje.
- Ver resumen total del carrito.
- Pagar con Mercado Pago.
- Asociar la compra a un vendedor/referido si llegó por link referido.
- Confirmar la compra completa al aprobarse el pago.

El checkout no debe confirmar reservas si Mercado Pago no confirma el pago desde backend/webhook.

\==================================================
BLOQUEO TEMPORAL DE CUPOS Y BUTACAS
===================================

Implementar un sistema de bloqueo temporal para evitar sobreventas.

Cuando el usuario agrega un paquete al carrito:

- Se genera un cartId o reservationHoldId.
- Se bloquean temporalmente los cupos seleccionados.
- Si seleccionó butacas, también se bloquean esas butacas.
- El bloqueo debe tener vencimiento.
- Recomiendo un timeout inicial de 10 a 15 minutos.
- El usuario debe ver el contador en /carrito y /checkout.

Cuando vence el timeout:

- Se liberan cupos.
- Se liberan butacas.
- El carrito queda inválido o requiere actualización.
- No se debe permitir pagar con disponibilidad vencida.

Implementar lógica de expiración segura.

Opciones posibles:

- Campo expiresAt en Firestore.
- Estado hold / pending / confirmed / expired.
- Validación server-side antes de crear preferencia de Mercado Pago.
- Reconciliación o limpieza automática de holds vencidos mediante cron/API si corresponde.

Muy importante:
No confiar solo en el frontend para liberar cupos. La validación final debe ocurrir en backend.

\==================================================
MODELO DE CARRITO
=================

Crear o adaptar una estructura de carrito escalable.

Ejemplo conceptual:

cart {
id
userId opcional
sessionId
status: active | checkout\_started | paid | expired | cancelled
items\[]
totalAmount
currency
expiresAt
createdAt
updatedAt
}

cartItem {
id
packageId / experienceId
packageTitle
packageSlug
departureId / dateId
departureDate
passengers {
adults
minors
infants
}
roomType
boardingPoint
transportType
selectedSeats\[]
unitPrice
subtotal
holdId
expiresAt
referralInfo opcional
}

\==================================================
SELECCIÓN DE BUTACAS TIPO CINE
==============================

Necesito implementar una experiencia visual de selección de butacas del micro similar a un sistema de cine.

El usuario debe ver un mapa visual del micro con:

- Frente del micro / cabina del conductor.
- Pasillo.
- Filas.
- Butacas numeradas.
- Butacas disponibles.
- Butacas ocupadas.
- Butacas seleccionadas.
- Butacas bloqueadas temporalmente por otros usuarios.
- Butacas no disponibles.
- Referencias visuales/leyenda.
- Responsive para mobile.

El usuario debe poder seleccionar la cantidad exacta de butacas según la cantidad de pasajeros.

Validaciones:

- No puede seleccionar más butacas que pasajeros.
- No puede continuar si faltan butacas obligatorias.
- No puede seleccionar butacas ocupadas.
- No puede seleccionar butacas bloqueadas.
- Si otro usuario tomó la butaca antes de confirmar, debe actualizarse el estado.
- Antes de pagar, validar nuevamente que las butacas sigan disponibles.

\==================================================
PLANTILLAS DE CHASIS Y BUTACAS DESDE ADMIN
==========================================

Crear un módulo en el panel admin para administrar plantillas de micros/chasis/butacas.

El admin debe poder crear diferentes plantillas de distribución de micro.

Ejemplos:

- Micro 46 butacas semicama.
- Micro 50 butacas.
- Doble piso.
- Coche cama.
- Mini bus.
- Plantilla personalizada.

Cada plantilla debe permitir configurar:

- Nombre de la plantilla.
- Tipo de transporte.
- Cantidad de pisos si aplica.
- Cantidad de filas.
- Distribución por fila.
- Posición del pasillo.
- Numeración de butacas.
- Butacas bloqueadas por defecto.
- Butacas especiales.
- Butacas panorámicas si corresponde.
- Ubicación del baño si corresponde.
- Ubicación de escalera si corresponde.
- Notas internas.

La plantilla debe guardarse en Firestore y poder reutilizarse en distintos paquetes/salidas.

\==================================================
ASIGNACIÓN DE PLANTILLA A PAQUETE / SALIDA
==========================================

En el admin, al crear o editar un paquete/salida, debe poder asignarse una plantilla de micro.

La asignación ideal debería ser por salida, no solo por paquete, porque un mismo paquete puede tener distintas fechas con distintos micros.

Cada salida debe poder tener:

- Fecha de salida.
- Cupos totales.
- Plantilla de micro asignada.
- Butacas disponibles.
- Butacas bloqueadas manualmente.
- Butacas vendidas.
- Butacas reservadas temporalmente.
- Tipo de coche.
- Puntos de ascenso.
- Precios específicos si corresponde.

Importante:
Si una salida no requiere selección de butacas, el sistema debe permitir desactivar esta función.

\==================================================
GESTIÓN DE BUTACAS DESDE ADMIN
==============================

El admin debe poder ver el mapa de butacas de cada salida y gestionar:

- Disponibles.
- Ocupadas.
- Reservadas.
- Bloqueadas manualmente.
- Liberadas.
- Asignadas a una reserva.
- Datos del pasajero por butaca.
- Reserva asociada.
- Vendedor asociado si corresponde.

Debe poder bloquear butacas manualmente por motivos operativos.

Ejemplo:
Butaca no disponible, guía/coordinador, chofer adicional, mantenimiento, reserva telefónica, etc.

\==================================================
ESTADOS DE BUTACAS
==================

Usar estados claros y escalables:

available
held
selected
reserved
paid
blocked
disabled

Definiciones:

available = disponible para seleccionar
held = bloqueada temporalmente por carrito activo
selected = seleccionada en el frontend actual
reserved = reservada pero no completamente pagada
paid = confirmada por pago aprobado
blocked = bloqueada manualmente por admin
disabled = no utilizable por diseño de plantilla

\==================================================
INTEGRACIÓN CON RESERVAS
========================

Cuando el usuario paga correctamente:

- El carrito pasa a paid.
- Los items del carrito generan reservas definitivas.
- Las butacas held pasan a reserved/paid según el estado de pago.
- Los cupos se descuentan definitivamente.
- Se generan códigos únicos de reserva.
- Se envían vouchers.
- Se registra el historial de estado.
- Se mantiene snapshot de precio, paquete, fecha y butacas.

Si el pago queda pendiente:

- Mantener estado pendiente.
- No confirmar definitivamente si Mercado Pago no aprobó.
- Definir si las butacas siguen bloqueadas por un tiempo o se liberan luego de vencido el plazo.

Si el pago falla o se cancela:

- Liberar cupos.
- Liberar butacas.
- Marcar carrito/reserva como cancelada o expirada.

\==================================================
MERCADO PAGO Y CARRITO
======================

Adaptar Mercado Pago para compra de múltiples items.

La preferencia debe incluir:

- Todos los items del carrito.
- Total correcto.
- external\_reference con cartId.
- metadata con cartId, userId/sessionId, referralCode si existe.
- URLs de success, failure y pending.
- Webhook para confirmación final.

El webhook debe:

1. Recibir notificación.
2. Consultar pago real en Mercado Pago.
3. Validar estado.
4. Buscar carrito por external\_reference.
5. Confirmar reservas si el pago está aprobado.
6. Evitar duplicaciones.
7. Enviar vouchers solo una vez.
8. Liberar o mantener holds según estado.

\==================================================
SISTEMA DE REFERIDOS Y CARRITO
==============================

El sistema de referidos debe seguir funcionando aunque exista carrito.

Casos a contemplar:

1. Usuario entra por link de vendedor a un paquete.
2. Agrega ese paquete al carrito.
3. Sigue navegando y agrega otro paquete.
4. Finaliza compra.

Definir lógica profesional:

- Cada item puede conservar referralInfo propio.
- Si el link referido aplica a todo el carrito, documentarlo y aplicarlo consistentemente.
- No perder el código referido al pasar por /carrito, /checkout y Mercado Pago.
- Guardar referido en reserva final.
- Calcular comisión por item/reserva.
- Mostrar ventas al vendedor en su portal.

\==================================================
DATOS DE PASAJEROS
==================

El carrito puede tener múltiples paquetes y múltiples pasajeros.

Diseñar una estructura flexible para:

- Titular de compra.
- Pasajeros por item.
- Datos generales.
- DNI/documento.
- Fecha de nacimiento si corresponde.
- Teléfono.
- Email.
- Observaciones.
- Dietas especiales.
- Accesibilidad/movilidad.
- Solicitud de butaca especial.
- Menores.
- Habitaciones.

Debe quedar preparado para que algunos paquetes pidan más datos que otros.

\==================================================
REGLAS COMERCIALES DE EXPLORARG
===============================

Incorporar al flujo las reglas comerciales ya relevadas:

- Las señas no son reintegrables.
- El viaje debe estar saldado 72 horas antes de la salida.
- Las salidas pueden depender de un mínimo de pasajeros.
- Algunas salidas pueden requerir mínimo de 30 pasajeros.
- Explorarg puede cancelar con 96 horas de anticipación si no se alcanza el mínimo.
- Cambios/cancelaciones pueden tener límite de 72 horas antes de la salida.
- Menores de 0 a 2 años pueden viajar sin cargo y sin servicios.
- Menores de 3 a 5 años pueden tener 20% de descuento viajando con dos adultos.
- Desde 6 años abonan como adulto.
- Habitación single puede tener adicional del 50%.
- Dietas especiales deben informarse al reservar.
- Explorarg no envía links de pago informales por WhatsApp.
- Los pagos oficiales son por Mercado Pago enviado por email, oficinas o transferencia a cuenta de la empresa.
- Las butacas especiales requieren validación administrativa y documentación si corresponde.

Estas reglas deben aparecer donde corresponda:

- Detalle del paquete.
- Carrito.
- Checkout.
- Voucher.
- Email de confirmación.
- Panel admin.
- Términos y condiciones.

\==================================================
UI / UX ESPERADA
================

La experiencia debe sentirse moderna, clara y confiable.

En el detalle del paquete:

- Mostrar precio destacado.
- Mostrar selector de fecha.
- Mostrar selector de pasajeros.
- Mostrar opciones de ascenso.
- Mostrar tipo de transporte.
- Mostrar botón “Agregar al carrito”.
- Mostrar botón “Consultar por WhatsApp”.
- Si aplica, mostrar “Elegir butacas”.

En selección de butacas:

- Diseño visual limpio.
- Leyenda de estados.
- Botón continuar.
- Resumen de selección.
- Advertencias claras.
- Mobile friendly.

En carrito:

- Resumen claro.
- Tiempo restante visible.
- Items editables.
- Total destacado.
- CTA fuerte para checkout.

En checkout:

- Proceso por pasos si es necesario:
  1. Datos del comprador
  2. Datos de pasajeros
  3. Revisión
  4. Pago

\==================================================
FIRESTORE - COLECCIONES SUGERIDAS
=================================

Analizar si conviene agregar estas colecciones:

carts
cartHolds
seatLayouts
seatMaps
seatReservations
reservationHolds
reservas
orders

No crear complejidad innecesaria, pero sí una arquitectura clara.

Sugerencia:

seatLayouts:

- plantillas reutilizables de micros

departures o salidas:

- fecha específica del paquete con cupos y plantilla asignada

seatReservations:

- estado de cada butaca por salida

carts:

- carrito activo del usuario/session

orders:

- compra final agrupadora

reservas:

- reservas individuales generadas desde cada item del carrito

\==================================================
ORDERS Y RESERVAS
=================

Diferenciar claramente:

Order:
Representa la compra completa del carrito.

Reserva:
Representa cada paquete/salida reservado dentro de esa compra.

Ejemplo:
Un usuario compra 2 paquetes en un mismo checkout.

Resultado:

- 1 order
- 2 reservas
- 1 pago de Mercado Pago
- 2 vouchers o 1 voucher agrupado con detalle por paquete

Decidir la mejor implementación, pero mantener trazabilidad clara.

\==================================================
VALIDACIONES CRÍTICAS
=====================

Antes de agregar al carrito:

- Validar que el paquete esté activo.
- Validar que la fecha exista.
- Validar cupos disponibles.
- Validar que las butacas estén disponibles si aplica.

Antes de crear preferencia de Mercado Pago:

- Validar carrito activo.
- Validar que no haya expirado.
- Validar cupos.
- Validar butacas.
- Recalcular precios desde backend.
- No confiar en precios enviados desde frontend.

Antes de confirmar pago:

- Validar pago real con Mercado Pago.
- Validar que el carrito corresponda.
- Confirmar reservas de forma idempotente.
- Evitar duplicar reservas, cupos o vouchers.

\==================================================
IDEMPOTENCIA
============

El webhook puede llegar más de una vez.

Implementar lógica idempotente:

- Si el carrito ya fue confirmado, no volver a confirmar.
- Si el voucher ya fue enviado, no reenviar.
- Si el cupo ya fue descontado, no descontar otra vez.
- Guardar paymentId procesado.
- Guardar processedAt.
- Registrar historial de eventos.

\==================================================
ADMINISTRACIÓN DE TIMEOUTS
==========================

Implementar una estrategia clara para holds vencidos.

Puede ser:

- Validación en cada carga de /carrito.
- Endpoint de limpieza.
- Cron protegido.
- Liberación automática al intentar checkout.
- Campo expiresAt consultado en backend.

No permitir que cupos/butacas queden bloqueados para siempre.

\==================================================
COMPATIBILIDAD CON RESERVAS MANUALES
====================================

El admin debe poder crear reservas manuales que también impacten cupos y butacas.

Desde admin:

- Crear reserva manual.
- Seleccionar paquete.
- Seleccionar salida.
- Seleccionar cantidad de pasajeros.
- Seleccionar butacas si aplica.
- Marcar pago como pendiente/señado/pagado.
- Adjuntar comprobante.
- Asignar vendedor si corresponde.
- Enviar voucher manualmente.

Estas reservas deben competir con el mismo sistema de cupos y butacas que la web pública.

\==================================================
NO ROMPER FUNCIONALIDADES EXISTENTES
====================================

Antes de modificar:

- Revisar el sistema actual de checkout.
- Revisar reservas existentes.
- Revisar modelos de paquetes/experiencias.
- Revisar portal de vendedores.
- Revisar integración de emails.
- Revisar sistema de stock/cupos.
- Revisar rutas actuales.

No eliminar funcionalidades útiles sin adaptar.

Si hay lógica actual que sirve, reutilizarla.

\==================================================
ARCHIVOS A REVISAR
==================

Revisar especialmente:

- app/paquete/\[slug]
- app/paquetes
- app/checkout
- app/api/checkout
- app/api/mercadopago si existe
- app/admin/reservas
- app/admin/paquetes
- app/admin/stock
- app/admin/vendedores
- app/vendedor
- components/PaqueteSidebar
- components/PaqueteCard
- components/admin
- lib/firebase
- lib/reservas
- lib/checkout
- lib/cart si existe
- lib/mercadopago si existe
- lib/resend
- types
- hooks

Crear nuevos archivos/módulos si es necesario:

- components/cart
- components/seats
- components/admin/seat-layouts
- lib/cart
- lib/seats
- lib/holds
- app/carrito
- app/admin/butacas
- app/admin/plantillas-micro
- app/api/cart
- app/api/seat-holds
- app/api/mercadopago/create-preference
- app/api/mercadopago/webhook

\==================================================
CRITERIOS DE ACEPTACIÓN
=======================

El desarrollo se considera correcto cuando:

1. Un usuario puede agregar un paquete al carrito.
2. Puede agregar más de un paquete al mismo carrito.
3. Existe página /carrito funcional.
4. El carrito muestra resumen completo.
5. El carrito tiene timeout visible.
6. Los cupos se bloquean temporalmente.
7. Los cupos vencidos se liberan.
8. El usuario puede elegir butacas visualmente.
9. Las butacas ocupadas no se pueden seleccionar.
10. Las butacas bloqueadas por otro usuario no se pueden seleccionar.
11. El admin puede crear plantillas de micro.
12. El admin puede asignar una plantilla a una salida.
13. El admin puede bloquear/liberar butacas manualmente.
14. El checkout procesa múltiples items.
15. Mercado Pago recibe el total correcto.
16. El webhook confirma la orden correctamente.
17. Se generan reservas definitivas por item.
18. Se descuentan cupos correctamente.
19. Se confirman butacas correctamente.
20. Se envían vouchers sin duplicar.
21. El sistema de referidos sigue funcionando.
22. Las reservas manuales impactan en cupos y butacas.
23. El proyecto compila sin errores.
24. No quedan errores en consola.
25. El flujo es responsive y usable en mobile.

\==================================================
PRUEBAS OBLIGATORIAS
====================

Probar los siguientes casos:

1. Agregar un paquete al carrito.
2. Agregar dos paquetes distintos.
3. Eliminar un paquete del carrito.
4. Modificar cantidad de pasajeros.
5. Seleccionar butacas.
6. Intentar seleccionar butaca ocupada.
7. Simular vencimiento del timeout.
8. Verificar liberación de cupos.
9. Verificar liberación de butacas.
10. Checkout con carrito válido.
11. Checkout con carrito vencido.
12. Pago aprobado con Mercado Pago.
13. Pago pendiente.
14. Pago rechazado.
15. Webhook duplicado.
16. Reserva referida por vendedor.
17. Comisión generada.
18. Reserva manual desde admin.
19. Bloqueo manual de butaca desde admin.
20. Voucher enviado correctamente.

\==================================================
IMPORTANTE FINAL
================

Actuar como desarrollador senior full stack.

Primero analizar.
Después proponer arquitectura interna si hace falta.
Luego implementar.

No hacer una solución improvisada.
No hardcodear la distribución de butacas.
No depender del frontend para validar cupos.
No confiar en precios enviados desde cliente.
No romper el checkout actual sin reemplazarlo correctamente.
No eliminar el sistema de referidos.

La prioridad es lograr un sistema robusto, escalable y profesional para Explorarg:

- carrito turístico
- reservas múltiples
- checkout unificado
- Mercado Pago
- timeout de cupos
- selección visual de butacas
- plantillas administrables de micros
- panel admin operativo
- reservas manuales
- referidos
- vouchers automáticos
