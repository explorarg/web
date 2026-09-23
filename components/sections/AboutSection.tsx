'use client';

import { motion, Variants } from 'framer-motion';
import Image from 'next/image';
import { renderTemplate, siteConfig } from '@/lib/siteConfig';

const BLUR_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%231e3a5f' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%2394a3b8'%3EFoto%3C/text%3E%3C/svg%3E";

interface AboutSectionProps {
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  staggerFastVariants: Variants;
  staggerContainerVariants: Variants;
}

export default function AboutSection({
  fadeInLeftVariants,
  fadeInRightVariants,
  staggerFastVariants,
  staggerContainerVariants,
}: AboutSectionProps) {
  const about = siteConfig.content.about;
  const imageAlt = renderTemplate(about.image.altTemplate);
  const renderParagraph = (value: string) => {
    const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong key={idx} className="font-semibold text-gray-700">
            {renderTemplate(inner)}
          </strong>
        );
      }
      return <span key={idx}>{renderTemplate(part)}</span>;
    });
  };

  return (
    <section className="relative py-16 md:py-24 bg-[#F9FAFB] overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Lado Izquierdo: Textos */}
          <motion.div
            className="space-y-6 order-2 lg:order-1 text-left"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainerVariants}
          >
            <motion.div className="inline-block mb-2" variants={fadeInLeftVariants}>
              <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(76,175,80,0.1)]">
                {about.badge}
              </span>
            </motion.div>
            <motion.h2
              className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-[1.1]"
              variants={fadeInLeftVariants}
            >
              {about.titlePrefix}{' '}
              <span className="text-primary relative whitespace-nowrap">
                {about.titleAccent}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-secondary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
                </svg>
              </span>
            </motion.h2>

            <div className="space-y-5 mt-8">
              {about.paragraphs.map((paragraph, idx) => (
                <motion.p
                  key={idx}
                  className={idx === 0 ? "text-lg md:text-xl text-gray-500 font-light leading-relaxed text-left" : "text-base text-gray-500 font-light leading-relaxed"}
                  variants={fadeInLeftVariants}
                >
                  {renderParagraph(paragraph)}
                </motion.p>
              ))}
            </div>
          </motion.div>

          {/* Lado Derecho: Imagen moderna */}
          <motion.div
            className="relative order-1 lg:order-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeInRightVariants}
          >
            {/* Decoración detrás de la imagen */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-secondary/5 rounded-[2.5rem] transform rotate-3 -z-10 blur-sm" />
            
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgb(0,0,0,0.1)] group">
              <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors duration-700 z-10" />
              <Image
                src={about.image.src}
                alt={imageAlt}
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
