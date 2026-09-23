'use client';

import { useMemo, useState } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AnimatePresence, motion } from 'framer-motion';
import * as Accordion from '@radix-ui/react-accordion';
import { Button } from '@/components/ui/button';
import { CheckCircle, ChevronDown, ChevronRight, MessageCircle, Phone, XCircle } from 'lucide-react';

type DocTab = 'dashboard' | 'categorias' | 'paquetes' | 'banners' | 'consultas' | 'newsletter' | 'ayuda';
type HelpModule = Exclude<DocTab, 'ayuda'>;

type ImageSpec = { titulo: string; recomendado: string; paraQueSirve: string; notas?: string };
type Section = { titulo: string; descripcion?: string; items: string[] };
type AccordionEntry = { titulo: string; descripcion?: string; items: string[] };
type ModuleDoc = {
  titulo: string;
  resumen: string;
  consejos?: string[];
  acciones: Section[];
  imagenes: ImageSpec[];
};

function SoftCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-0 bg-white/70 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-sm font-semibold text-gray-800 ring-1 ring-black/5">
            {index + 1}
          </div>
          <p className="text-base text-gray-700">{item}</p>
        </li>
      ))}
    </ol>
  );
}

function Tips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-semibold text-gray-700 ring-1 ring-black/5"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ImageCards({ items }: { items: ImageSpec[] }) {
  if (items.length === 0) {
    return <p className="text-base text-gray-700">En esta sección no se cargan imágenes.</p>;
  }
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.titulo}
          className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">{item.titulo}</p>
              <p className="mt-0.5 text-sm text-gray-600">{item.paraQueSirve}</p>
            </div>
            <Badge className="w-fit bg-black text-white hover:bg-black font-semibold">{item.recomendado}</Badge>
          </div>
          {item.notas && <p className="mt-2 text-sm text-gray-600">{item.notas}</p>}
        </div>
      ))}
    </div>
  );
}

