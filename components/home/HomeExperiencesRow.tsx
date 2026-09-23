"use client";

import Link from "next/link";
import { ChevronRight, Compass, Globe, PartyPopper, Sparkles, Users } from "lucide-react";

const items = [
  { title: "Salidas Grupales", subtitle: "Viajes acompañados", href: "/paquetes?tipo=grupal", icon: Users, color: "bg-[#E8F6FF] text-[#2BB8BF]" },
  { title: "Destinos Nacionales", subtitle: "Descubrí Argentina", href: "/paquetes?tipo=nacional", icon: Compass, color: "bg-[#E9FBF4] text-[#0B6E4F]" },
  { title: "Destinos Internacionales", subtitle: "Explorá el mundo", href: "/paquetes?tipo=internacional", icon: Globe, color: "bg-[#F0F2FF] text-[#4356D6]" },
  { title: "Escapadas", subtitle: "Ideas para desconectar", href: "/paquetes?tag=escapada", icon: Sparkles, color: "bg-[#FFF4E7] text-[#D97706]" },
  { title: "Eventos y Festivales", subtitle: "Viví experiencias únicas", href: "/paquetes?tag=evento", icon: PartyPopper, color: "bg-[#FFF0F6] text-[#DB2777]" },
] as const;

export default function HomeExperiencesRow() {
  return (
    <section className="bg-[#F5FAFF] py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Experiencias</div>
            <h2 className="text-lg md:text-2xl font-extrabold text-gray-900">Elegí tu experiencia</h2>
          </div>
          <Link href="/paquetes" className="text-sm font-semibold text-[#2BB8BF] hover:text-[#187AA6] inline-flex items-center gap-1">
            Ver todas las experiencias <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link key={it.title} href={it.href} className="group">
                <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.10)] transition-shadow p-4 h-full">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${it.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-extrabold text-gray-900 leading-tight">{it.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{it.subtitle}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

