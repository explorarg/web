"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { BlogPost } from "@/types";

type Props = {
  posts: BlogPost[];
};

function toDate(value: BlogPost["fechaPublicacion"]): Date | null {
  if (!value) return null;
  const seconds = (value as unknown as { seconds?: number }).seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  if (value instanceof Date) return value;
  const parsed = new Date(value as unknown as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: BlogPost["fechaPublicacion"]) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HomeBlogSection({ posts }: Props) {
  const items = (posts ?? []).slice(0, 10);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [showPrev, setShowPrev] = useState(false);
  const [showNext, setShowNext] = useState(false);

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
    const step = Math.max(260, Math.round(node.clientWidth * 0.7));
    node.scrollBy({ left: direction === "next" ? step : -step, behavior: "smooth" });
  };

  if (!items.length) return null;

  return (
    <section id="blog" className="bg-[#F5FAFF] py-14 md:py-20">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-140px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#A1ACB8]">
              Diario de viaje
            </div>
            <h2 className="mt-3 text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#112B49] md:text-[40px]">
              Historias que{" "}
              <span className="font-logo italic font-normal text-[#2BB8BF]">inspiran</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => scrollRail("prev")}
                disabled={!showPrev}
                aria-label="Ver notas anteriores"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#112B49] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#2BB8BF] hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollRail("next")}
                disabled={!showNext}
                aria-label="Ver más notas"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#112B49] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#2BB8BF] hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/blog"
              className="group inline-flex w-fit items-center gap-2 border-b border-[#112B49]/15 pb-1 text-sm font-semibold text-[#112B49] transition-colors hover:border-[#2BB8BF] hover:text-[#2BB8BF]"
            >
              Ver todas las notas
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </motion.div>

        <motion.div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 pt-2 scrollbar-hide md:gap-6"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          {items.map((post) => (
            <article
              key={post.id}
              className="w-[268px] shrink-0 snap-start sm:w-[300px] lg:w-[330px]"
            >
              <Link href={`/blog/${post.slug}`} className="group block">
                <div className="relative aspect-4/3 overflow-hidden rounded-[22px] bg-[#EAF4FB]">
                  <Image
                    src={post.imagenTarjeta || post.imagenPrincipal || "/images/hero-placeholder.svg"}
                    alt={post.titulo}
                    fill
                    className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
                    sizes="(max-width: 640px) 268px, (max-width: 1024px) 300px, 330px"
                  />
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A6B2C0]">
                    {post.categoria ? <span className="text-[#2BB8BF]">{post.categoria}</span> : null}
                    <span>{formatDate(post.fechaPublicacion)}</span>
                    {post.tiempoLectura ? (
                      <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                        <Clock className="h-3 w-3" />
                        {post.tiempoLectura} min
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-2.5 line-clamp-2 text-[19px] font-bold leading-[1.22] tracking-[-0.025em] text-[#112B49] transition-colors group-hover:text-[#187AA6]">
                    {post.titulo}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#8A98A8]">
                    {post.extracto}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#112B49]">
                    <span className="relative">
                      Leer nota
                      <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#2BB8BF] transition-all duration-500 group-hover:w-full" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[#2BB8BF] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
