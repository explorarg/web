import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { Experience } from './types';
import { fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';

type TwoColumnListsProps = {
  experience: Experience;
};

export default function TwoColumnLists({ experience }: TwoColumnListsProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const sectionY = useTransform(scrollYProgress, [0, 1], [45, -45]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-cream">
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
        style={{ y: sectionY }}
      >
        <motion.div className="sherpa-title-chip mb-8 inline-flex items-center gap-2 px-4 py-2 text-black md:sticky md:top-6 z-10" variants={fadeUp}>
          <span className="h-2 w-2 rounded-full bg-secondary" />
          <span className="text-base font-semibold text-black">¿Para quién es?</span>
          <span className="h-px w-6 bg-primary/50" />
        </motion.div>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <motion.div
            className="sherpa-card p-6"
            variants={fadeLeft}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <h3 className="text-xl font-semibold text-black">Para quién es</h3>
            <motion.ul
              className="mt-4 space-y-3 text-base text-black/70"
              variants={staggerFast}
            >
              {experience.forWho.map((item) => (
                <motion.li key={item} className="flex items-start gap-2" variants={fadeUp}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary/70" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            className="sherpa-card p-6"
            variants={fadeRight}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <h3 className="text-xl font-semibold text-black">Para quién no es</h3>
            <motion.ul
              className="mt-4 space-y-3 text-base text-black/70"
              variants={staggerFast}
            >
              {experience.notForWho.map((item) => (
                <motion.li key={item} className="flex items-start gap-2" variants={fadeUp}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-secondary/70" />
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
