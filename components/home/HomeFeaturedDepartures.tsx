"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import type { Paquete } from "@/types";
import HomeDepartureCard from "@/components/home/HomeDepartureCard";
import { motion } from "framer-motion";
import { memo } from "react";

type Props = {
  paquetes: Paquete[];
  id?: string;
  eyebrow?: string;
  titulo?: string;
  className?: string;
};

function HomeFeaturedDepartures({
  paquetes,
  id = "paquetes",
  eyebrow = "Salidas",
  titulo = "Paquetes destacados",
  className = "bg-white",
}: Props) {
  const items = useMemo(() => paquetes.slice(0, 10), [paquetes]);
  const fadeColor = className.includes("F5FAFF") ? "#F5FAFF" : "#FFFFFF";
  const railRef = useRef<HTMLDivElement | null>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);
  if (items.length === 0) return null;

  useEffect(() => {
    const node = railRef.current;
    if (!node) return;

    const update = () => {
      setShowPrev(node.scrollLeft > 8);
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

  const scrollRail = (direction: "prev" | "next") => {
    const node = railRef.current;
    if (!node) return;
    const scrollStep = Math.max(220, Math.round(node.clientWidth * 0.72));
    node.scrollBy({ left: direction === "next" ? scrollStep : -scrollStep, behavior: "smooth" });
  };

  return (
    <section id={id} className={`py-10 md:py-14 ${className}`}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-6 flex items-center justify-between gap-4 md:mb-7"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-140px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E7EEF5] bg-white shadow-[0_10px_24px_rgba(17,43,73,0.08)]">
              <Star className="h-4.5 w-4.5 text-[#F6C54F]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A1ACB8]">
                {eyebrow}
              </div>
              <div className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-[#112B49] md:text-[28px]">
                {titulo}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollRail("prev")}
                disabled={!showPrev}
                className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D9E8F3] bg-white text-[#2BB8BF] shadow-[0_10px_24px_rgba(17,43,73,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#2BB8BF] hover:bg-[#2BB8BF] hover:text-white hover:shadow-[0_14px_28px_rgba(43,184,191,0.28)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-[#D9E8F3] disabled:hover:bg-white disabled:hover:text-[#2BB8BF]"
                aria-label="Ver paquetes anteriores"
              >
                <ChevronLeft className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollRail("next")}
                disabled={!showNext}
                className="group inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#D9E8F3] bg-white text-[#2BB8BF] shadow-[0_10px_24px_rgba(17,43,73,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#2BB8BF] hover:bg-[#2BB8BF] hover:text-white hover:shadow-[0_14px_28px_rgba(43,184,191,0.28)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-[#D9E8F3] disabled:hover:bg-white disabled:hover:text-[#2BB8BF]"
                aria-label="Ver más paquetes"
              >
                <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>
            <Link
              href="/paquetes"
              className="group hidden items-center gap-1 text-sm font-bold text-[#2BB8BF] transition-colors hover:text-[#187AA6] sm:inline-flex"
            >
              Ver todos los paquetes
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>

        <div className="relative">
          {/* Degradados que insinúan que el carrusel continúa */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 transition-opacity duration-300 ${
              showPrev ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `linear-gradient(to right, ${fadeColor}, transparent)` }}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 transition-opacity duration-300 ${
              showNext ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `linear-gradient(to left, ${fadeColor}, transparent)` }}
          />

          <div
            ref={railRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-6 pt-2 scrollbar-hide md:gap-5"
          >
            {items.map((p, index) => (
              <motion.div
                key={p.id}
                className="snap-start"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                  delay: Math.min(index, 5) * 0.07,
                }}
              >
                <HomeDepartureCard paquete={p} />
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-end sm:hidden">
          <Link href="/paquetes" className="inline-flex items-center gap-1 text-sm font-bold text-[#2BB8BF] hover:text-[#187AA6]">
            Ver todos los paquetes <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default memo(HomeFeaturedDepartures);
