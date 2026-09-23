
Objetivo

- Dejar la plataforma consistente de punta a punta: categorías -> paquetes -> salidas -> butacas -> carrito -> checkout -> ventas -> voucher/email -> consulta .
- El foco principal no es sumar pantallas, sino eliminar modelos duplicados, unificar la lógica operativa y cerrar los huecos entre admin y front.
Paso 1

- Unificar la fuente de verdad de disponibilidad y fechas.
- Hoy hay solapamiento entre salidas y bookingConfig.dates en index.ts , paquetes.ts y los flujos de carrito/checkout.
- Modificación:
  - dejar salidas como única fuente operativa vendible
  - usar bookingConfig solo para defaults globales del paquete
  - migrar cualquier dato útil de bookingConfig.dates a salidas
- Resultado esperado:
  - una sola verdad para fecha, precio, cupo, ciudad de salida, butacas y layout
- Criterio de aceptación:
  - ninguna API de carrito, checkout o butacas debe depender de bookingConfig.dates para la operación diaria
Paso 2

- Crear un resolvedor único de salida.
- Hoy cada módulo resuelve distinto: cart/items , cart/validate , mercadopago/preference , seats/state , admin/reservas route .
- Modificación:
  - crear lib/packages/resolve-departure.ts
  - esta función debe devolver:
    - salida encontrada
    - precio efectivo
    - cupo efectivo
    - si usa butacas
    - seatLayoutId
    - estado habilitado
    - pickup points aplicables
- Resultado esperado:
  - carrito, admin, checkout y butacas leen la misma configuración
- Criterio de aceptación:
  - si cambias una salida, todo el sistema la interpreta igual
Paso 3

- Refactor total del modelo Paquete .
- Hoy Paquete mezcla demasiadas capas en index.ts .
- Modificación:
  - dejar en Paquete :
    - identidad
    - contenido
    - media
    - defaults globales de venta
  - dejar en Salida :
    - fecha ida
    - fecha vuelta
    - ciudad de salida
    - precio
    - moneda
    - cupo
    - observaciones
    - seatSelectionEnabled
    - seatLayoutId
    - estado
- Resultado esperado:
  - estructura más clara, menos duplicación conceptual
- Criterio de aceptación:
  - ningún dato operativo crítico debe estar duplicado entre paquete y salida salvo como default explícito
Paso 4

- Corregir soporte real de butacas por salida.
- Hoy hay soporte parcial en AddToCartPackageDialog.tsx , seats/state y seats/server.ts .
- Modificación:
  - hacer que el sistema siempre resuelva butacas desde la salida efectiva
  - quitar ramas ambiguas a nivel paquete si ya existe salida
  - si no hay seatLayoutId , no permitir selección de butacas
- Resultado esperado:
  - admin y front muestran exactamente el mismo layout para la misma salida
- Criterio de aceptación:
  - la misma salida devuelve igual enabled , seatLayoutId y mapa en front, admin y venta manual
Paso 5

- Corregir categorías múltiples.
- Hoy el admin ya guarda categoriaIds , pero el front público sigue leyendo categoriaId simple en categoria page y paquetes.ts .
- Modificación:
  - adaptar consultas para usar categoriaIds si existe
  - mantener compatibilidad con categoriaId legacy
- Resultado esperado:
  - un paquete aparece en todas sus categorías reales
- Criterio de aceptación:
  - un paquete con múltiples categorías se lista correctamente en todas
Paso 6

- Unificar el formulario de creación y edición de paquetes.
- Hoy hay mucha duplicación entre nuevo paquete y editar paquete .
- Modificación:
  - crear components/admin/package-form/PackageForm.tsx
  - extraer:
    - schema
    - mappers
    - sanitización
    - uploads
    - payload final
  - dejar nuevo y editar como wrappers chicos
- Resultado esperado:
  - una sola implementación del formulario
- Criterio de aceptación:
  - cualquier cambio funcional de paquetes se hace en un solo lugar
Paso 7

- Consolidar PackageAvailabilityStudio .
- Ya existe base buena en PackageAvailabilityStudio.tsx .
- Modificación:
  - convertirlo en el único lugar donde se editan:
    - salidas
    - cupos
    - fechas
    - butacas
    - plantilla
    - vencimiento
    - puntos de salida
  - sacar la lógica restante de las páginas wrapper
- Resultado esperado:
  - disponibilidad verdaderamente centralizada
- Criterio de aceptación:
  - no hay campos paralelos o duplicados fuera del estudio de disponibilidad
Paso 8

- Normalizar el dominio Ventas .
- Ya hay base visible en AdminLayout.tsx , ventas list y venta detail .
- Modificación:
  - mantener reservas como storage actual por compatibilidad
  - seguir tratando el módulo como Ventas
  - añadir una capa de dominio clara:
    - estado comercial
    - estado operativo
    - estado de voucher
    - estado de email
- Resultado esperado:
  - el panel opera ventas, no reservas sueltas
- Criterio de aceptación:
  - el admin puede entender una venta sin mirar varias colecciones manualmente
Paso 9

- Corregir tipados de pago y snapshots.
- Hay inconsistencia con Mercado Pago en types.ts y mercadopago webhook .
- Modificación:
  - alinear ReservationPricingSnapshot.paymentMethod con los métodos reales
  - revisar moneda, unit price y amount total
