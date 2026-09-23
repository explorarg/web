import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import ContactForm from '@/components/ContactForm';
import { CONTACT_INFO, SOCIAL_MEDIA, SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';
import { ArrowUpRight, Clock, Mail, MapPin, Phone, Radio } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Contacto - ${SITE_NAME}`,
  description: `Contactate con ${SITE_NAME}. Atención online y presencial. Consultas por WhatsApp o email.`,
  alternates: { canonical: `${siteUrl}/contacto` },
};

export default function ContactoPage() {
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario].filter(Boolean).join(' / ');

  const canales = [
    SOCIAL_MEDIA.whatsapp
      ? {
          label: 'WhatsApp',
          value: CONTACT_INFO.whatsappDisplay || 'Escribinos',
          href: SOCIAL_MEDIA.whatsapp,
          external: true,
          Icon: FaWhatsapp,
        }
      : null,
    telefonos
      ? { label: 'Teléfono', value: telefonos, href: `tel:${CONTACT_INFO.telefono}`, Icon: Phone }
      : null,
    CONTACT_INFO.email
      ? { label: 'Email', value: CONTACT_INFO.email, href: SOCIAL_MEDIA.email, Icon: Mail }
      : null,
    SOCIAL_MEDIA.whatsappChannel
      ? {
          label: 'Canal de novedades',
          value: 'Canal de WhatsApp',
          href: SOCIAL_MEDIA.whatsappChannel,
          external: true,
          Icon: Radio,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    href: string;
    external?: boolean;
    Icon: React.ComponentType<{ className?: string }>;
  }>;

  const redes = [
    { href: SOCIAL_MEDIA.instagram, label: 'Instagram', Icon: FaInstagram },
    { href: SOCIAL_MEDIA.facebook, label: 'Facebook', Icon: FaFacebookF },
    { href: SOCIAL_MEDIA.tiktok, label: 'TikTok', Icon: FaTiktok },
  ].filter((r) => Boolean(r.href));

  const mapSrc =
    CONTACT_INFO.mapUrl ||
    (CONTACT_INFO.direccion
      ? `https://www.google.com/maps?q=${encodeURIComponent(CONTACT_INFO.direccion)}&output=embed`
      : '');

  return (
    <div className="min-h-[100dvh] bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <section className="border-b border-[#E4EDF6] pt-16 md:pt-20">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#A1ACB8]">
                Contacto
              </div>
              <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#112B49] md:text-[46px]">
                Hablemos de tu
                <br />
                {/* La tipografía script necesita más interlineado propio */}
                <span className="mt-1 inline-block font-logo text-[1.1em] italic font-normal leading-[1.45] text-[#2BB8BF]">
                  próximo viaje
                </span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8A98A8] md:text-base">
                Escribinos por el canal que prefieras. Respondemos a la brevedad.
              </p>
            </div>

            {CONTACT_INFO.horario ? (
              <div className="flex items-start gap-2.5 text-sm text-[#8A98A8]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2BB8BF]" />
                <span className="max-w-[260px] leading-relaxed">{CONTACT_INFO.horario}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="rounded-[24px] border border-[#E4EDF6] bg-white p-6 shadow-[0_10px_30px_rgba(17,43,73,0.06)] md:p-8">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A6B2C0]">
                Canales directos
              </div>

              <div className="mt-5 divide-y divide-[#EDF3F9]">
                {canales.map(({ label, value, href, external, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex items-center gap-4 py-4 transition-colors"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5FAFF] text-[#6B7C8F] transition-colors group-hover:bg-[#2BB8BF] group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#A6B2C0]">
                        {label}
                      </span>
                      <span className="block truncate text-sm font-semibold text-[#112B49] transition-colors group-hover:text-[#187AA6]">
                        {value}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#C2CCD6] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#2BB8BF]" />
                  </a>
                ))}
              </div>

              {CONTACT_INFO.direccion ? (
                <div className="mt-6 flex items-start gap-3 border-t border-[#EDF3F9] pt-6">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2BB8BF]" />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A6B2C0]">
                      Dónde estamos
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#112B49]">
                      {CONTACT_INFO.direccion}
                    </div>
                  </div>
                </div>
              ) : null}

              {redes.length > 0 ? (
                <div className="mt-6 border-t border-[#EDF3F9] pt-6">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A6B2C0]">
                    Seguinos
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {redes.map(({ href, label, Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F5FAFF] text-[#6B7C8F] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#2BB8BF] hover:text-white"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-[24px] border border-[#E4EDF6] bg-white p-6 shadow-[0_10px_30px_rgba(17,43,73,0.06)] md:p-8">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A6B2C0]">
                Envianos un mensaje
              </div>
              <div className="mt-6">
                <ContactForm minimal />
              </div>
            </div>
          </div>
        </div>
      </section>

      {siteConfig.features.showContactMap && mapSrc ? (
        <section className="container mx-auto px-4 pb-16 md:px-6 md:pb-20 lg:px-8">
          <div className="relative h-[340px] overflow-hidden rounded-[28px] bg-[#EAF4FB] md:h-[440px]">
            <iframe
              src={mapSrc}
              title={`Ubicación de ${SITE_NAME}`}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      ) : null}

      <HomeFooter />
    </div>
  );
}
