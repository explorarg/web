'use client';

import { motion, Variants } from 'framer-motion';
import ContactSection from '@/components/ContactSection';
import { siteConfig } from '@/lib/siteConfig';

const defaultVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
} as Variants;

const defaultStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

interface ContactSectionBlockProps {
  fadeInLeftVariants?: Variants;
  fadeInRightVariants?: Variants;
  fadeInUpVariants?: Variants;
  fadeInDownVariants?: Variants;
  fadeInScaleVariants?: Variants;
  staggerFastVariants?: Variants;
}

export default function ContactSectionBlock({
  fadeInLeftVariants = defaultVariants,
  fadeInRightVariants = defaultVariants,
  fadeInUpVariants = defaultVariants,
  fadeInDownVariants = defaultVariants,
  fadeInScaleVariants = defaultVariants,
  staggerFastVariants = defaultStagger,
}: ContactSectionBlockProps = {}) {
  const content = siteConfig.content.contactBlock;
  const lineRevealVariants: Variants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section className="relative pt-16 pb-12 md:pt-24 md:pb-20 bg-white overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <motion.div
          className="mb-12 md:mb-16 max-w-3xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="inline-block mb-6" variants={fadeInDownVariants}>
            <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(76,175,80,0.1)]">
              {content.badge}
            </span>
          </motion.div>
          <motion.h2
            className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-[1.1] overflow-hidden"
            variants={fadeInRightVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              {content.titlePrefix}{' '}
              <span className="text-primary relative whitespace-nowrap">
                {content.titleAccent}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-secondary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" strokeLinecap="round"/>
                </svg>
              </span>
            </motion.span>
          </motion.h2>
          <motion.p
            className="text-lg md:text-xl text-gray-500 font-light leading-relaxed max-w-2xl mx-auto overflow-hidden"
            variants={fadeInUpVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              {content.subtitle}
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div 
          variants={fadeInScaleVariants} 
          transition={{ duration: 0.95, delay: 0.1 }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Decorative background shadow for the form */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[80%] bg-primary/5 blur-3xl rounded-[100%] -z-10" />
          
          <ContactSection showTitle={false} />
        </motion.div>
      </div>
    </section>
  );
}
