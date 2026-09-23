"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";

const faqs = [
  {
    q: "¿Cómo reservo mi paquete?",
    a: "Elegí tu paquete, seleccioná fecha y completá tus datos. Luego confirmás el pago para asegurar tu lugar.",
  },
  {
    q: "¿Qué incluye el precio publicado?",
    a: "Cada paquete detalla lo incluido y lo no incluido. Si tenés dudas, escribinos y te asesoramos.",
  },
  {
    q: "¿Puedo pagar en cuotas?",
    a: "Depende del medio de pago y de la disponibilidad del paquete. En checkout vas a ver las opciones habilitadas.",
  },
  {
    q: "¿Qué pasa si se agotan los cupos?",
    a: "Los cupos son limitados. Si se agotan, el paquete puede quedar como no disponible hasta que se habiliten nuevos lugares.",
  },
] as const;

export default function HomeFaqSection() {
  return (
    <section id="faq" className="bg-[#F5FAFF] py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-140px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2BB8BF]/15 bg-white shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-6 hover:scale-105">
            <HelpCircle className="h-5 w-5 text-[#2BB8BF]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ayuda</div>
            <h2 className="text-lg md:text-2xl font-extrabold text-gray-900">Preguntas frecuentes</h2>
          </div>
        </motion.div>

        <Accordion.Root type="single" collapsible defaultValue="item-0" className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
            >
              <Accordion.Item
                value={`item-${index}`}
                className="group/item relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_12px_36px_rgba(0,0,0,0.06)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#2BB8BF]/30 hover:shadow-[0_20px_44px_rgba(17,43,73,0.10)] data-[state=open]:border-[#2BB8BF]/30 data-[state=open]:shadow-[0_20px_44px_rgba(17,43,73,0.10)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-[#2BB8BF] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/item:scale-y-100 group-data-[state=open]/item:scale-y-100"
                />
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="text-[11px] font-bold tabular-nums text-[#A6B2C0] transition-colors duration-300 group-hover:text-[#2BB8BF] group-data-[state=open]:text-[#2BB8BF]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 transition-colors duration-300 group-hover:text-[#187AA6] md:text-base">
                        {faq.q}
                      </span>
                    </span>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5FAFF] text-[#2BB8BF] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[#2BB8BF] group-hover:text-white group-data-[state=open]:bg-[#2BB8BF] group-data-[state=open]:text-white">
                      <ChevronDown className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="group/content overflow-hidden border-t border-gray-100 px-5 text-sm text-gray-600 will-change-[height] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down md:text-base">
                  <div className="py-4 group-data-[state=closed]/content:animate-accordion-content-out group-data-[state=open]/content:animate-accordion-content-in">
                    {faq.a}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </motion.div>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

