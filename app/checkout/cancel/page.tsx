import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { XCircle, MessageCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { SITE_NAME, SOCIAL_MEDIA } from '@/lib/constants';

type SearchParams = Promise<{ slug?: string; date?: string; people?: string }>;

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const slug = params.slug?.trim() || '';
  const whatsappHref = `${SOCIAL_MEDIA.whatsapp}?text=${encodeURIComponent(
    'Hola, estaba por reservar un paquete y cancelé el pago. ¿Me pueden ayudar con alguna duda?'
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
      <main className="flex flex-1 items-center justify-center px-4 py-12 md:py-20">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <XCircle className="h-12 w-12" strokeWidth={2} />
              </div>
              <h1 className="mt-6 text-2xl font-bold text-gray-900 md:text-3xl">
                Pago no realizado
              </h1>
              <p className="mt-3 text-base text-gray-600">
                No se realizó ningún cargo. Si fue por error o tenés dudas sobre el pago, podés volver a intentar o escribirnos por WhatsApp y te ayudamos.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <p className="text-center text-sm font-medium text-gray-700">
                Opciones
              </p>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    Volvé al paquete y elegí de nuevo la fecha y el método de pago para intentar otra vez.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <span>
                    Si algo no funcionó o tenés consultas, escribinos por WhatsApp. Te respondemos a la brevedad.
                  </span>
                </li>
              </ul>
            </div>

            <div className="py-8 grid w-full grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:justify-center">
              {slug && (
                <Button asChild variant="outline" className="h-12 w-full justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto sm:min-w-[170px]">
                  <Link className="flex w-full items-center justify-center gap-2" href={`/paquete/${slug}`}>
                    <ArrowLeft className="h-4 w-4" />
                    Volver al paquete
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="success"
                className="h-12 w-full justify-center gap-2 rounded-xl bg-[#20A464] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#188653] sm:w-auto sm:min-w-[190px]"
              >
                <Link className="flex w-full items-center justify-center gap-2" href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Escribir por WhatsApp
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full justify-center rounded-xl px-5 text-sm font-semibold sm:w-auto sm:min-w-[150px]">
                <Link className="flex w-full items-center justify-center" href="/">Ir al inicio</Link>
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            {SITE_NAME} · Sin cargo ni compromiso
          </p>
        </div>
      </main>
    </div>
  );
}
