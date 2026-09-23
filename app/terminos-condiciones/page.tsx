import Navbar from "@/components/Navbar";
import HomeFooter from "@/components/home/HomeFooter";
import WhatsAppButton from "@/components/WhatsAppButton";
import type { Metadata } from "next";
import { CONTACT_INFO, LEGAL_INFO, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { siteConfig } from "@/lib/siteConfig";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Términos y Condiciones - ${SITE_NAME}`,
  description: `Términos y condiciones generales de contratación de servicios turísticos de ${SITE_NAME}. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: `${siteUrl}/terminos-condiciones`,
  },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/terminos-condiciones`,
    title: `Términos y Condiciones - ${SITE_NAME}`,
    description: `Términos y condiciones generales de contratación de servicios turísticos de ${SITE_NAME}.`,
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TerminosCondicionesPage() {
  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <div className="bg-white min-h-screen">
        {/* Hero minimalista */}
        <div className="pt-32 pb-8 md:pb-10 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-lg md:text-lg lg:text-lg font-bold mb-4 md:mb-5 leading-tight">
                Términos y Condiciones
              </h1>
              <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-0">
                Condiciones generales de contratación de servicios turísticos
              </p>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <section className="pt-6 md:pt-8 pb-12 md:pb-16 bg-white">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto prose prose-lg prose-gray">
              <article className="terms-and-conditions">
                <p>
                  Sr. Pasajero, atento su requerimiento de intermediación en la
                  contratación de servicios turísticos, esta Agencia cumple en
                  informarle las condiciones generales de contratación. Es de
                  vital importancia para su viaje, que Ud. lea las mismas. Si
                  está de acuerdo le solicitamos nos envíe su aceptación al
                  siguiente mail:{" "}
                  <a href={`mailto:${CONTACT_INFO.email}`}>
                    {CONTACT_INFO.email}
                  </a>
                </p>
                <p>
                  Esta agencia sólo dará trámite a su reserva, previa lectura y
                  conformidad de las mismas. Atte: {SITE_NAME}.
                </p>
                <h2>Datos de la agencia</h2>
                <ul>
                  <li>Nombre comercial: {SITE_NAME}</li>
                  <li>Razon Social: {LEGAL_INFO.razonSocial}</li>
                  <li>CUIT: {LEGAL_INFO.cuit}</li>
                  <li>Legajo RNAV: {LEGAL_INFO.legajoRnav}</li>
                </ul>

                <h2>Condiciones generales de Contratación</h2>

                <h2>Solicitudes y pagos</h2>
                <ol>
                  <li>
                    <p>
                      El precio y/o reservación de los servicios que componen el
                      tour quedan sujetos a modificaciones sin previo aviso
                      cuando se produzca una alteración en los servicios,
                      modificaciones en los costos o en los tipos de cambio
                      previstos, por causas no imputables a las partes.
                    </p>
                  </li>
                  <li>
                    <p>
                      Todos los importes pagados antes de la confirmación
                      definitiva de los servicios, son percibidos en concepto de
                      reserva. La confirmación definitiva de los servicios y
                      precios respectivos se producirá con la emisión de pasajes
                      y vouchers (órdenes de servicios) y la facturación
                      correspondiente.
                    </p>
                  </li>
                  <li>
                    <p>
                      Las operaciones a crédito, deberán satisfacer los
                      requisitos propios fijados para las mismas. El interesado
                      deberá cumplimentar el pago de los saldos en los plazos y
                      condiciones establecidos en la contratación con las
                      entidades que las financien, sean bancarias, billeteras
                      virtuales, etc. El incumplimiento en la forma y plazos
                      previstos ocasionará la anulación de la reserva confirmada
                      y la pérdida total de la seña abonada, sin derecho a
                      reintegro ni reclamo alguno. Respecto a las líneas aéreas,
                      cada operación aérea se regirá por las condiciones
                      especiales de la tarifa, clase y según cada compañía
                      aérea.
                    </p>
                  </li>
                  <li>
                    <p>
                      Al momento de cotizar, el sitio y/o el ejecutivo de ventas
                      mostrará, desplegará y/u ofrecerá la tarifa más económica
                      disponible al momento de la cotización encontrada en el
                      Sistema global de distribución de reservas aéreas y/o de
                      servicios terrestres (GDS) en el momento de la consulta.
                      Cabe señalar que esas tarifas, en general, no permiten
                      cambios ni reembolsos y, a criterio exclusivo del
                      prestador, podrían admitir cambios con penalidades y/o
                      diferencias tarifarias o reembolsos con penalidades que no
                      dependen de la voluntad de esta Agencia. En virtud de
                      haberse creado tarifas promocionales denominadas
                      “superflex” o similar, el pasajero reconoce que adquiere
                      dicha tarifa promocional con las condiciones y
                      limitaciones que dispone el transportador u operador o el
                      prestador de servicios.
                    </p>
                  </li>
                  <li>
                    <p>
                      Las cotizaciones de los servicios serán en moneda
                      extranjera cuando los mismos se presten en el exterior
                      (cfr. Res. 7/2002), igual que los vuelos por block off o
                      cupo y/o charters. Los pagos se recibirán en pesos al tipo
                      de cambio vigente en el horario del día de pago, y se
                      deducirán como pago a cuenta del total cotizado en la
                      moneda extranjera. El saldo, se abonará en pesos a la
                      cotización vigente en el horario del día de su efectiva
                      acreditación en las cuentas informadas por esta compañía.
                      Para el caso que el pasajero opte por pagar en moneda
                      extranjera, ante la eventualidad de desistimiento o
                      cancelación de los servicios, los reembolsos serán en la
                      moneda de curso legal (cfr. Art. 765 CCyCN).
                    </p>
                  </li>
                  <li>
                    <p>
                      Los pasajeros que paguen en dinero en efectivo, quedarán
                      sometidos a las disposiciones de la Res. 3825/2015 AFIP y
                      a las que en el futuro puedan dictarse en ese sentido. Los
                      que abonen servicios que se presten en el exterior, toman
                      conocimiento de las restricciones cambiarias por medidas
                      gubernamentales ajenas a esta agencia. Se deberá atender a
                      las normas previstas en la Res. Gral AFIP 4815, en materia
                      de percepciones impositivas.
                    </p>
                  </li>
                </ol>

                <h2>Datos personales</h2>
                <p>
                  El pasajero deberá informar sus datos personales en forma
                  veraz, exacta y vigente. Siendo responsable el pasajero de la
                  veracidad y autenticidad de los mismos. Es responsabilidad del
                  pasajero informar debida y correctamente a la Agencia de
                  viajes la totalidad de sus datos personales y de las personas
                  que viajen con él, tanto en cuanto a nombres completos y
                  correctos, nacionalidad, fecha de nacimiento, números y tipo
                  de documento requeridos, domicilio y demás datos que se le
                  soliciten de acuerdo al destino; deberá informar si los
                  pasaportes y/u otra documentación exigida para viajar están
                  debidamente actualizados y encontrarse en condiciones
                  adecuadas, legibles y en buen estado, además de los datos de
                  contacto necesarios y solicitados por las aerolíneas y/o
                  transportadores y/u operadores, por cuestiones de seguridad y
                  conforme las normas internacionales vigentes.
                </p>

                <h2>Los precios incluyen</h2>
                <ol>
                  <li>
                    <p>
                      Los servicios que se detallan el itinerario conforme
                      informe el prestador.
                    </p>
                  </li>
                  <li>
                    <p>
                      En los casos que se incluyan transporte este se brinda de
                      acuerdo al medio elegido e itinerario. Transporte de ida y
                      vuelta, cuando este servicio esté expresamente incluido en
                      el detalle de servicios, con el tipo, características y
                      categoría que conste en dicho detalle, de acuerdo a si el
                      servicio es regular, chárter o con sistema de block off
                      (bloqueo) y de acuerdo a los destinos con o sin escalas
                      y/o conexiones.
                    </p>
                  </li>
                  <li>
                    <p>
                      Asistencia al viajero conforme las condiciones del
                      servicio en caso de corresponder y/o su modalidad esté
                      expresamente indicada en el voucher respectivo.
                    </p>
                  </li>
                  <li>
                    <p>
                      Alojamiento en los hoteles mencionados en los itinerarios
                      u otros de igual o mayor categoría —en caso de cambio—, en
                      habitaciones simples, dobles o triples, según la cantidad
                      de pasajeros alojados, con baño privado e impuestos
                      incluidos, salvo estipulación expresa en contrario y/o
                      salvo en ciudades y/o países que cobren tasas de pernocte
                      directamente al pasajero; régimen de comidas, según se
                      indique en cada oportunidad; visitas y excursiones que se
                      mencionen.
                    </p>
                  </li>
                  <li>
                    <p>
                      Traslados hasta y desde aeropuertos, terminales y/u
                      hoteles, cuando se indique. La cantidad de días de
                      alojamiento prevista en el voucher de servicios,
                      considerando que el día de alojamiento hotelero se computa
                      desde las quince horas y finaliza a las doce horas del día
                      siguiente, independientemente de la hora de llegada y de
                      salida y/o de la utilización completa o fraccionada del
                      servicio de hotelería. Atento que la legislación hotelera
                      es de índole local, si por motivos inherentes a ella el
                      horario de finalización del alojamiento fuere anterior a
                      las doce horas, las habitaciones podrán ser ocupadas hasta
                      la hora de salida que indique el hotel al hacer el
                      ingreso, y esta Agencia no podrá efectuar modificación
                      alguna sobre dicha circunstancia, ni atender situaciones
                      especiales. Pasado el límite horario, el pasajero deberá
                      abonar al hotel la tarifa correspondiente, conforme las
                      que se encuentren vigentes y/o rack rate o tarifa de
                      mostrador que podrá variar respecto de la abonada a la
                      agencia.
                    </p>
                  </li>
                  <li>
                    <p>
                      La duración del tour será indicada en cada caso tomando
                      como primer día el establecido en la documentación de
                      viaje, y como último, el día de salida del destino,
                      independientemente de los horarios de salida o de llegada,
                      de origen y a destino, respectivamente. Servicios de
                      hotelería: en general, los establecimientos hoteleros
                      poseen escasa cantidad de habitaciones con disponibilidad
                      triple; por lo que es corriente que ocurra que las
                      habitaciones triples se conformen con una habitación doble
                      a las que se le agrega una cama adicional de tipo
                      desarmable, lo que podría limitar la comodidad funcional
                      de la misma, dicha limitación es aceptada por el pasajero,
                      liberando al hotel, a esta empresa y/u al operador
                      mayorista de cualquier responsabilidad al respecto.
                    </p>
                    <p>
                      A modo de ejemplo: Servicios en Estados Unidos de América
                      y México: las habitaciones disponen de dos camas
                      matrimoniales tipo Queen, en las que se permite acomodar
                      de una a cuatro personas a la misma tarifa; por lo que
                      cuando se indica DBLFP, tanto en México como en Estados
                      Unidos de América, se entiende que son habitaciones que
                      albergan hasta 2 adultos y hasta 2 menores de hasta 12
                      años, en una misma habitación con dos camas de 2 plazas
                      tipo Queen, todo ello en tanto las medidas sanitarias así
                      lo autoricen y hasta nuevo aviso.
                    </p>
                  </li>
                  <li>
                    <p>
                      Según tarifa elegida, con baño privado o a compartir.
                      Régimen de comidas según se indique en cada oportunidad.
                      Visitas y excursiones que se informen.
                    </p>
                  </li>
                </ol>

                <p>
                  <strong>Nota:</strong> La categoría de los hoteles que se
                  incluyan en los itinerarios son otorgadas por las autoridades
                  turísticas del sitio geográfico en el que se encuentran y su
                  otorgamiento y control es administrativo. La Agencia no asume
                  responsabilidad alguna sobre los criterios que rijan ese
                  control y otorgamiento.
                </p>
                <p>
                  <strong>Nota:</strong> Las tarifas turísticas que imponen los
                  prestadores dependen de variables como promociones
                  estacionales, anticipación de compra, y en caso de las aéreas
                  de restricciones. En consecuencia pueden variar su costo
                  rápidamente siendo la agencia totalmente ajena a dicha
                  modificación.
                </p>

                <h2>Servicios y rubros no incluidos</h2>
                <ol>
                  <li>
                    <p>
                      Extras; bebidas, lavado y planchado de ropa, extras en los
                      hoteles, propinas, gastos de comunicaciones o reservas, o/
                      y cualquier otro servicio, tasa, arancel aduanero, etc.
                      que no se encuentre incluido en la orden de servicio
                      emitida por LA AGENCIA, exceso de equipaje, tasas de
                      embarque, penalidad por falta de realización de check-in
                      on line, peajes, cuando no esté especificado lo contrario,
                      tasas sobre servicios, IVA y/u otros impuestos, aranceles
                      aduaneros, migratorios o por gestión de reservas, costo
                      y/o gastos por vacunas, test y/o análisis bioquímicos y/o
                      todo gasto derivados de los requisitos sanitarios exigidos
                      para el ingreso al destino o el regreso a Argentina,
                      retenciones o percepciones, actuales y/o futuros, costos
                      y/o gastos derivados de la obtención urgente o express de
                      documentación para viajar, ni ningún otro servicio que no
                      se encuentre expresamente indicado en la orden de servicio
                      emitida por esta compañía.
                    </p>
                  </li>
                  <li>
                    <p>
                      Entradas a museos, sitios arqueológicos, atracciones,
                      parques nacionales, excursiones opcionales, impuestos y/o
                      tasas locales de turismo, comunicaciones, gastos
                      adicionales producidos por cancelaciones, demoras en las
                      salidas o llegadas de los medios de transporte, o por
                      razones imprevistas ajenas a esta compañía.
                    </p>
                  </li>
                  <li>
                    <p>
                      Alimentación en ruta, excepto aquellas que estuviesen
                      expresamente incluidas en los programas.
                    </p>
                  </li>
                  <li>
                    <p>Los gastos e intereses en las operaciones a crédito.</p>
                  </li>
                  <li>
                    <p>
                      Costos por visados y/o autorizaciones de ingreso al
                      destino elegido cuando así se lo requiera (ej. USA).
                    </p>
                  </li>
                  <li>
                    <p>
                      Los gastos por prolongación de servicios o estadías por
                      deseo voluntario de los pasajeros, o por caso fortuito,
                      fuerza mayor o situaciones fuera del control razonable del
                      organizador y en general de ningún concepto que no se
                      encuentre específicamente detallado en el itinerario
                      correspondiente, tampoco situaciones de encontrarse varado
                      por causas sanitarias dispuesto por autoridades
                      gubernamentales.
                    </p>
                  </li>
                  <li>
                    <p>
                      En caso de alquiler de rodados, no están incluidos los
                      gastos de combustible, los peajes, GPS, impuestos y
                      seguros optativos u obligatorios, salvo indicación expresa
                      y descripción de los mismos en sentido contrario.
                    </p>
                  </li>
                  <li>
                    <p>
                      No están incluidos los cargos por elección de asientos en
                      aviones. La agencia se limitará a solicitar a la aerolínea
                      la ubicación preferida por el pasajero —que puede o no
                      tener un costo adicional—, pero no garantiza que la
                      aerolínea adjudique los asientos solicitados.
                    </p>
                  </li>
                  <li>
                    <p>
                      Servicio de asistencia al viajero. Es indispensable que
                      los pasajeros contraten un servicio de asistencia al
                      viajero de acuerdo con el tipo y características del
                      viaje, destino, coberturas exigidas (cfr. Tratado
                      Schengen, en caso de viajeros a Europa zona Euro) u otras
                      zonas y/o países que así lo requieran; puntualmente que
                      ampare situaciones pandémicas de asistencia y de
                      cancelación intempestiva de viaje por cierre de fronteras.
                      La agencia no responderá por situaciones que puedan estar
                      amparadas por servicios de asistencia al viajero. El
                      pasajero deberá elegir entre las coberturas que mejor le
                      amparen su situación etaria, sanitaria y duración del
                      viaje.
                    </p>
                  </li>
                </ol>

                <p>
                  <strong>Nota:</strong> PRESTE ATENCIÓN A QUE LA TARIFA AÉREA
                  ELEGIDA CONTENGA AL MENOS 1 PIEZA DE EQUIPAJE SI UD. LO DESEA
                </p>

                <h2>Cancelaciones, reembolsos y plazos</h2>
                <p>
                  En caso que el pasajero decidiere desistir y/o cancelar el
                  viaje contratado, deberá notificar a LA AGENCIA de manera
                  fehaciente su decisión, es decir en forma escrita y/o mediante
                  comunicación desde la casilla de correo electrónico informada
                  por el viajero. La fecha de recepción por la agencia será la
                  establecida como fecha de cancelación.
                </p>
                <ol>
                  <li>
                    <p>
                      Cuando se trate de desistimientos que afecten a servicios
                      contratados en firme por la Agencia, el reembolso pedido
                      antes del viaje estará sujeto a las condiciones
                      contractuales bajo las cuales presten sus servicios las
                      empresas respectivas, hoteles y/o los operadores en
                      destino. En todos los casos en que hubiera que efectuar
                      reembolsos, la agencia podrá retener el precio de los
                      gastos incurridos más una comisión del diez por ciento de
                      los servicios contratados con terceros. Los plazos para
                      las cancelaciones comenzarán a contarse a partir del
                      momento en que esta Agencia reciba aviso fehaciente de la
                      comunicación de anulación del viaje. Las sumas que
                      resulten de la aplicación de penalidades por anulaciones
                      en cualquier circunstancia o las señas por inscripción al
                      tour o circuito no serán reembolsables, no se compensarán
                      ni aplicarán a ulteriores contrataciones. Para el caso de
                      venta de pasajes aéreos, rigen las normas del Contrato de
                      Transporte Aéreo y, especialmente las condiciones
                      establecidas por cada línea aérea en la base tarifaria
                      adquirida por el pasajero, teniendo en consideración que
                      siempre se cotiza sobre la base de la tarifa más baja con
                      restricciones.
                    </p>
                  </li>
                  <li>
                    <p>
                      En caso de desistimientos de operaciones a crédito no
                      tendrán reembolso los importes abonados a la agencia de
                      viajes en concepto de informes, gastos administrativos,
                      sellados e intereses, si hubiere.
                    </p>
                  </li>
                  <li>
                    <p>
                      En todos los casos se deberán atender especialmente a las
                      condiciones de contratación del respectivo servicio (v.gr.
                      hotelería, cruceros, centros de ski, seguros, aéreos
                      nacionales o internacionales, charteados o regulares,
                      etc., así como si se tratase de eventos especiales
                      —Reveillón, Carnaval, Mardi Grass, Boat Show, Ferias,
                      Congresos y/o cualquier evento de trascendencia, etc.—
                      toda vez que, en cada caso y cada prestador, impone sus
                      determinadas condiciones de contratación. En época de
                      eventos especiales, el servicio de hotelería que se
                      cancelase no será reembolsable.
                    </p>
                  </li>
                  <li>
                    <p>
                      En el supuesto de vuelos no regulares, chárter o vuelos en
                      los que la Agencia de Viajes tenga BLOCK OFF, se aplicará
                      en cada caso el régimen que establezca el transportador,
                      conforme las normas del contrato de transporte
                      aerocomercial respectivo (Conv. Montreal, Decreto Nacional
                      1.470/97, Dec. 809/24). En caso de viaje grupal, los
                      términos y condiciones serán informados previamente a la
                      agencia y los viajeros respecto de las fechas límite y
                      modalidades de pago que establezca el transportista. En
                      caso de demoras en salidas de vuelos, se aplican las
                      normas específicas del Contrato de Transporte
                      Aerocomercial.
                    </p>
                  </li>
                  <li>
                    <p>
                      <strong>No presentación:</strong> Si el pasajero no se
                      presentase para embarcar y/o tomar los servicios
                      establecidos el día, hora y lugar indicados, el pasajero
                      será considerado como “NO SHOW” y perderá el valor total
                      del servicio aéreo, conforme normativa aerocomercial.
                      Asimismo, si no se presentase a tomar servicios terrestres
                      o de hotelería, cualquiera sea el motivo, se aplicarán las
                      condiciones de contratación respectivas. En los casos de
                      cancelaciones producidas por no llegar a formar el grupo
                      mínimo de pasajeros previstos para que la excursión se
                      lleve a cabo, o por cualquier otra causa justificada, los
                      pasajeros inscriptos tendrán únicamente el derecho a la
                      devolución de las sumas pagadas hasta el momento de la
                      notificación, sin intereses ni actualización. Los
                      pasajeros que durante el viaje en forma voluntaria
                      desistieren de utilizar algún/uno de los servicios
                      contratados, no tendrán derecho a exigir devolución de
                      suma alguna, ni compensación por los servicios desistidos
                      voluntariamente.
                    </p>
                  </li>
                  <li>
                    <p>
                      <strong>Devoluciones/reembolsos:</strong> Para las
                      devoluciones o reembolsos en caso de desistimiento de
                      viaje por motivos inherentes al pasajero regirán las
                      siguientes penalidades, salvo que el prestador determine
                      otras condiciones respecto del servicio especialmente
                      contratado, lo que será informado al contratar:
                    </p>
                    <ul>
                      <li>
                        más de 30 días corridos de la fecha de iniciación de los
                        servicios: 40% del importe total de la compra.
                      </li>
                      <li>
                        entre 29 y 15 días corridos de la fecha de iniciación de
                        los servicios: 50% del importe total de la compra.
                      </li>
                      <li>
                        entre 14 y 5 días corridos de la fecha de iniciación de
                        los servicios: 70% del importe total de la compra.
                      </li>
                      <li>
                        entre 4 días corridos antes, y la fecha de finalización
                        de los servicios: 100% del importe total de la compra.
                      </li>
                    </ul>
                    <p>
                      Las presentes penalidades rigen sin perjuicio de las que
                      establezca el operador y/o prestador del servicio en sus
                      Condiciones Generales y las que se informen en el caso de
                      servicios con penalidades diferentes a las enunciadas. Las
                      sumas que resulten de la aplicación de penalidades por
                      anulaciones en cualquier circunstancia o los importes
                      dados en concepto de reserva no serán reembolsables y no
                      se compensarán ni aplicarán a ulteriores contrataciones.
                      Para el caso de venta de pasajes aéreos, rigen las normas
                      del Contrato de Transporte aéreo y, especialmente las
                      condiciones establecidas por las líneas aéreas en la base
                      tarifaria adquirida por el pasajero. Para el caso de
                      viajes en los que se contraten servicios marítimos, se
                      aplican además, las condiciones establecidas por el Agente
                      Armador y/o explotador del buque, en todo lo relativo a
                      las condiciones de viaje y penalidades por cancelación.
                    </p>
                  </li>
                </ol>
                <p>
                  Todas las reclamaciones de reembolso deberán ser dirigidos a
                  LA AGENCIA dentro de los 30 (treinta) días siguientes a la
                  terminación del tour.
                </p>
                <p>
                  <strong>Nota importante:</strong> Atento el carácter de
                  intermediario de LA AGENCIA, el pasajero debe saber que todo
                  cambio y/o cancelación se regirán por las determinaciones del
                  Proveedor turístico. Sin perjuicio de ello LA AGENCIA asume el
                  compromiso de realizar las gestiones necesarias de
                  presentación y seguimiento pero la decisión final proviene
                  siempre del proveedor. Recuerde que cada proveedor o prestador
                  define las penalidades sin intervención de LA AGENCIA.
                </p>

                <h2>Transporte no regular - charter</h2>
                <p>
                  Toda vez que el pasajero ha sido debidamente informado por la
                  Agencia de Viajes de todo el detalle del viaje en el primer
                  documento o información emitida por esta empresa, y que los
                  prestadores aéreos y/o transportistas pueden por razones de
                  mejor servicio producir alteraciones en los horarios,
                  postergaciones y/o cancelaciones, comodidades y/o equipos
                  utilizados, etc. la Agencia de Viajes no asume responsabilidad
                  alguna, más allá de la debida información, y deja constancia
                  que en el caso de transporte aerocomercial se aplican las
                  normas sobre el contrato de transporte aéreo y sus
                  limitaciones, conforme Convenio de Montreal, Ley 26.451,
                  Código Aeronáutico y sus modificatorias, Decreto Nacional
                  1.470/97; Dec. 809/24. En el caso de transporte terrestre, las
                  normas del Código Civil y Comercial de la Nación, ley 26.994.
                </p>
                <p>
                  Se informa que el billete de transporte aéreo tiene una
                  vigencia de un año desde la fecha de su emisión,
                  independientemente de las fechas de partida y regreso y que,
                  emitido, constituye el único contrato entre las
                  transportadoras y el pasajero. Es necesario que el pasajero
                  contrate juntamente con la reserva y pago de los demás
                  servicios un seguro cuya cobertura incluya los cargos de
                  cancelación del transporte. Para hacerla efectiva, el pasajero
                  deberá efectuar el reclamo pertinente ante la aseguradora en
                  cuestión.
                </p>
                <p>
                  Conforme las leyes vigentes, cuando el transporte se lleve a
                  cabo por medios aéreos, terrestres, de locomoción, lacustre,
                  fluviales o marítimos, el viajero se somete expresamente a las
                  normas propias de cada contratación, por lo que las
                  indemnizaciones a que hubiere lugar y que pudieren pagar los
                  responsables, serán abonadas a los beneficiarios, interesados
                  o representantes legales directamente, en la moneda,
                  oportunidad y lugar que determine el responsable del servicio,
                  con las limitaciones que en cada caso las normas establezcan.
                </p>
                <p>
                  Los aeropuertos están sujetos a condiciones de tráfico,
                  operatividad, clima y condiciones sanitarias; los horarios son
                  aproximados, sin perjuicio de lo cual el pasajero deberá
                  cumplir estrictamente los horarios pautados por las líneas
                  aéreas y/o transportistas en cuanto a su presentación ante los
                  mostradores de embarque. En consecuencia, el pasajero se
                  notifica expresamente que los horarios de partida y arribo son
                  tentativos y podrían modificarse conforme decisión de la
                  transportadora o de las autoridades aeroportuarias. Por tanto,
                  la Agencia de Viajes está exenta de toda responsabilidad
                  debido a dicha contingencia y sus consecuencias en el
                  desarrollo del itinerario del pasajero. La Agencia de Viajes
                  no es responsable en ningún caso por retrasos, cambios de
                  horarios, o anulaciones de los vuelos, y tampoco de los gastos
                  que dicha situación origine, atento la especialidad de la
                  legislación en materia de transporte aerocomercial.
                </p>
                <p>
                  Los pasajeros que no se presenten a embarcar, perderán
                  inexorablemente el monto abonado y la posibilidad de efectuar
                  cambios y/o reclamaciones respecto de las reservas con
                  bloqueos y/o charters. Toda reclamación en virtud de servicios
                  aéreos deberá canalizarse a través de{" "}
                  <a
                    href="http://www.anac.gov.ar/anac/web/index.php/2/185/tramites/reclamos-quejas"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    http://www.anac.gov.ar/anac/web/index.php/2/185/tramites/reclamos-quejas
                  </a>
                  .
                </p>
                <p>
                  El equipaje permitido en vuelo es el que permita la tarifa que
                  haya elegido el pasajero y en los circuitos será de una maleta
                  por pasajero, y estará sujeto a las limitaciones y
                  reglamentaciones en materia de pesos y medidas que impongan
                  los transportistas conforme el medio de transporte utilizado;
                  y en todos los casos, es transportado por cuenta y riesgo de
                  aquél. Se sugiere controlar el peso permitido por las
                  aerolíneas transportadoras, puesto que en caso de utilizar
                  diferentes transportadoras éstos podrían variar el peso
                  permitido a los pasajeros y/o las dimensiones del equipaje
                  permitido tanto en cabina como en bodega, máxime si los vuelos
                  son de diferentes compañías o no se encuentran todos
                  registrados en una misma reserva. En tanto, el pasajero tiene
                  el deber de custodiar su equipaje de mano y/o equipaje no
                  despachado durante todo el tiempo que dure la transportación
                  por no ser responsables las transportadoras, conforme
                  legislación vigente. No se responde por daños en el equipaje,
                  pérdida o deterioro de equipajes.
                </p>
                <p>
                  Si la plaza del transporte aéreo/terrestre hubiese sido
                  confirmada al pasajero y este desiste, el importe
                  correspondiente al billete de pasaje no le será reintegrado al
                  pasajero. Si por razones de clima o fuerza mayor, el
                  transportador no pudiera cumplir con los horarios e
                  itinerarios previstos y los pasajeros decidieran cancelar el
                  viaje contratado y totalmente abonado, no tendrán derecho a
                  reclamar el reintegro del precio del pasaje e indemnización
                  alguna. El precio correspondiente a los servicios terrestres
                  (hotelería; pensión; excursiones) serán reintegrados según la
                  modalidad con que operen los prestadores de servicios. Para
                  que esta cláusula sea válida, deberá determinarse en el primer
                  documento entregado al pasajero la calidad del transporte.
                </p>

                <h3>Presentación en aeropuerto</h3>
                <ol>
                  <li>
                    <p>
                      El pasajero deberá hacerse presente al despacho respectivo
                      en el aeropuerto el día previsto y con 2 horas de
                      anticipación a la hora indicada en la documentación de
                      viaje, para vuelos nacionales y para vuelos
                      internacionales deberá ser al menos 3 horas de
                      anticipación. Para su conocimiento los horarios que se
                      reflejan en su ticket corresponden a la hora local de
                      inicio del vuelo, país de escala y/o destino. Los
                      pasajeros podrán requerir a LA AGENCIA su preferencia de
                      asiento en la aeronave. La responsabilidad de LA AGENCIA
                      se limita a informar a la compañía aérea la ubicación
                      solicitada pero no asume responsabilidad si los mismos no
                      coinciden con lo solicitado. Recuerde siempre consultar en
                      destino el horario de su vuelo.
                    </p>
                  </li>
                  <li>
                    <p>
                      <strong>
                        Reprogramaciones, demoras y/o cancelaciones de vuelos:
                      </strong>{" "}
                      Por razones ajenas a LA AGENCIA, las compañías aéreas
                      podrían modificar ciertas condiciones de los vuelos como
                      horarios, fechas o itinerarios, podrían demorarlos y/o
                      cancelarlos. LA AGENCIA informará al pasajero de dichas
                      modificaciones, le informará alternativas posibles y solo
                      procederá a confirmar las modificaciones con su previa
                      conformidad. Las compañías aéreas determinan que las
                      tarifas mas económicas son aquellas que no permiten
                      cambios, cancelaciones ni devoluciones y aun cuando lo
                      permitieran dichos cambios o cancelaciones están sujetos a
                      penalidades.                       Recuerde que el pasaje aéreo es nominativo,
                      personal e intransferible. Si su pasaje posee algún error
                      de nombre la línea aérea podría no dejarlo embarcar. Si
                      Ud. desea realizar un reclamo puede formalizarlo en{" "}
                      <a
                        href="https://www.anac.gov.ar"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        www.anac.gov.ar
                      </a>
                      , organismo que fiscaliza y certifica la actividad
                      aeronáutica comercial en la República Argentina.
                    </p>
                  </li>
                </ol>

                <h2>Cesión y transferencia</h2>
                <p>
                  El derecho que confiere al cliente, el contrato de servicios
                  turísticos, podrá ser cedido o transferido a otras personas
                  hasta TREINTA días antes de la fecha de salida, siempre que
                  las condiciones generales del TRANSPORTADOR o PRESTADORES lo
                  permitan. En los supuestos que varíen las edades de los
                  pasajeros cesionarios (mayores - menores) se ajustará el
                  precio según corresponda. En todos los casos de cesión o
                  transferencia, LA AGENCIA percibirá una comisión del DIEZ POR
                  CIENTO sobre el precio total.
                </p>

                <h2>No show</h2>
                <p>
                  Si el pasajero no se presenta a utilizar su reserva en la
                  fecha y hora convenidas o llega con atraso no tendrá derecho a
                  exigir la devolución total o parcial de lo abonado.
                </p>

                <h2>
                  Artículo 19 - Dec. 809/24. Derecho de revocación o
                  arrepentimiento
                </h2>
                <p>
                  En los contratos celebrados a distancia el Pasajero podrá
                  ejercer su derecho de revocación dentro de los DIEZ (10) días
                  corridos contados a partir de la celebración del contrato,
                  siempre y cuando las condiciones tarifarias elegidas por dicho
                  Pasajero al momento de contratar permitan la devolución dentro
                  de sus condiciones contractuales y su reembolso.
                </p>
                <p>
                  Conforme a ello, para aquellos casos en los que las
                  condiciones de la tarifa y del contrato de transporte aéreo
                  así lo permitan, el Transportador deberá arbitrar los medios
                  necesarios en sus páginas web para que, clara y ágilmente, se
                  permita al Pasajero ejercer de manera adecuada y de
                  conformidad con lo previsto en este Reglamento su derecho de
                  revocación o arrepentimiento en el plazo indicado en el
                  párrafo anterior.
                </p>

                <h2>Limitaciones al derecho de permanencia</h2>
                <p>
                  Esta agencia o los operadores locales tendrán el derecho de
                  hacer que abandone el tour y/o los servicios turísticos en
                  cualquier punto del itinerario todo pasajero cuya conducta
                  disruptiva, modo de obrar, estado de salud y/u otras razones
                  graves a juicio de esta Agencia —o de los prestadores locales
                  en cada destino— provocaren peligro y/o causaren molestias a
                  los restantes viajeros y/o que pudiere malograr el éxito de la
                  excursión y/o su normal desarrollo. En esos casos, se
                  aplicarán las penalidades establecidas en el capítulo
                  “Alteraciones o Modificaciones”.
                </p>

                <h2>Documentación</h2>
                <p>
                  Esta Agencia le informará por escrito y con anticipación
                  suficiente sobre los requisitos que exijan las autoridades
                  migratorias, aduaneras y/o sanitarias de los destinos que
                  incluye el tour, siendo responsabilidad exclusiva del pasajero
                  contar con la documentación personal que exijan las
                  autoridades en cada caso y destino. Es obligación inexcusable
                  del pasajero obtener y presentar la documentación en los
                  momentos en que le sea requerida por la autoridad migratoria,
                  policial y/o sanitaria y/o quien correspondiera de acuerdo con
                  el tipo de viaje elegido. El pasajero se obliga, a su cargo, a
                  tramitar el pasaporte sanitario que exigiere el origen y/o
                  destino de viaje. El pasajero es responsable de informarse
                  adecuadamente sobre la documentación necesaria, visados y
                  vacunas, así como los requisitos migratorios de los países
                  extranjeros.
                </p>
                <p>
                  Esta Agencia no asume responsabilidad por deficiencias de
                  cualquier naturaleza en la documentación, tramitación y/o
                  falta de visados, errores en la emisión de los documentos
                  personales, vigencia de pasaportes y/u otros documentos de
                  viaje, permisos para viajes con menores etc. En caso de
                  documentación no presentada adecuadamente, visados y/o vacunas
                  que impida al pasajero salir, entrar, permanecer y/o transitar
                  en algún país, se aplican las condiciones establecidas en el
                  apartado “Alteraciones o Modificaciones”.
                </p>
                <p>
                  Aquellos pasajeros que no cuenten con documentos de viaje en
                  regla podrán tramitar su pasaporte y/u otro documento conforme
                  las precisiones que se indican en el sitio{" "}
                  <a
                    href="https://www.argentina.gob.ar/tramitar-el-pasaporte"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.argentina.gob.ar/tramitar-el-pasaporte
                  </a>
                  . En algunos aeropuertos argentinos se pueden tramitar el
                  pasaporte al instante. Consulte:{" "}
                  <a
                    href="http://www.mininterior.gov.ar/NuevoPasaporte/alinstante/al-instante.php"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    http://www.mininterior.gov.ar/NuevoPasaporte/alinstante/al-instante.php
                  </a>
                  . Consulte en el sitio{" "}
                  <a
                    href="https://www.cancilleria.gob.ar/es/servicios/documentacion/visas-para-argentinos"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.cancilleria.gob.ar/es/servicios/documentacion/visas-para-argentinos
                  </a>{" "}
                  para conocer si Ud. requiere visado de ingreso al país de
                  destino.
                </p>
                <p>
                  Si el pasajero tiene nacionalidad distinta a la argentina,
                  deberá informar dicha situación a esta Agencia y solicitar se
                  le informe sobre los requisitos exigidos por el destino de su
                  viaje conforme la nacionalidad que ostente. En caso de viajar
                  con menores, los pasajeros deberán llevar toda la
                  documentación exigida por la autoridad migratoria. Al
                  respecto, deberá consultar el sitio web:{" "}
                  <a
                    href="http://www.migraciones.gov.ar/accesible/indexA.php?doc_pais"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    http://www.migraciones.gov.ar/accesible/indexA.php?doc_pais
                  </a>{" "}
                  (solapa Procedimiento para Niños, Niñas y Adolescentes). Se
                  sugiere consultar específicamente los servicios oficiales de
                  información sobre medicina del viajero{" "}
                  <a
                    href="http://msal.gob.ar/viajeros"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    http://msal.gob.ar/viajeros
                  </a>{" "}
                  y de la Cancillería Argentina respecto de las medidas y
                  requisitos a tener en cuenta para cada destino y también su
                  Obra Social o Medicina Prepaga teniendo en cuenta edad,
                  destino y duración del viaje.
                </p>
                <p>
                  Es obligación del pasajero informar por escrito a la Agencia
                  de viajes sobre necesidades especiales que requiriera tanto en
                  vuelo como en aeropuertos y excursiones. De acuerdo con el
                  destino de viaje elegido, podrían existir sitios, excursiones
                  y/o lugares con dificultad o imposibilidad de acceso para
                  personas con movilidad reducida, razón por la cual podría
                  ocurrir que alguna/s excursión/es no puedan ser brindadas por
                  el operador turístico local por imposibilidad fáctica. En
                  tales casos, de conformidad con lo establecido en la ley
                  25.643, se informará sobre cuál o cuáles paseos o excursiones
                  podrían verse impedidos de realización y/o afectados en su
                  desarrollo.
                </p>

                <h2>Menores de edad</h2>
                <p>
                  Para viajar al exterior de la República Argentina, los menores
                  de 18 años de edad deberán tener autorización expresa,
                  conforme la Ley 26.994 y Disposiciones de la DIRECCIÓN
                  NACIONAL DE MIGRACIONES. Dicha autorización debe ser otorgada
                  por ambos progenitores ante Escribano Público Nacional con la
                  Legalización del Colegio Público correspondiente (para
                  C.A.B.A. ver registro electrónico de Autorizaciones de menores
                  de edad en{" "}
                  <a
                    href="https://www.argentina.gob.ar/procedimiento-para-ninos-ninas-y-adolescentes"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    https://www.argentina.gob.ar/procedimiento-para-ninos-ninas-y-adolescentes
                  </a>
                  ; Cónsules argentinos y extranjeros. Debe estar legalizado
                  ante el Ministerio de Relaciones Exteriores y Culto o
                  Apostillado. Consultar Página del Ministerio de Relaciones
                  Exteriores y Culto (Autorizaciones de viaje de menores de edad
                  exceptuadas de legalización consular: Son las expedidas en
                  Brasil, Chile, Paraguay y Uruguay); Autoridades del Registro
                  de Estado Civil y Capacidad de las Personas, Agentes de esta
                  Dirección Nacional, Jueces de paz; otras Autoridades
                  Administrativas y Judiciales habilitadas a certificar firmas
                  con la acreditación de la norma que le otorga tal
                  habilitación, Jueces competentes.
                </p>
                <p>
                  Si el menor viajase con ambos progenitores, además de los
                  documentos de identidad y visas de todo el grupo familiar,
                  también deberán exhibir el original de la libreta de
                  matrimonio (original) o la partida de nacimiento legalizada a
                  fin de la justificación de los vínculos filiatorios,
                  testimonio Judicial de adopción u otro instrumento público que
                  dé plena fe del vínculo que invocan o de la Tutela o Curatela
                  o DNI de formato digital donde figuren los datos filiatorios
                  de ambos padres.
                </p>
                <p>
                  Si el menor viajase con uno solo de los progenitores o
                  tutores, además de los requisitos antes mencionados, deberá
                  exhibir, ante la autoridad migratoria nacional, la
                  autorización del progenitor que no viaja, otorgada también por
                  ante Escribano Público Nacional, con su firma legalizada, y/o
                  en las dependencias y organismos arriba mencionados. Si uno de
                  los progenitores hubiese fallecido, deberá aportarse, además,
                  certificado o partida de defunción. Para más información, el
                  pasajero deberá consultar la siguiente página web:{" "}
                  <a
                    href="http://www.migraciones.gov.ar/accesible/indexA.php?doc_pais"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    http://www.migraciones.gov.ar/accesible/indexA.php?doc_pais
                  </a>{" "}
                  (solapa Procedimiento para Niños, Niñas y Adolescentes).
                </p>
                <p>
                  Debido a normas internacionales, todos los documentos de viaje
                  deben tener fotografía del menor a que corresponde el
                  documento de identidad, actualizada. En los casos de permisos
                  de viaje para hacerlo a países de habla inglesa, el permiso de
                  salida de Argentina debe estar traducido por traductor público
                  nacional y su firma debidamente legalizada ante el Colegio de
                  Traductores de la localidad de matriculación del traductor.
                  Los sitios mencionados para obtener información en cada caso
                  son solo sugerencias que podrán modificarse sin previo aviso.
                  La Agencia y el pasajero son responsables de obtener la
                  información en los organismos oficiales pertinentes.
                </p>
                <p>
                  Esta Agencia no será responsable por la tramitación y vigencia
                  de la documentación del viajero y sus acompañantes como
                  tampoco respecto de los inconvenientes que por tal causa
                  pudiera sufrir, y será a cargo del pasajero todos los gastos
                  que correspondan por demoras y/o abandono del viaje motivados
                  por falta o deficiencia de la documentación necesaria para su
                  realización.
                </p>
                <p>
                  <strong>Nota:</strong> Los pasaportes deben contar con una
                  vigencia no inferior a 6 meses y DNI.
                </p>

                <h3>Recuerde</h3>
                <ul>
                  <li>
                    Que la documentación también puede ser requerida en el
                    territorio de países en tránsito, aun cuando no sea
                    necesario salir del aeropuerto.
                  </li>
                  <li>
                    Los requisitos varían según su nacionalidad, edad y lugar de
                    residencia.
                  </li>
                  <li>
                    Para viajar a cualquier país extranjero en calidad de
                    turista es necesario poseer un billete y/o ticket de retorno
                    a la Argentina y la estadía máxima no puede superar los 90
                    días (consultar excepciones en el consulado de destino.
                    Asimismo se advierte que podrían solicitarle fondos
                    suficientes para su manutención, dirección del hospedaje y
                    otros). Todo ello debe ser consultado con el consulado
                    correspondiente.
                  </li>
                </ul>

                <h2>Responsabilidad: carácter de intermediario</h2>
                <p>
                  Esta agencia es intermediaria en la reserva o contratación de
                  los distintos servicios vinculados e incluidos en el
                  respectivo tour o reservación de servicios: hoteles,
                  restaurantes, medios de transportes u otros prestadores. Esta
                  agencia no es responsable por los hechos fortuitos o de fuerza
                  mayor, fenómenos climáticos, de la naturaleza, pandémicos y
                  epidémicos, situaciones de conflicto bélico que acontezcan
                  previo o durante el desarrollo del tour y que impidan, demoren
                  o de cualquier modo obstaculicen la ejecución total o parcial
                  de las prestaciones comprometidas por esta empresa, todo ello
                  de conformidad con las disposiciones del Código Civil y
                  Comercial de la Nación.
                </p>
                <p>
                  La Agencia informará al pasajero en caso de situaciones de
                  conflicto que pudiere atravesar el lugar de destino y, el
                  pasajero, debidamente informado, decidirá personalmente si
                  llevar a cabo o no el viaje. En caso que decida viajar, deberá
                  hacer constar por escrito que sin perjuicio de lo informado
                  por la Agencia decide viajar a dicho destino.
                </p>
                <p>
                  Se deja a salvo que todo viaje queda supeditado a las
                  disposiciones sanitarias y/o migratorias del país de origen y
                  destino de cada viaje en el momento preciso en que deba
                  iniciar o finalizar el viaje.
                </p>
                <p>
                  Si el viaje por razones ajenas a la voluntad de la empresa,
                  sea por caso fortuito o fuerza mayor, o fenómenos climáticos
                  se prolongase más allá de los tiempos fijados, los gastos
                  ocasionados por la prolongación de las estadías (alojamiento,
                  comidas) serán exclusivamente a cargo del pasajero. LA AGENCIA
                  no se responsabiliza por daños en las personas o equipajes,
                  estando esta a cargo de los respectivos prestadores. Cuando el
                  transporte se efectúe en autocares propios o alquilados, el
                  viajero se somete expresamente a la legislación en materia de
                  accidentes por carreteras, de la Nación en que se haya
                  matriculado el vehículo.
                </p>

                <h2>Asistencia al viajero</h2>
                <p>
                  Los pasajeros deben obligatoriamente contratar asistencia al
                  viajero acorde con su rango etario y geolocalización del
                  destino elegido, la cual deberá cubrir la totalidad del tiempo
                  de permanencia acorde con el viaje y los valores mínimos de
                  prestación exigidos en el lugar de destino de viaje. El
                  pasajero deberá consultar si en su destino de viaje existen
                  exigencias especiales a este respecto. De no hacerlo, se
                  entiende que asumen en forma personal todos los riesgos de
                  cualquier naturaleza que se pudiesen presentar sobre su
                  persona, sus bienes y/o de terceros.
                </p>
                <p>
                  Toda asistencia al viajero, aun la que no se contrate a través
                  de la intermediación de esta agencia de viajes debe amparar la
                  contingencia “pandemia” por asistencia y cancelación o
                  suspensión del viaje.
                </p>

                <h2>Datos personales</h2>
                <p>
                  Los datos personales contenidos en las reservas de viaje
                  contratadas a través de esta Agencia son tratados conforme
                  establece la Ley 25.326 y serán conservados el menor tiempo
                  necesario. Sólo serán divulgados aquellos datos indispensables
                  para concretar las reservas de los servicios elegidos.
                </p>
                <p>
                  En materia de datos personales: el titular de los datos
                  personales tiene la facultad de ejercer el derecho de acceso a
                  los mismos en forma gratuita a intervalos no inferiores a seis
                  meses, salvo que acredite un interés legítimo (cfr. Art. 14,
                  inc. 3° Ley Nº 25.326). La Dirección Nacional de Protección de
                  Datos Personales tiene la atribución de atender las denuncias
                  y reclamos que se interpongan con relación al incumplimiento
                  de las normas sobre protección de datos personales.
                </p>
                <p>
                  El titular podrá en cualquier momento solicitar el retiro o el
                  bloqueo de su nombre de los bancos de datos en los que se
                  hallen sus datos. En toda comunicación con fines de publicidad
                  que se realice por correo, teléfono, correo electrónico,
                  internet u otro medio a distancia se deberá indicar, en forma
                  expresa y destacada, la posibilidad del titular del dato de
                  solicitar el retiro o bloqueo, total o parcial, de su nombre
                  de la base de datos. A pedido del interesado, se deberá
                  informar el nombre del responsable o usuario del banco de
                  datos que proveyó la información.
                </p>

                <h2>Alteraciones - Modificaciones</h2>
                <p>
                  LA AGENCIA se reserva el derecho, por razones técnicas u
                  operativas de alterar total o parcialmente el ordenamiento
                  diario y/o servicios que componen el tour, antes o durante la
                  ejecución del mismo. Salvo condición expresa en contrario, los
                  hoteles estipulados podrán ser cambiados por otros de igual o
                  mayor categoría dentro del mismo núcleo urbano, sin cargo
                  extra para el pasajero. Respecto de estas variaciones el
                  pasajero no tendrá derecho a indemnización alguna. Una vez
                  comenzado el viaje, la suspensión, modificación o interrupción
                  de los servicios por parte del pasajero, por razones
                  personales de cualquier índole, no dará lugar a reclamo,
                  devolución o indemnización alguna.
                </p>
                <p>
                  En caso de programas que incluyan transportes, hoteles,
                  excursiones programadas, las mismas podrán ser postergadas,
                  suspendidas o canceladas si no se completa el número mínimo de
                  pasajeros necesario para el normal cumplimiento del tour,
                  teniendo el derecho los pasajeros a que le sea devuelto el
                  total de lo abonado, sin intereses ni indemnización.
                </p>

                <h2>Normas de aplicación</h2>
                <p>
                  El presente, y en su caso la prestación de los servicios se
                  regirá por las condiciones particulares, estas condiciones
                  generales, así como el Código Civil y Comercial de la Nación y
                  la Ley de Defensa del Consumidor, conocida por las partes.
                  Toda la documentación que se genere a favor del pasajero y se
                  entregue a la Agencia como consecuencia del viaje, conformará
                  el Contrato de Viaje, y es información confidencial, protegida
                  por La Ley de Protección de Datos Personales, Ley 25.326.
                </p>
                <p>
                  En materia aerocomercial, rigen las estipulaciones del Código
                  Aeronáutico, Conv. Montreal y Decreto 809/24. Respecto de los
                  pagos, rigen las Comunicaciones de BCRA relativas a giro de
                  divisas al exterior vigentes a la fecha y las normas del
                  Código Civil y Comercial de la Nación en materia de
                  obligaciones de dar dinero cuando se trate de moneda de curso
                  legal o de dar cosas cuando se trate de moneda extranjera.
                </p>

                <h2>Comunicación entre las partes</h2>
                <p>
                  Las partes, de común acuerdo y en pleno uso de la autonomía de
                  la voluntad consienten utilizar técnicas de la comunicación e
                  información, conforme el art. 1106 CCCN, y la instrumentación
                  del contrato de viaje se hará presencial o por medios
                  electrónicos, conforme autoriza el art. 287 CCCN, de
                  conformidad con la forma de contratación que las partes opten.
                </p>
                <p>
                  Es parte de los términos de esta contratación que la oferta
                  está sujeta a las correspondientes autorizaciones
                  gubernamentales, sanitarias nacionales y/o extranjeras
                  vigentes a la fecha del comienzo o finalización del
                  viaje/estadía, así como la situación política/sanitaria del
                  país de destino. Las aerolíneas/navieras y demás prestadores
                  vinculados a su viaje podrán disponer protocolos que deberán
                  ser necesariamente observados por los pasajeros, los que se
                  informarán previo al inicio de su viaje/estadía. El pasajero
                  deberá estar atento a la información dinámica proveniente de
                  las autoridades de los diferentes países destino de su viaje.
                </p>

                <h2>Incumplimiento</h2>
                <p>
                  En caso de efectiva divergencia entre los servicios ofrecidos
                  y los servicios contratados, el pasajero podrá recurrir ante
                  el Servicio Nacional de Arbitraje de Consumo y/o a las
                  Oficinas del consumidor correspondientes según su domicilio
                  (cfr. Ley 25.651).
                </p>
              </article>
            </div>
          </div>
        </section>
      </div>

      <HomeFooter />
    </>
  );
}
