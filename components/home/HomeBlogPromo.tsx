"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  imageSrc?: string;
};

export default function HomeBlogPromo({ imageSrc = "/images/cta.png" }: Props) {
  return (
    <section id="nosotros" className="bg-[#F5FAFF] py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="group relative overflow-hidden rounded-[28px] shadow-[0_28px_80px_rgba(0,0,0,0.18)] transition-shadow duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_36px_100px_rgba(0,0,0,0.28)]">
          <div className="absolute inset-0">
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
              sizes="100vw"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent transition-opacity duration-700 group-hover:opacity-90" />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 [background-image:radial-gradient(55%_70%_at_20%_40%,rgba(255,211,77,0.18),transparent)]"
            />
          </div>

          <div className="relative z-10 flex min-h-[300px] flex-col justify-center px-6 py-12 md:min-h-[380px] md:px-12 md:py-16">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/75 transition-colors duration-500 group-hover:text-white">
                Quiénes somos
              </p>
              <h2 className="mt-4 text-3xl font-extrabold uppercase leading-[1.02] tracking-tight text-white md:text-5xl">
                Viajamos
                <br />
                <span className="font-logo italic font-normal normal-case text-[#FFD34D]">con vos</span>
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-white/85 md:text-base">
                Somos una agencia argentina que arma viajes grupales acompañados, con cada detalle
                cuidado de principio a fin.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/blog"
                  className="group/cta inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#112B49] shadow-[0_14px_35px_rgba(0,0,0,0.25)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,0.35)] active:scale-[0.98]"
                >
                  Conocé nuestras historias
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#2BB8BF] text-white transition-transform duration-300 group-hover/cta:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
