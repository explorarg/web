"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { CONTACT_INFO, SOCIAL_MEDIA } from "@/lib/constants";

export default function HomeContactStrip() {
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario]
    .filter(Boolean)
    .join(" / ");

  const items = [
    SOCIAL_MEDIA.whatsapp
      ? {
          label: "WhatsApp",
          value: CONTACT_INFO.whatsappDisplay || "Escribinos",
          href: SOCIAL_MEDIA.whatsapp,
          external: true,
          Icon: FaWhatsapp,
        }
      : null,
    telefonos
      ? { label: "Teléfono", value: telefonos, href: `tel:${CONTACT_INFO.telefono}`, Icon: Phone }
      : null,
    CONTACT_INFO.email
      ? { label: "Email", value: CONTACT_INFO.email, href: SOCIAL_MEDIA.email, Icon: Mail }
      : null,
    CONTACT_INFO.direccion
      ? {
          label: "Dónde estamos",
          value: CONTACT_INFO.direccion,
          href: "/contacto",
          Icon: MapPin,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    href: string;
    external?: boolean;
    Icon: React.ComponentType<{ className?: string }>;
  }>;

  if (!items.length) return null;

  return (
    <section id="contacto" className="bg-white py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-[#E4EDF6] pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#A1ACB8]">
              Contacto
            </div>
            <h2 className="mt-3 text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#112B49] md:text-[34px]">
              Estamos{" "}
              <span className="font-logo italic font-normal text-[#2BB8BF]">para ayudarte</span>
            </h2>
            {CONTACT_INFO.horario ? (
              <div className="mt-3 flex items-start gap-2 text-sm text-[#8A98A8]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#2BB8BF]" />
                <span>{CONTACT_INFO.horario}</span>
              </div>
            ) : null}
          </div>

          <Link
            href="/contacto"
            className="group inline-flex w-fit items-center gap-2 border-b border-[#112B49]/15 pb-1 text-sm font-semibold text-[#112B49] transition-colors hover:border-[#2BB8BF] hover:text-[#2BB8BF]"
          >
            Ir a contacto
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 divide-y divide-[#E4EDF6] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {items.map(({ label, value, href, external, Icon }) => (
            <a
              key={label}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-4 py-6 sm:px-1"
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
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