- Resultado esperado:
  - tipos y datos persistidos dejan de contradecirse
- Criterio de aceptación:
  - no hay casts o valores válidos en runtime pero inválidos en tipos
Paso 10

- Reforzar el flujo carrito -> checkout -> venta .
- Modificación:
  - auditar que selectedSeats , holdId , cartItemId , orderId , reservationId y cupo se transmitan sin pérdida
  - centralizar confirmación de compra en un orquestador tipo lib/sales/orchestrator.ts
- Resultado esperado:
  - una compra aprobada siempre produce la misma secuencia consistente
- Criterio de aceptación:
  - no existen ventas pagadas sin butacas confirmadas cuando correspondía, ni holds consumidos a medias
Paso 11

- Formalizar el pipeline de emails y voucher.
- Ya hay base en cron/email , sales/status.ts y los webhooks.
- Modificación:
  - separar claramente:
    - generación de voucher
    - encolado de email cliente
    - encolado de email admin
    - reintentos
    - trazabilidad
- Resultado esperado:
  - la venta muestra el estado exacto de la comunicación
- Criterio de aceptación:
  - desde admin se puede ver si el voucher fue generado, enviado o falló
Paso 12

- Mejorar success y consulta posterior.
- Hoy checkout success ya muestra mejor información.
- Modificación:
  - sumar mensajes consistentes de:
    - pago recibido
    - venta en proceso
    - voucher enviado o pendiente
    - email enviado o pendiente
  - alinear con reservas lookup
- Resultado esperado:
  - el usuario entiende qué pasó después de pagar
- Criterio de aceptación:
  - no depende de soporte para interpretar el estado de su compra
Paso 13

- Consolidar componentes reutilizables de cards y listas públicas.
- Ya avanzaste mucho con home , /paquetes y /categoria .
- Modificación:
  - usar una sola familia de card comercial para paquetes
  - usar un solo criterio de listado entre inicio, categoría y /paquetes
- Resultado esperado:
  - consistencia visual y menos mantenimiento
- Criterio de aceptación:
  - cambiar una card impacta de forma controlada en todas las vistas relevantes
Paso 14

- Revisar el módulo admin de plantillas y butacas con relación a ventas.
- Modificación:
  - asegurar que editar plantilla no rompa salidas ya vendidas
  - guardar snapshot mínimo en venta si hace falta
- Resultado esperado:
  - trazabilidad histórica
- Criterio de aceptación:
  - una venta vieja sigue representando correctamente la disposición vendida aunque cambie la plantilla base
Paso 15

- Extraer helpers transversales para evitar duplicación.
- Helpers que conviene crear:
  - resolveDepartureConfig()
  - computeCapacityPolicy()
  - resolveSeatPolicy()
  - buildPackagePayload()
  - buildVentaStatuses()
  - formatReservationPublicState()
- Resultado esperado:
  - menos lógica repetida y menos divergencias
- Criterio de aceptación:
  - los mismos conceptos no están implementados 4 veces en archivos distintos
Paso 16

- Agregar validaciones funcionales reales.
- No “tests por agregar”, sino pruebas que cubran lo crítico:
  - paquete con múltiples categorías
  - salida con butacas
  - salida sin cupo configurado
  - compra con Mercado Pago
  - confirmación manual
  - reenvío de voucher
  - consulta posterior
- Resultado esperado:
  - bajar regresiones en el flujo principal del negocio
- Criterio de aceptación:
  - cubrir los escenarios que hoy tienen más riesgo de inconsistencia
Paso 17

- QA integral manual por procesos.
- Checklist mínimo:
  - crear categoría
  - crear paquete
  - crear salida
  - asignar plantilla
  - seleccionar butacas en front
  - agregar al carrito
  - pagar
  - verificar venta en admin
  - verificar email/voucher
  - consultar compra después
  - cancelar venta y comprobar liberación de cupo/butacas
- Resultado esperado:
  - cerrar el circuito real completo
- Criterio de aceptación:
  - ningún paso del negocio depende de correcciones manuales ocultas
Orden Exacto Recomendado

- 1. Resolver modelo de disponibilidad
- 2. Crear resolvedor único de salida
- 3. Corregir butacas por salida
- 4. Corregir categorías múltiples
- 5. Unificar formulario de paquetes
- 6. Consolidar Availability Studio
- 7. Alinear ventas, vouchers y emails
- 8. Mejorar success y consulta posterior
- 9. Extraer helpers compartidos
- 10. QA funcional completa
Qué No Haría

- No seguir agregando más ramas sobre bookingConfig.dates y salidas a la vez.
- No dejar nuevo y editar duplicados más tiempo.
- No crear una colección nueva ventas todavía si antes no se estabiliza el dominio actual.
- No tocar UI aislada sin antes cerrar la lógica transversal.
Definición De “100% Funcional”

- Categorías correctas
- Paquetes consistentes
- Salidas como unidad vendible real
- Butacas alineadas con plantilla y venta
- Carrito estable
- Checkout estable
- Venta visible en admin
- Voucher y email trazables
- Consulta posterior clara
- Sin duplicación grave de lógica crítica
Recomendación Final

- La plataforma no necesita un parche más.
- Necesita una secuencia ordenada de refactor funcional.
- Si sigues este orden, mejoras la base sin romper producción y dejas el sistema listo para crecer.