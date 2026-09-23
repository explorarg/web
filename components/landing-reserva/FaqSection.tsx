'use client';

import { useRef } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { Experience } from './types';
import { fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';

type FaqSectionProps = {
  faqs: Experience['faqs'];
};

export default function FaqSection({ faqs }: FaqSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], [35, -35]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
      >
        <motion.div
          className="sherpa-title-chip mb-8 inline-flex items-center gap-2 px-4 py-2 text-black md:sticky md:top-6 z-10"
          variants={fadeUp}
          style={{ y: titleY }}
        >
          <span className="h-2 w-2 rounded-full bg-primary" />
          <h2 className="text-base font-semibold text-black">Preguntas frecuentes</h2>
          <span className="h-px w-6 bg-secondary/60" />
        </motion.div>
        <Accordion.Root
          type="single"
          collapsible
          className="mt-8 space-y-4"
          defaultValue="item-0"
        >
          {faqs.map((faq, index) => {
            const itemVariant = index % 2 === 0 ? fadeLeft : fadeRight;
            return (
              <motion.div key={faq.question} variants={itemVariant}>
                <Accordion.Item
                  value={`item-${index}`}
                  className="group sherpa-card"
                >
                  <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-semibold text-black sm:px-5">
                      <span>{faq.question}</span>
                    <ChevronDown className="h-5 w-5 text-primary transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 group-data-[state=open]:scale-110 group-data-[state=open]:translate-y-0.5" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden border-t border-gray-100 px-5 text-base text-black/70 transition-[max-height,opacity] duration-150 ease-out data-[state=closed]:max-h-0 data-[state=closed]:opacity-0 data-[state=open]:max-h-[320px] data-[state=open]:opacity-100">
                    <div className="py-4">{faq.answer}</div>
                  </Accordion.Content>
                </Accordion.Item>
              </motion.div>
            );
          })}
        </Accordion.Root>
      </motion.div>
    </section>
  );
}
