"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from "react-icons/fa";
import { CONTACT_INFO, LEGAL_INFO, SITE_NAME, SOCIAL_MEDIA } from "@/lib/constants";
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from "@/lib/siteConfig";

const LINK_CLASS =
  "block text-sm text-white/55 transition-colors hover:text-white";

export default function HomeFooter() {
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || "{{siteName}} Logo");
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario]
    .filter(Boolean)
    .join(" / ");

  const socials = [
    { href: SOCIAL_MEDIA.instagram, label: "Instagram", Icon: FaInstagram },
    { href: SOCIAL_MEDIA.facebook, label: "Facebook", Icon: FaFacebookF },
    { href: SOCIAL_MEDIA.whatsapp, label: "WhatsApp", Icon: FaWhatsapp },
    { href: SOCIAL_MEDIA.tiktok, label: "TikTok", Icon: FaTiktok },
  ].filter((s) => Boolean(s.href));

  return (
    <footer className="border-t border-white/[0.06] bg-[#1B3A46]">
      <div className="container mx-auto px-4 py-14 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12 md:gap-8">
          <div className="col-span-2 md:col-span-3">
            <Link href="/" className="inline-flex items-center">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="h-9 w-auto object-contain" />
              ) : (
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  width={140}
                  height={36}
                  className="h-9 w-auto object-contain"
                />
              )}
            </Link>
            <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-white/45">
              Viajes grupales acompañados, momentos únicos y destinos increíbles.
            </p>

            {socials.length > 0 && (
              <div className="mt-7">
                <div className="text-sm font-semibold text-white">Seguinos</div>
                <div className="mt-3 flex items-center gap-4">
                  {socials.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="text-white/45 transition-colors hover:text-[#2BB8BF]"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 text-sm font-semibold text-white">Compañía</div>
            <div className="space-y-3">
              <Link href="/#nosotros" className={LINK_CLASS}>
                Sobre nosotros
              </Link>
              <Link href="/blog" className={LINK_CLASS}>
                Blog de viajes
              </Link>
              <Link href="/agencias" className={LINK_CLASS}>
                Agencias
              </Link>
              <Link href="/terminos-condiciones" className={LINK_CLASS}>
                Términos y condiciones
              </Link>
            </div>
          </div>

          <div className="col-span-1 md:col-span-3">
            <div className="mb-4 text-sm font-semibold text-white">Contacto</div>
            <div className="space-y-3">
              {SOCIAL_MEDIA.whatsapp && (
                <a
                  href={SOCIAL_MEDIA.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  WhatsApp {telefonos}
                </a>
              )}
              {telefonos && (
                <a href={`tel:${CONTACT_INFO.telefono}`} className={LINK_CLASS}>
                  Teléfono: {CONTACT_INFO.whatsappDisplay}
                </a>
              )}
              <a href={SOCIAL_MEDIA.email} className={LINK_CLASS}>
                {CONTACT_INFO.email}
              </a>
              <a
                href={CONTACT_INFO.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {CONTACT_INFO.direccion}
              </a>
              {CONTACT_INFO.horario && (
                <div className="text-sm text-white/35">{CONTACT_INFO.horario}</div>
              )}
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 text-sm font-semibold text-white">Encontrá tu viaje</div>
            <div className="space-y-3">
              <Link href="/paquetes" className={LINK_CLASS}>
                Paquetes
              </Link>
              <Link href="/#destinos" className={LINK_CLASS}>
                Destinos
              </Link>
              <Link href="/#faq" className={LINK_CLASS}>
                Preguntas frecuentes
              </Link>
              <Link href="/contacto" className={LINK_CLASS}>
                Contacto
              </Link>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 text-sm font-semibold text-white">Ya reservaste</div>
            <Link
              href="/consultar-reserva"
              className="group inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-[#2BB8BF] hover:text-[#2BB8BF]"
            >
              Consultar reserva
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="/login"
              className="group mt-3 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-[#2BB8BF] hover:text-[#2BB8BF]"
            >
              Mi cuenta
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-white/40 md:flex-row md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span>
              &copy; {new Date().getFullYear()} {SITE_NAME}
            </span>
            <span>Legajo RNAV N° {LEGAL_INFO.legajoRnav}</span>
            <span>CUIT {LEGAL_INFO.cuit}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Site desarrollado por</span>
            <a
              href={siteConfig.company.developerCredits.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white transition-colors hover:text-[#2BB8BF]"
            >
              {siteConfig.company.developerCredits.name}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
