'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type RevealVariant = 'up' | 'down' | 'left' | 'right' | 'scale';

function supportsReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export default function ScrollReveal({
  children,
  className,
  variant = 'up',
  delayMs = 0,
  durationMs = 520,
  once = true,
  threshold = 0.18,
  rootMargin = '0px 0px -12% 0px',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: RevealVariant;
  delayMs?: number;
  durationMs?: number;
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const hiddenClass = useMemo(() => {
    if (variant === 'left') return 'opacity-0 -translate-x-6';
    if (variant === 'right') return 'opacity-0 translate-x-6';
    if (variant === 'down') return 'opacity-0 -translate-y-6';
    if (variant === 'scale') return 'opacity-0 scale-[0.985]';
    return 'opacity-0 translate-y-6';
  }, [variant]);

  useEffect(() => {
    if (supportsReducedMotion()) {
      setIsVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) obs.unobserve(entry.target);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [once, threshold, rootMargin]);

  return (
    <div
      ref={ref}
      className={cn(
        'transform-gpu transition-[opacity,transform] ease-[cubic-bezier(0.16,1,0.3,1)]',
        isVisible ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : hiddenClass,
        className
      )}
      style={{
        transitionDelay: `${Math.max(0, delayMs)}ms`,
        transitionDuration: `${Math.max(120, durationMs)}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