function AccordionList({ items, defaultValue }: { items: AccordionEntry[]; defaultValue?: string }) {
  return (
    <Accordion.Root type="single" collapsible className="space-y-3" defaultValue={defaultValue}>
      {items.map((item, index) => (
        <Accordion.Item
          key={item.titulo}
          value={`item-${index}`}
          className="group overflow-hidden rounded-2xl bg-gradient-to-b from-white/80 to-white/55 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
        >
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-semibold text-gray-900 sm:px-5">
              <span className="min-w-0">{item.titulo}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden border-t border-black/5 px-5 text-base text-gray-700 transition-[max-height,opacity] duration-150 ease-out data-[state=closed]:max-h-0 data-[state=closed]:opacity-0 data-[state=open]:max-h-[520px] data-[state=open]:opacity-100">
            <div className="py-4">
              {item.descripcion && <p className="mb-3 text-sm text-gray-600">{item.descripcion}</p>}
              <StepList items={item.items} />
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

function GoodBad({
  good,
  bad,
}: {
  good: string[];
  bad: string[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-base font-semibold text-gray-900">Bien</p>
        </div>
        <ul className="mt-3 space-y-2 text-base text-gray-700">
          {good.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-success/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          <p className="text-base font-semibold text-gray-900">Evitar</p>
        </div>
        <ul className="mt-3 space-y-2 text-base text-gray-700">
          {bad.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DocumentacionAdminPage() {
  const [tab, setTab] = useState<DocTab>('dashboard');
  const [helpModule, setHelpModule] = useState<HelpModule>('paquetes');

  const docs = useMemo<Record<HelpModule, ModuleDoc>>(
    () => ({
      dashboard: {
        titulo: 'Dashboard',
        resumen: 'Un resumen rápido con números clave y accesos directos a lo más usado.',
        consejos: ['Ideal para empezar el día', 'Todo en una sola vista'],
        acciones: [
          {
            titulo: 'Cómo usarlo',
            items: [
              'Entrá al Dashboard para ver un resumen general.',
              'Si ves “consultas nuevas”, entrá a Consultas para responderlas.',
              'Usá los accesos directos para ir al listado de categorías, paquetes o newsletter.',
            ],
          },
        ],
        imagenes: [],
      },
      categorias: {
        titulo: 'Categorías',
        resumen: 'Sirven para organizar los destinos/temas y mantener el sitio ordenado.',
        consejos: ['Nombre claro y corto', 'Descripción simple y directa'],
        acciones: [
          {
            titulo: 'Crear una categoría',
            items: [
              'Hacé clic en “Nueva Categoría”.',
              'Completá Nombre y Descripción.',
              'Subí una imagen de portada (obligatoria).',
              'Activá/Desactivá “Categoría activa” según quieras que se vea en el sitio.',
              'Guardá.',
            ],
          },
          {
            titulo: 'Editar una categoría',
            items: ['Entrá al listado, tocá “Editar”, actualizá los datos y guardá.'],
          },
          {
            titulo: 'Eliminar una categoría',
            items: ['Desde el listado, elegí “Eliminar” y confirmá.'],
          },
          {
            titulo: 'Cambiar el orden de aparición',
            descripcion: 'Esto define cómo se ven en el listado del admin y en algunas secciones del sitio.',
            items: [
              'En el listado, tocá “Reordenar elementos”.',
              'Arrastrá las filas hasta dejar el orden deseado.',
              'Tocá “Guardar orden”.',
            ],
          },
          {
            titulo: 'Buscar',
            items: ['Usá el buscador para encontrar por nombre o descripción.'],
          },
        ],
        imagenes: [
          {
            titulo: 'Imagen de portada',
            recomendado: '1200 × 800 px',
            paraQueSirve: 'Se usa como imagen principal de la categoría.',
            notas: 'Podés subir JPG o PNG. Si la imagen es muy distinta al tamaño recomendado, puede recortarse para encajar.',
          },
        ],
      },
      paquetes: {
        titulo: 'Paquetes',
        resumen: 'Acá cargás, editás y ordenás los paquetes que ve el usuario en el sitio.',
        consejos: ['Título específico', 'Fotos de buena calidad', 'Revisá que quede “Visible” antes de publicar'],
        acciones: [
          {
            titulo: 'Crear un paquete',
            items: [
              'Hacé clic en “Nuevo Paquete”.',
              'Completá Título, Descripción, Categoría, Precio, Duración y el resto de datos.',
              'Cargá las imágenes obligatorias (tarjeta y portada).',
              'Si querés que aparezca en el inicio, activá “Destacado”.',
              'Dejá “Visible” activado para que se vea en el sitio.',
              'Guardá.',
            ],
          },
          {
            titulo: 'Editar un paquete',
            items: ['Entrá al listado, tocá “Editar”, ajustá lo necesario y guardá.'],
          },
          {
            titulo: 'Ver el detalle público',
            items: ['En el listado, usá la acción “Ver” para abrir el detalle del paquete en una pestaña nueva.'],
          },
          {
            titulo: 'Eliminar un paquete',
            items: ['Desde el listado, elegí “Eliminar” y confirmá.'],
          },
          {
            titulo: 'Cambiar el orden de aparición',
            items: [
              'En el listado, tocá “Reordenar elementos”.',
              'Arrastrá las filas hasta dejar el orden deseado.',
              'Tocá “Guardar orden”.',
            ],
          },
          {
            titulo: 'Paquetes destacados (inicio)',
            descripcion: 'En el inicio se muestran hasta 9 destacados, según el orden configurado.',
            items: [
              'Activá “Destacado” para que el paquete participe del inicio.',
              'Al crear, podés elegir en qué posición del inicio querés que aparezca.',
              'Si ya hay 9 destacados, igual podés marcarlo, pero el inicio solo mostrará los primeros 9.',
            ],
          },
          {
            titulo: 'Buscar',
            items: ['Usá el buscador para encontrar por título, destino o descripción.'],
          },
        ],
        imagenes: [
          {
            titulo: 'Imagen para la tarjeta',
            recomendado: 'Formato horizontal (ej. 1600 × 900 px)',
            paraQueSirve: 'Se ve en las tarjetas/listados del sitio.',
            notas: 'Elegí una imagen horizontal. Si es vertical, se recortará.',
          },
          {
            titulo: 'Imagen principal (portada)',
            recomendado: 'Formato horizontal (ej. 1920 × 1080 px)',
            paraQueSirve: 'Se ve arriba del detalle del paquete.',
            notas: 'Ideal que tenga un punto focal centrado (persona/paisaje) para que se vea bien en celular.',
          },
          {
            titulo: 'Fotos de la galería',
            recomendado: 'Para miniaturas: cuadradas (ej. 1200 × 1200 px)',
            paraQueSirve: 'Fotos adicionales que aparecen en la galería del detalle.',
            notas: 'Las miniaturas se muestran cuadradas; si subís fotos horizontales, en la miniatura se recortarán para encajar.',
          },
        ],
      },
      banners: {
        titulo: 'Banners',
        resumen: 'Imágenes del carrusel principal del inicio.',
        consejos: ['Texto importante centrado', 'Imagen liviana y nítida'],
        acciones: [
          {
            titulo: 'Subir banners',
            items: [
              'Entrá a “Nuevo banner”.',
              'Subí una o varias imágenes (hasta 6).',
              'Tocá “Guardar banners”.',
            ],
          },
          {
            titulo: 'Activar o desactivar un banner',
            items: ['En el listado, usá el interruptor para dejarlo activo/inactivo.'],
          },
          {
            titulo: 'Cambiar el orden de aparición',
            items: [
              'En el listado, arrastrá los banners para reordenarlos.',
              'Tocá “Guardar orden”.',
              'Si estás viendo un filtro, el orden puede estar bloqueado para evitar errores.',
            ],
          },
          {
            titulo: 'Eliminar un banner',
            items: ['Tocá el icono de eliminar y confirmá.'],
          },
        ],
        imagenes: [
          {
            titulo: 'Imagen de banner',
            recomendado: '1920 × 500 px (modelo único)',
            paraQueSirve: 'Se muestra en el carrusel del inicio.',
            notas: 'Formato horizontal. Mantener proporción 3.84:1 para respetar el modelo del sitio. Evitá texto pegado a los bordes porque en celular puede recortarse.',
          },
        ],
      },
      consultas: {
        titulo: 'Consultas',
        resumen: 'Mensajes que llegan desde el sitio (clientes interesados).',
        consejos: ['Respondé rápido', 'Usá WhatsApp para cerrar la venta'],
        acciones: [
          {
            titulo: 'Ver el detalle de una consulta',
            items: ['Tocá una consulta para abrir el detalle en una ventana.'],
          },
          {
            titulo: 'Marcar como vista',
            items: ['Cuando la abrís, queda marcada como vista automáticamente.'],
          },
          {
            titulo: 'Responder por WhatsApp',
            items: ['Dentro del detalle, tocá “Contactar por WhatsApp”. Se abrirá WhatsApp con un mensaje sugerido.'],
          },
          {
            titulo: 'Recorrer la lista',
            items: ['Usá la paginación para ver más consultas.'],
          },
        ],
        imagenes: [],
      },
      newsletter: {
        titulo: 'Newsletter',
        resumen: 'Listado de personas suscriptas para recibir novedades.',
        consejos: ['Mantené activos los emails válidos', 'Exportá para campañas'],
        acciones: [
          {
            titulo: 'Buscar un suscriptor',
            items: ['Usá el buscador por email.'],
          },
          {
            titulo: 'Activar o desactivar',
            items: ['En el listado, usá el botón para activar/desactivar un email.'],
          },
          {
            titulo: 'Eliminar',
            items: ['Tocá eliminar y confirmá.'],
          },
          {
            titulo: 'Exportar',
            items: ['Tocá “Exportar CSV” para descargar la lista.'],
          },
        ],
        imagenes: [],
      },
    }),
    []
  );

  const current = docs[tab === 'ayuda' ? helpModule : tab];

  const flujoRecomendado = useMemo(
    () => ['Crear categoría', 'Crear paquete', 'Subir banners', 'Revisar consultas', 'Exportar newsletter'],
    []
  );

  const erroresComunes = useMemo<Record<HelpModule, AccordionEntry[]>>(
    () => ({
      dashboard: [
        {
          titulo: 'No veo números actualizados',
          items: [
            'Actualizá la página.',
            'Entrá y salí del panel si seguís viendo lo mismo.',
            'Si el problema sigue, avisá por WhatsApp con una captura.',
          ],
        },
      ],
      categorias: [
        {
          titulo: 'La categoría no se ve en el sitio',
          items: [
            'Entrá a la categoría y confirmá que esté activa.',
            'Revisá que tenga imagen de portada cargada.',
            'Si recién la creaste, actualizá el sitio y probá de nuevo.',
          ],
        },
        {
          titulo: 'No queda en el orden que quiero',
          items: [
            'Entrá al listado de Categorías.',
            'Tocá “Reordenar elementos”.',
            'Arrastrá y soltá hasta acomodarlas.',
            'Tocá “Guardar orden”.',
          ],
        },
      ],
      paquetes: [
        {
          titulo: 'El paquete no se ve en el sitio',
          items: [
            'Entrá al paquete y confirmá que esté “Visible”.',
            'Revisá que tenga imágenes cargadas (tarjeta y principal).',
            'Si elegiste una categoría, confirmá que esa categoría esté activa.',
          ],
        },
        {
          titulo: 'No aparece en el inicio',
          items: [
            'Entrá al paquete y activá “Destacado”.',
            'Si ya hay muchos destacados, revisá el orden de aparición.',
            'Actualizá el sitio y volvé a mirar el inicio.',
          ],
        },
        {
          titulo: 'La foto se ve “cortada”',
          items: [
            'Probá con una foto horizontal (paisaje) para la imagen principal y la de tarjeta.',
            'Evitá texto pegado a los bordes.',
            'Elegí una imagen con el punto importante en el centro.',
          ],
        },
      ],
      banners: [
        {
          titulo: 'El banner no aparece en el inicio',
          items: [
            'En el listado de Banners, asegurate de que esté activo.',
            'Revisá el orden y guardalo si hiciste cambios.',
            'Actualizá el sitio y probá de nuevo.',
          ],
        },
        {
          titulo: 'La imagen se recorta en celular',
          items: [
            'Evitá texto importante en los bordes de la imagen.',
            'Usá una imagen horizontal y centrada.',
            'Probá con el tamaño recomendado.',
          ],
        },
      ],
      consultas: [
        {
          titulo: 'No encuentro una consulta',
          items: ['Usá la paginación para ir a las consultas más viejas.', 'Revisá si ya la marcaste como vista al abrirla.'],
        },
        {
          titulo: 'No abre WhatsApp',
          items: [
            'Probá de nuevo tocando “Contactar por WhatsApp”.',
            'Si estás en computadora, verificá que WhatsApp Web esté abierto.',
            'Si sigue sin abrir, avisá por WhatsApp con una captura.',
          ],
        },
      ],
      newsletter: [
        {
          titulo: 'No encuentro un email',
          items: ['Usá el buscador y probá con una parte del email.', 'Si hay muchos resultados, revisá la paginación.'],
        },
        {
          titulo: 'Exporté y no veo los cambios',
          items: ['Volvé a exportar el CSV.', 'Asegurate de haber guardado antes de exportar si hiciste cambios.'],
        },
      ],
    }),
    []
  );

  const preguntasFrecuentes = useMemo<AccordionEntry[]>(
    () => [
      {
        titulo: '¿Por qué se recorta una foto?',
        items: [
          'Porque la foto se ajusta automáticamente para verse bien en distintas pantallas.',
          'Si la foto es muy vertical o el punto importante está en un borde, puede “cortarse”.',
          'Para evitarlo, usá fotos horizontales y con el punto importante en el centro.',
        ],
      },
      {
        titulo: '¿Qué tamaño conviene para las imágenes?',
        items: [
          'Usá los tamaños recomendados que aparecen en la sección “Imágenes”.',
          'Si la imagen es mucho más chica, puede verse menos nítida.',
          'Si es demasiado pesada, conviene usar una versión más liviana.',
        ],
      },
      {
        titulo: '¿Cómo hago para que algo aparezca en el inicio?',
        items: [
          'Banners: subilos en “Banners” y dejalos activos.',
          'Paquetes: activá “Destacado” y revisá el orden de aparición.',
          'Después, actualizá el sitio y volvé a mirar el inicio.',
        ],
      },
    ],
    []
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black/[0.04] via-white to-black/[0.03] p-6 shadow-[0_22px_55px_-40px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-2xl" />
            <div className="absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-gradient-to-br from-black/10 to-transparent blur-2xl" />
            <div className="relative">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Guía de uso</h1>
              <p className="mt-1 text-sm text-gray-600">
                Instrucciones simples, paso a paso, para usar el panel admin sin complicaciones.
              </p>
              <div className="mt-4">
                <Tabs value={tab} onValueChange={(v) => setTab(v as DocTab)}>
                  <TabsList className="w-full overflow-x-auto bg-white/60 shadow-[0_14px_40px_-32px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur">
                    <TabsTrigger
                      value="dashboard"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                      value="categorias"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Categorías
                    </TabsTrigger>
                    <TabsTrigger
                      value="paquetes"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Paquetes
                    </TabsTrigger>
                    <TabsTrigger
                      value="banners"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Banners
                    </TabsTrigger>
                    <TabsTrigger
                      value="consultas"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Consultas
                    </TabsTrigger>
                    <TabsTrigger
                      value="newsletter"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Newsletter
                    </TabsTrigger>
                    <TabsTrigger
                      value="ayuda"
                      className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-[0_14px_35px_-28px_rgba(0,0,0,0.45)] data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                    >
                      Ayuda
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-5"
            >
              {tab === 'ayuda' ? (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="border-0 bg-white/70 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur lg:col-span-2">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">Centro de ayuda</CardTitle>
                        <p className="text-sm text-gray-600">
                          Soluciones rápidas, tips y preguntas frecuentes. Elegí la sección sobre la que necesitás ayuda.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Tabs value={helpModule} onValueChange={(v) => setHelpModule(v as HelpModule)}>
                          <TabsList className="w-full overflow-x-auto bg-white/60 shadow-[0_14px_40px_-32px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur">
                            <TabsTrigger
                              value="paquetes"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Paquetes
                            </TabsTrigger>
                            <TabsTrigger
                              value="categorias"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Categorías
                            </TabsTrigger>
                            <TabsTrigger
                              value="banners"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Banners
                            </TabsTrigger>
                            <TabsTrigger
                              value="consultas"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Consultas
                            </TabsTrigger>
                            <TabsTrigger
                              value="newsletter"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Newsletter
                            </TabsTrigger>
                            <TabsTrigger
                              value="dashboard"
                              className="text-gray-600 hover:bg-black/5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:ring-1 data-[state=active]:ring-primary/20"
                            >
                              Dashboard
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-white/70 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">Atajos</CardTitle>
                        <p className="text-sm text-gray-600">Para resolver lo más común en segundos.</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                          <MessageCircle className="h-5 w-5 text-success" />
                          <p className="text-base font-semibold text-gray-900">Responder consultas</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <p className="text-base font-semibold text-gray-900">Publicar contenido</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <SoftCard
                    title="Guía práctica de imágenes"
                    description="Qué elegir para que se vea bien (y evitar sorpresas en celular)."
                  >
                    <div className="space-y-4">
                      <Tips
                        items={[
                          'Punto importante al centro',
                          'Evitá texto en los bordes',
                          'Buena luz y nitidez',
                          'Sin filtros muy fuertes',
                          'Preferí horizontal para portada/tarjeta',
                        ]}
                      />
                      <GoodBad
                        good={[
                          'Paisajes horizontales con el foco centrado.',
                          'Fotos nítidas y bien iluminadas.',
                          'Texto (si lo hay) lejos de bordes.',
                        ]}
                        bad={[
                          'Texto grande pegado a bordes (en celular se puede cortar).',
                          'Fotos muy oscuras o borrosas.',
                          'Fotos verticales para portadas horizontales.',
                        ]}
                      />
                    </div>
                  </SoftCard>

                  <SoftCard
                    title="Errores comunes y solución"
                    description="Si algo no se ve como esperás, probá estos pasos."
                  >
                    <AccordionList items={erroresComunes[helpModule]} defaultValue="item-0" />
                  </SoftCard>

                  <SoftCard title="Preguntas frecuentes" description="Respuestas rápidas a lo más consultado.">
                    <AccordionList items={preguntasFrecuentes} defaultValue="item-0" />
                  </SoftCard>

                  <SoftCard
                    title="Flujo recomendado de trabajo"
                    description="Una forma simple de organizarte para mantener el sitio siempre al día."
                  >
                    <div className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                      <div className="flex flex-wrap items-center gap-2">
                        {flujoRecomendado.map((step, idx) => (
                          <div key={step} className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary ring-1 ring-primary/15">
                              {step}
                            </span>
                            {idx < flujoRecomendado.length - 1 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <StepList
                          items={[
                            'Empezá por Categorías para tener todo ordenado.',
                            'Cargá o actualizá Paquetes (y marcá Destacado si querés que vaya al inicio).',
                            'Subí o reordená Banners para campañas puntuales.',
                            'Revisá Consultas y respondé por WhatsApp.',
                            'Exportá Newsletter cuando hagas envíos o campañas.',
                          ]}
                        />
                      </div>
                    </div>
                  </SoftCard>

                  <SoftCard
                    title="Soporte y contacto"
                    description="Si algo no te cierra, te ayudamos rápido con estos datos."
                  >
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 lg:col-span-2">
                        <StepList
                          items={[
                            'Decinos en qué sección estabas (ej. Paquetes, Banners, Categorías).',
                            'Mandanos una captura de pantalla donde se vea el problema.',
                            'Si es un paquete, pasanos el título del paquete.',
                            'Contanos qué esperabas que pase y qué pasó en realidad.',
                          ]}
                        />
                      </div>

                      <div className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                        <p className="text-base font-semibold text-gray-900">Contacto</p>
                        <p className="mt-1 text-sm text-gray-600">Teléfono y WhatsApp: 1144713445</p>
                        <div className="mt-4 grid gap-2">
                          <Button asChild variant="success" className="w-full">
                            <a
                              href="https://wa.me/5491144713445?text=Hola%2C%20necesito%20ayuda%20con%20el%20panel%20admin."
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle />
                              WhatsApp
                            </a>
                          </Button>
                          <Button asChild variant="outline" className="w-full">
                            <a href="tel:+541144713445">
                              <Phone />
                              Llamar
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </SoftCard>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="border-0 bg-white/70 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur lg:col-span-2">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">{current.titulo}</CardTitle>
                        <p className="text-sm text-gray-600">{current.resumen}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {current.acciones.slice(0, 2).map((section) => (
                            <div
                              key={section.titulo}
                              className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
                            >
                              <p className="text-base font-semibold text-gray-900">{section.titulo}</p>
                              {section.descripcion && <p className="mt-1 text-sm text-gray-600">{section.descripcion}</p>}
                              <div className="mt-3">
                                <StepList items={section.items} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-white/70 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-base">Consejos</CardTitle>
                        <p className="text-sm text-gray-600">Pequeños detalles que hacen una gran diferencia.</p>
                      </CardHeader>
                      <CardContent>
                        {current.consejos ? <Tips items={current.consejos} /> : <p className="text-base text-gray-700">—</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <SoftCard
                    title="Acciones comunes"
                    description="Usá esta sección como recordatorio rápido para el día a día."
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      {current.acciones.slice(2).map((section) => (
                        <div
                          key={section.titulo}
                          className="rounded-2xl bg-gradient-to-b from-white/80 to-white/55 p-4 shadow-[0_14px_35px_-28px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
                        >
                          <p className="text-base font-semibold text-gray-900">{section.titulo}</p>
                          {section.descripcion && <p className="mt-1 text-sm text-gray-600">{section.descripcion}</p>}
                          <div className="mt-3">
                            <StepList items={section.items} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </SoftCard>

                  <SoftCard title="Imágenes" description="Tamaños recomendados para que se vea bien en celular y en computadora.">
                    <ImageCards items={current.imagenes} />
                  </SoftCard>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
