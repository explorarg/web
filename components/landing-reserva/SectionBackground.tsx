'use client';

import { motion } from 'framer-motion';

type SectionVariant = 'neutral' | 'primary' | 'secondary' | 'mixed' | 'cta' | 'dark';

const VARIANTS: Record<
  SectionVariant,
  {
    glowA: string;
    glowB: string;
    glowAColor: string;
    glowBColor: string;
  }
> = {
  neutral: {
    glowA: '-left-20 -top-24 h-56 w-56',
    glowB: '-right-14 -bottom-24 h-64 w-64',
    glowAColor: 'var(--sherpa-blue)',
    glowBColor: 'var(--sherpa-yellow)',
  },
  primary: {
    glowA: '-left-28 -top-28 h-64 w-64',
    glowB: '-right-20 -bottom-28 h-72 w-72',
    glowAColor: 'var(--sherpa-blue)',
    glowBColor: 'var(--sherpa-green)',
  },
  secondary: {
    glowA: '-left-24 -top-20 h-60 w-60',
    glowB: '-right-16 -bottom-24 h-68 w-68',
    glowAColor: 'var(--sherpa-yellow)',
    glowBColor: 'var(--sherpa-blue)',
  },
  mixed: {
    glowA: '-left-24 -top-24 h-60 w-60',
    glowB: '-right-20 -bottom-24 h-64 w-64',
    glowAColor: 'var(--sherpa-green)',
    glowBColor: 'var(--sherpa-blue)',
  },
  cta: {
    glowA: '-left-28 -top-24 h-72 w-72',
    glowB: '-right-24 -bottom-28 h-80 w-80',
    glowAColor: 'var(--sherpa-yellow)',
    glowBColor: 'var(--sherpa-blue)',
  },
  dark: {
    glowA: '-left-28 -top-32 h-72 w-72',
    glowB: '-right-28 -bottom-32 h-80 w-80',
    glowAColor: 'var(--sherpa-yellow)',
    glowBColor: 'var(--sherpa-blue)',
  },
};

type SectionBackgroundProps = {
  variant?: SectionVariant;
};

export default function SectionBackground({ variant = 'neutral' }: SectionBackgroundProps) {
  const styles = VARIANTS[variant];

  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className={`absolute rounded-full blur-3xl ${styles.glowA}`}
        style={{ backgroundColor: styles.glowAColor }}
        animate={{ opacity: [0.12, 0.28, 0.12], y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className={`absolute rounded-full blur-3xl ${styles.glowB}`}
        style={{ backgroundColor: styles.glowBColor }}
        animate={{ opacity: [0.1, 0.24, 0.1], y: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
