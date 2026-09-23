import Link from "next/link";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { DEVELOPER_CREDITS, SITE_NAME, SOCIAL_MEDIA } from "@/lib/constants";
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from "@/lib/siteConfig";

type SocialLink = {
  key: string;
  href?: string;
  label: string;
  ariaLabel: string;
  className: string;
  icon: ReactNode;
  description?: string;
  style?: CSSProperties;
};

const WhatsappIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M20.52 3.477A11.86 11.86 0 0012.05 0C5.495 0 .16 5.335.157 11.892c-.001 2.096.547 4.142 1.588 5.944L0 24l6.305-1.654a11.87 11.87 0 005.74 1.463h.005c6.554 0 11.889-5.335 11.892-11.893a11.86 11.86 0 00-3.422-8.476zm-8.47 18.308h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.65-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.86 9.86 0 015.105 1.39 9.894 9.894 0 014.78 8.492c-.002 5.45-4.438 9.884-9.889 9.884zm5.421-7.403c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.149-.198.297-.768.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.669-1.612-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.877 1.213 3.075c.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.007-1.414.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h10zm-5 2.75A5.25 5.25 0 106.75 12 5.257 5.257 0 0012 6.75zm0 2a3.25 3.25 0 11-3.25 3.25A3.254 3.254 0 0112 8.75zm5.25-2.5a1 1 0 101 1 1 1 0 00-1-1z" />
  </svg>
);

const ThreadsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M12.186 24h-.004C5.664 24 .5 18.836.5 12.318.5 5.8 5.664.636 12.182.636c3.227 0 6.185 1.316 8.353 3.483a11.729 11.729 0 013.465 8.2c0 3.06-1.2 5.8-3.115 7.897-2.303 2.525-5.7 3.784-9.697 3.784-1.908 0-3.548-.333-4.9-1.004-1.52-.75-2.7-1.84-3.55-3.27-.84-1.42-1.24-3.06-1.24-4.92 0-2.42.7-4.45 2.07-6.09 1.38-1.65 3.25-2.49 5.6-2.49 2.32 0 4.2.83 5.56 2.45 1.2 1.43 1.83 3.37 1.83 5.76 0 2.12-.58 3.86-1.73 5.2-1.19 1.39-2.9 2.1-5.14 2.1-1.47 0-2.69-.28-3.66-.84-.93-.55-1.61-1.37-2.04-2.46-.42-1.07-.63-2.34-.63-3.8 0-1.82.45-3.3 1.35-4.45.9-1.15 2.16-1.72 3.78-1.72 1.6 0 2.89.54 3.83 1.62.84.96 1.26 2.25 1.26 3.88 0 1.38-.35 2.5-1.06 3.36-.71.86-1.73 1.29-3.07 1.29-1.21 0-2.15-.34-2.83-1.02-.62-.63-.93-1.53-.93-2.7 0-.97.23-1.76.69-2.36.47-.62 1.1-.93 1.89-.93.72 0 1.3.25 1.74.76.43.51.65 1.2.65 2.08 0 .75-.18 1.36-.53 1.82-.36.46-.86.69-1.52.69-.57 0-1.01-.16-1.33-.48-.29-.29-.43-.7-.43-1.24 0-.43.1-.78.31-1.05.2-.28.49-.42.86-.42.28 0 .51.1.68.29.17.2.25.45.25.76 0 .28-.07.51-.22.68-.14.18-.34.27-.6.27-.24 0-.43-.07-.56-.21-.12-.13-.18-.32-.18-.57 0-.16.04-.3.12-.41.08-.12.2-.17.36-.17.12 0 .22.04.3.12.07.08.1.18.1.31 0 .1-.02.18-.07.24-.05.06-.11.09-.19.09-.08 0-.14-.02-.18-.07-.04-.05-.06-.11-.06-.2 0-.05.01-.1.04-.13.03-.04.07-.06.12-.06.05 0 .08.02.11.05.03.03.04.07.04.11 0 .03-.01.06-.02.08-.02.02-.04.03-.07.03-.02 0-.04-.01-.05-.02-.01-.01-.02-.03-.02-.05 0-.02 0-.03.01-.04.01-.01.02-.02.04-.02" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4.236l-7.397 4.625a1.5 1.5 0 01-1.606 0L4 8.236V6l8 5 8-5v2.236z" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M22.675 0h-21.35C.597 0 0 .597 0 1.326v21.348C0 23.403.597 24 1.326 24H12.82v-9.294H9.692V11.01h3.128V8.309c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.763v2.31h3.587l-.467 3.696h-3.12V24h6.116C23.403 24 24 23.403 24 22.674V1.326C24 .597 23.403 0 22.675 0z" />
  </svg>
);

const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
    <path d="M19.589 6.686a4.793 4.793 0 01-3.77-4.25V2h-3.46v13.824a2.595 2.595 0 01-2.59 2.59c-1.433 0-2.6-1.168-2.6-2.6 0-1.43 1.167-2.595 2.6-2.595.28 0 .55.044.803.126V9.86a6.07 6.07 0 00-.803-.053 5.997 5.997 0 00-5.997 5.997 5.997 5.997 0 005.997 5.997 5.997 5.997 0 005.996-5.997V9.316a8.254 8.254 0 004.314 1.216V7.118a4.787 4.787 0 01-.49-.432z" />
  </svg>
);

