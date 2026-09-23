"use client";

import Image from "next/image";
import { Star } from "lucide-react";

type Props = {
  imageSrc?: string;
};

export default function HomePromoTestimonial({ imageSrc = "/images/cta.png" }: Props) {
  return (
    <section id="nosotros" className="bg-[#F5FAFF] py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B3B5A] shadow-[0_28px_80px_rgba(0,0,0,0.18)]">
          <div className="absolute inset-0">
            <Image src={imageSrc} alt="" fill className="object-cover opacity-70" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08334D] via-[#08334D]/85 to-[#08334D]/10" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 px-6 py-10 md:px-10 md:py-12 items-center">
            <div className="lg:col-span-7">
              <h2 className="text-white text-2xl md:text-4xl font-extrabold leading-tight">
                Viajá tranquilo,
                <br />
                nosotros{" "}
                <span className="font-logo italic font-normal text-[#FFD34D]">nos ocupamos</span>
              </h2>
              <p className="mt-4 text-white/85 text-sm md:text-base leading-relaxed max-w-xl">
                Nos encargamos de cada detalle para que solo te preocupes por disfrutar.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl shadow-[0_18px_55px_rgba(0,0,0,0.18)] p-6">
                <div className="flex items-center gap-1 text-[#F6C54F] mb-3">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Excelente viaje, todo estuvo perfectamente organizado. Volvería a viajar con Explorarg sin dudarlo.
                </p>
                <div className="mt-4">
                  <div className="text-sm font-semibold text-gray-900">María P.</div>
                  <div className="text-xs text-gray-500">Consultora del viajero</div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#2BB8BF]" />
                  <div className="h-2 w-2 rounded-full bg-gray-200" />
                  <div className="h-2 w-2 rounded-full bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
