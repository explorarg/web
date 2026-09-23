"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronRight,
  Globe2,
  Landmark,
  MapPin,
  Mountain,
  PartyPopper,
  PlaneTakeoff,
  Trees,
} from "lucide-react";
import type { Categoria } from "@/types";
import { motion } from "framer-motion";

type Props = {
  categorias: Categoria[];
};

function normalizeText(value: string | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCategoryMeta(categoria: Categoria) {
  const name = normalizeText(categoria.nombre);
  const slug = normalizeText(categoria.slug);
  const haystack = `${name} ${slug}`;

  if (haystack.includes("grupal")) {
    return {
      title: "Salidas Grupales",
      subtitle: "Viajes acompañados",
      Icon: PlaneTakeoff,
      iconBg: "bg-[#2FA8FF]",
    };
  }
  if (haystack.includes("nacional") || haystack.includes("argentina")) {
    return {
      title: "Destinos Nacionales",
      subtitle: "Descubrí Argentina",
      Icon: Trees,
      iconBg: "bg-[#66C75A]",
    };
  }
  if (haystack.includes("internacional")) {
    return {
      title: "Destinos Internacionales",
      subtitle: "Explorá el mundo",
      Icon: Globe2,
      iconBg: "bg-[#8C63FF]",
    };
  }
  if (haystack.includes("escap")) {
    return {
      title: "Escapadas",
      subtitle: "Ideales para desconectar",
      Icon: Mountain,
      iconBg: "bg-[#FFB92E]",
    };
  }
  if (haystack.includes("evento") || haystack.includes("festival")) {
    return {
      title: "Eventos y Festivales",
      subtitle: "Viví experiencias únicas",
      Icon: PartyPopper,
      iconBg: "bg-[#FF4F9A]",
    };
  }

  return {
    title: categoria.nombre,
    subtitle: categoria.descripcion || "Explorá nuevas experiencias",
    Icon: Landmark,
    iconBg: "bg-[#2FA8FF]",
  };
}

export default function HomeDestinationsRow({ categorias }: Props) {
  const items = (categorias ?? []).filter((c) => c.activa).slice(0, 8);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [showNext, setShowNext] = useState(false);
  if (!items.length) return null;

  useEffect(() => {
    const node = railRef.current;
    if (!node) return;

    const update = () => {
      setShowNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  const handleNext = () => {
    const node = railRef.current;
    if (!node) return;
    node.scrollBy({ left: 204, behavior: "smooth" });
  };

  return (
    <section id="destinos" className="bg-[#F5FAFF] py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] bg-[#08343C] px-5 py-9 shadow-[0_28px_80px_rgba(7,40,82,0.22)] md:px-10 md:py-12">
          {/* Mapa/atmósfera de fondo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:radial-gradient(55%_70%_at_18%_25%,rgba(43,184,191,0.22),transparent),radial-gradient(45%_60%_at_82%_15%,rgba(43,184,191,0.16),transparent),radial-gradient(60%_80%_at_50%_120%,rgba(0,0,0,0.45),transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:14px_14px]"
          />

          <div className="relative z-10">
            <motion.div
              className="mb-7 flex flex-col gap-5 md:mb-9 md:flex-row md:items-start md:justify-between md:gap-8"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-140px" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">
                  <MapPin className="h-3.5 w-3.5 text-[#2BB8BF]" />
                  Explorá por destino
                </div>
                <h2 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[42px]">
                  El mundo{" "}
                  <span className="font-logo text-[#FFD34D] italic font-normal">te espera</span>
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                  Elegí el destino que querés visitar y descubrí los mejores paquetes, escapadas y
                  circuitos.
                </p>
              </div>

              <Link
                href="/paquetes"
                className="group inline-flex shrink-0 items-center gap-2.5 self-start rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-[#08343C]"
              >
                Ver todos los destinos
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <div className="relative">
              <motion.div
                ref={railRef}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 pr-12 pt-4 scrollbar-hide md:gap-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-140px" }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              >
                {items.map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-120px" }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
                    className="snap-start"
                  >
                    {(() => {
                      const meta = getCategoryMeta(c);
                      const Icon = meta.Icon;

                      return (
                        <Link
                          href={`/categoria/${c.slug}`}
                          className="group block w-[174px] shrink-0 sm:w-[182px] md:w-[188px] lg:w-[194px]"
                        >
                          <article className="relative overflow-hidden rounded-[24px] bg-[#0B2233] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_46px_rgba(0,0,0,0.32)]">
                            <div className="relative h-[230px] sm:h-[238px] md:h-[246px]">
                              <Image
                                src={c.imagen || "/images/hero-placeholder.svg"}
                                alt={meta.title}
                                fill
                                className="object-cover saturate-[1.04] contrast-[1.03] transition-transform duration-700 group-hover:scale-[1.055]"
                                sizes="(max-width: 640px) 174px, (max-width: 768px) 182px, (max-width: 1024px) 188px, 194px"
                              />
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,28,48,0.03)_0%,rgba(7,28,48,0.14)_26%,rgba(7,28,48,0.56)_62%,rgba(7,28,48,0.92)_100%)]" />
                              <div className="absolute inset-0 bg-[radial-gradient(78%_50%_at_50%_0%,rgba(255,255,255,0.16),transparent)]" />

                              <div className="absolute left-3.5 top-3.5 flex h-9.5 w-9.5 items-center justify-center rounded-[15px] bg-white/14 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-[10px]">
                                <div
                                  className={`flex h-7.5 w-7.5 items-center justify-center rounded-[11px] ${meta.iconBg} shadow-[0_8px_18px_rgba(0,0,0,0.16)]`}
                                >
                                  <Icon className="h-[15px] w-[15px] text-white" />
                                </div>
                              </div>

                              <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5 pt-11 md:px-4 md:pb-4">
                                <div className="max-w-[136px] rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(255,255,255,0.07))]">
                                  <h3 className="line-clamp-2 text-[16px] font-extrabold leading-[1] tracking-[-0.035em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.22)]">
                                    {meta.title}
                                  </h3>
                                  <p className="mt-1.5 line-clamp-1 text-[10.5px] font-medium tracking-[0.01em] text-white/76">
                                    {meta.subtitle}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </article>
                        </Link>
                      );
                    })()}
                  </motion.div>
                ))}
              </motion.div>

              {showNext ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-0 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-[0_16px_36px_rgba(0,0,0,0.25)] backdrop-blur-md transition hover:bg-white hover:text-[#08343C] md:inline-flex"
                  aria-label="Ver más destinos"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
