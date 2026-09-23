'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { Users, Plane, Headphones, Globe } from 'lucide-react';
import { siteConfig } from '@/lib/siteConfig';

interface ServicesSectionProps {
  fadeInUpVariants: Variants;
  staggerFastVariants: Variants;
  staggerContainerVariants: Variants;
  scaleInVariants: Variants;
}

const ICONS = { Users, Plane, Headphones, Globe } as const;

export default function ServicesSection({
  fadeInUpVariants,
  staggerFastVariants,
  staggerContainerVariants,
  scaleInVariants,
}: ServicesSectionProps) {
  const section = siteConfig.content.services;
  const services = section.items ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((itemCount: number) => {
    if (!scrollRef.current) return;
    if (itemCount <= 0) return;
    const container = scrollRef.current;
    const itemWidth = container.scrollWidth / itemCount;
    const index = Math.round(container.scrollLeft / itemWidth);
    setActiveIndex(Math.max(0, Math.min(index, itemCount - 1)));
  }, []);

  return (
    <section className="relative py-16 md:py-24 bg-[#F9FAFB] overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-[-10%] w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <motion.div
          className="mb-12 md:mb-16 max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="inline-block mb-6" variants={fadeInUpVariants}>
            <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(76,175,80,0.1)]">
              {section.badge}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-[1.1]"
            variants={fadeInUpVariants}
          >
            {section.titlePrefix}{' '}
            <span className="text-primary relative whitespace-nowrap">
              {section.titleAccent}
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-secondary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
              </svg>
            </span>
          </motion.h2>
          <motion.p
            className="text-lg md:text-xl text-gray-500 font-light leading-relaxed max-w-2xl mx-auto"
            variants={fadeInUpVariants}
          >
            {section.subtitle}
          </motion.p>
        </motion.div>

        <div className="md:hidden relative">
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-8 px-4"
            onScroll={() => handleScroll(services.length)}
          >
            {services.map((item, index) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS] || Users;
              return (
                <div key={index} className="shrink-0 w-[85vw] snap-center">
                  <div className="relative h-full bg-white border border-gray-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-8 transition-all duration-500 overflow-hidden">
                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary rounded-2xl mb-6">
                        <Icon className="h-7 w-7" />
                      </div>
                      <h3 className="text-xl font-bold mb-4 text-gray-900">
                        {item.title}
                      </h3>
                      <p className="text-gray-500 leading-relaxed font-light">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {services.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'bg-primary w-8' : 'bg-gray-200 w-2'
                }`}
              />
            ))}
          </div>
        </div>

        <motion.div
          className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainerVariants}
        >
          {services.map((item, index) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS] || Users;
            return (
              <motion.div key={index} className="group relative" variants={scaleInVariants}>
                <div className="relative h-full bg-white border border-gray-100/50 rounded-3xl p-8 hover:border-primary/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-500 overflow-hidden">
                  <div className="relative z-10">
                    <motion.div
                      className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary rounded-2xl mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-500"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon className="h-7 w-7" />
                    </motion.div>
                    <h3 className="text-xl font-bold mb-4 text-gray-900 group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 leading-relaxed font-light transition-colors duration-300 mb-2">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