export default function DevelopmentNotice() {
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || "{{siteName}} Logo");
  const primaryLinks: SocialLink[] = [
    {
      key: "whatsapp",
      href: SOCIAL_MEDIA.whatsapp,
      label: "WhatsApp",
      description: "Respuesta en minutos",
      ariaLabel: "Contactanos por WhatsApp",
      className: "bg-success text-white hover:bg-success/90",
      icon: <WhatsappIcon />,
    },
    {
      key: "instagram",
      href: SOCIAL_MEDIA.instagram,
      label: "Instagram",
      description: "Historias y novedades",
      ariaLabel: "Seguinos en Instagram",
      className: "text-white hover:opacity-90",
      style: {
        background:
          "linear-gradient(135deg, #F58529 0%, #DD2A7B 45%, #8134AF 70%, #515BD4 100%)",
      },
      icon: <InstagramIcon />,
    },
  ];

  const secondaryLinks: SocialLink[] = [
    {
      key: "email",
      href: SOCIAL_MEDIA.email,
      label: "Email",
      ariaLabel: "Enviar email",
      className: "bg-slate-900 text-white hover:bg-slate-800",
      icon: <MailIcon />,
    },
    {
      key: "threads",
      href: SOCIAL_MEDIA.threads,
      label: "Threads",
      ariaLabel: "Seguinos en Threads",
      className: "bg-black text-white hover:bg-black/90",
      icon: <ThreadsIcon />,
    },
    {
      key: "facebook",
      href: SOCIAL_MEDIA.facebook,
      label: "Facebook",
      ariaLabel: "Seguinos en Facebook",
      className: "bg-[#1877F2] text-white hover:bg-[#1565D8]",
      icon: <FacebookIcon />,
    },
    {
      key: "tiktok",
      href: SOCIAL_MEDIA.tiktok,
      label: "TikTok",
      ariaLabel: "Seguinos en TikTok",
      className: "bg-[#010101] text-white hover:bg-black",
      icon: <TiktokIcon />,
    },
  ];

  const allLinks = [...primaryLinks, ...secondaryLinks].filter((link) => link.href);

  return (
    <section className="relative min-h-svh bg-cream">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-12 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -right-16 bottom-16 h-56 w-56 rounded-full bg-success/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-4xl flex-col px-6 py-10">
        <div className="flex flex-1 items-center">
          <div className="w-full space-y-8 rounded-[36px] border border-primary/10 bg-white/85 p-6 text-center shadow-[0_32px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur md:p-12">
            <div className="mx-auto flex w-24 flex-col items-center gap-3 sm:w-28">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm sm:h-20 sm:w-20">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={logoAlt} className="h-auto w-12 object-contain sm:w-16" />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    width={120}
                    height={60}
                    className="h-auto w-12 object-contain sm:w-16"
                  />
                )}
              </div>
              <span className="rounded-full border border-primary/15 bg-white/80 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-primary/80">
                Sitio en desarrollo
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
                {SITE_NAME}
              </h1>
              <div className="font-logo text-primary text-4xl leading-none">{siteConfig.branding.logo.titleText}</div>
              <p className="text-sm text-black/70 sm:text-base md:text-lg">
                Estamos preparando una experiencia más rápida, clara y humana para planificar tu próximo viaje.
              </p>
              <p className="text-sm text-black/60">
                Mientras tanto, escribinos y te respondemos en minutos.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50">
                <span className="h-px w-8 bg-black/10" />
                Contacto directo
                <span className="h-px w-8 bg-black/10" />
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {allLinks.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.ariaLabel}
                    className={`group inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${link.className}`}
                    style={link.style}
                  >
                    <span className="text-[13px]">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-xs text-black/50">
              <p>Atención online · Respuesta rápida · Trato humano</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 text-xs text-black/50">
          <p>Desarrollado por {DEVELOPER_CREDITS.name}</p>
          <div className="flex items-center gap-4">
            <Link
              href={DEVELOPER_CREDITS.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Sitio web de ${DEVELOPER_CREDITS.name}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/60 transition-colors hover:border-black/20 hover:text-black"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
                <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z" />
                <path d="M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6v2H5v12h12v-6h2z" />
              </svg>
            </Link>
            <Link
              href="https://www.instagram.com/tucsdigital"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Tucs Digital"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-black/60 transition-colors hover:border-black/20 hover:text-black"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
                <path d="M7 2.5A4.5 4.5 0 002.5 7v10A4.5 4.5 0 007 21.5h10A4.5 4.5 0 0021.5 17V7A4.5 4.5 0 0017 2.5H7zm10 2a2.5 2.5 0 012.5 2.5v10A2.5 2.5 0 0117 19.5H7A2.5 2.5 0 014.5 17V7A2.5 2.5 0 017 4.5h10zm-5 3a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 2a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm5.25-2.25a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
