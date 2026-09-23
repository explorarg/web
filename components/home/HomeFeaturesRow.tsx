"use client";

import { Headphones, ShieldCheck, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { icon: Users, title: "Viajes grupales acompañados", subtitle: "Coordinadores durante el viaje" },
  { icon: ShieldCheck, title: "Pagos 100% seguros", subtitle: "Tus datos protegidos" },
  { icon: Headphones, title: "Atención personalizada", subtitle: "Antes, durante y después" },
  { icon: Sparkles, title: "Momentos únicos", subtitle: "Destinos increíbles" },
] as const;

export default function HomeFeaturesRow() {
  return (
    <section className="bg-[#F5FAFF]">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 py-6 md:py-8">
          {items.map((it, index) => {
            const Icon = it.icon;
            return (
              <motion.div
                key={it.title}
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-140px" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
              >
                <motion.div
                  className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center shrink-0"
                  whileHover={{ y: -2, scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon className="h-5 w-5 text-[#2BB8BF]" />
                </motion.div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 leading-snug">{it.title}</div>
                  <div className="text-xs text-gray-500 leading-snug">{it.subtitle}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
