'use client';

import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, Briefcase, MapPin, Compass, Phone, Mail, Search, MessageCircle, ShoppingCart, Loader2, ChevronRight, HelpCircle, Newspaper, Package, Users, User } from 'lucide-react';
import { SITE_NAME, CONTACT_INFO, SOCIAL_MEDIA } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface NavbarProps {
  transparent?: boolean;
  forceTransparent?: boolean;
  reserveSpace?: boolean;
  /** Estética Río / Viaggio Tur: fondo claro, texto negro */
  theme?: "default" | "rio";
  variant?: "default" | "homeMockup";
}

type ReservationLookupResult = {
  id: string;
  code: string;
  packageTitle: string;
  packageSlug: string | null;
  departureDate: string;
  people: number;
  paymentStatusLabel: string;
};

const homeNavLinks = [
  { href: '/paquetes', label: 'Paquetes', icon: Package, sectionId: 'paquetes' },
  { href: '/#nosotros', label: 'Nosotros', icon: Users, sectionId: 'nosotros' },
  { href: '/blog', label: 'Blog', icon: Newspaper, sectionId: 'blog' },
  { href: '/#faq', label: 'Preguntas', icon: HelpCircle, sectionId: 'faq' },
  { href: '/contacto', label: 'Contacto', icon: Mail, sectionId: 'contacto' },
] as const;

function formatReservationLookupDate(date: string): string {
  if (!date || date === 'sin-fecha') return 'Salida a coordinar';
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function ReservationLookupLoading() {
  return (
    <div className="rounded-2xl border border-[#D7EEF0] bg-[#F5FBFC] px-4 py-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[#2BB8BF]" />
        <div className="text-sm font-semibold text-[#072852]">Buscando tu reserva...</div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#DCEBFA]" />
        <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#E4F0FB]" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#DCEBFA]" />
      </div>
    </div>
  );
}

function ReservationLookupResultCard({
  result,
  onClose,
}: {
  result: ReservationLookupResult;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#D7EEF0] bg-[#F8FEFE] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black tracking-[-0.01em] text-[#072852]">{result.packageTitle}</div>
          <div className="mt-1 text-xs text-[#52708E]">
            {formatReservationLookupDate(result.departureDate)} · {result.people} pasajero(s)
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-[#2BB8BF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#12858B]">
          {result.paymentStatusLabel}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-[#36506B]">
        <span className="font-bold uppercase tracking-[0.12em] text-[#7D98B1]">C{String.fromCharCode(243)}digo:</span>{' '}
        <span className="font-mono text-[11px] text-[#072852]">{result.code}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Link
          href={`/consultar-reserva?code=${encodeURIComponent(result.code)}`}
          className="rounded-full bg-[#2BB8BF] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#22A9B0]"
          onClick={onClose}
        >
          Ver detalle
        </Link>
        {result.packageSlug ? (
          <Link
            href={`/paquete/${result.packageSlug}`}
            className="rounded-full border border-[#BDE5E7] bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#12858B] transition hover:bg-[#F3FEFE]"
            onClick={onClose}
          >
            Ver paquete
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function Navbar({ transparent = false, forceTransparent = false, reserveSpace = false, theme = "default", variant = "default" }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reservationLookupQuery, setReservationLookupQuery] = useState('');
  const [reservationLookupResults, setReservationLookupResults] = useState<ReservationLookupResult[]>([]);
  const [reservationLookupLoading, setReservationLookupLoading] = useState(false);
  const [reservationLookupError, setReservationLookupError] = useState<string | null>(null);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reservationModalState, setReservationModalState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [reservationSearchOpen, setReservationSearchOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [userPopupOpen, setUserPopupOpen] = useState(false);

  // En el home el indicador sigue la sección visible; en el resto, la ruta
  useEffect(() => {
    if (pathname !== '/') {
      setActiveSectionId(null);
      return;
    }

    const update = () => {
      // Línea de referencia justo debajo del navbar flotante
      const reference = 140;

      // Se ordena por posición real en la página, no por el orden del menú
      const sections = homeNavLinks
        .map((item) => document.getElementById(item.sectionId))
        .filter((node): node is HTMLElement => Boolean(node))
        .map((node) => ({ id: node.id, top: node.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top);

      const passed = sections.filter((section) => section.top <= reference);
      setActiveSectionId(passed.length > 0 ? passed[passed.length - 1].id : null);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario].filter(Boolean).join(' / ');
  const navRef = useRef<HTMLElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const [navHeight, setNavHeight] = useState(0);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const fetchCartCount = async () => {
      try {
        const res = await fetch('/api/cart', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setCartCount(json?.items?.length || 0);
        }
      } catch (err) {
        // silent error
      }
    };

    fetchCartCount();
    const interval = setInterval(fetchCartCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const body = document.body;
    const original = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    if (!mobileMenuOpen) return;

    const scrollY = window.scrollY || 0;
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.dataset.mobileMenuScrollY = String(scrollY);

    return () => {
      const savedScrollY = Number(body.dataset.mobileMenuScrollY || 0);
      body.style.overflow = original.overflow;
      body.style.position = original.position;
      body.style.top = original.top;
      body.style.left = original.left;
      body.style.right = original.right;
      body.style.width = original.width;
      delete body.dataset.mobileMenuScrollY;
      window.scrollTo(0, savedScrollY);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const t = window.setTimeout(() => {
      mobileMenuCloseButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
      mobileMenuButtonRef.current?.focus();
    };
  }, [mobileMenuOpen]);

  const isRio = theme === "rio";
  const isCompact = isRio && (isScrolled || mobileMenuOpen);
  const isHomeMockup = variant === "homeMockup";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!reserveSpace) return;
    if (typeof window === 'undefined') return;

    const updateHeight = () => {
      const height = navRef.current?.getBoundingClientRect().height ?? 0;
      setNavHeight(height);
    };

    updateHeight();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    if (ro && navRef.current) ro.observe(navRef.current);

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      ro?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!reserveSpace) return;
    const height = navRef.current?.getBoundingClientRect().height ?? 0;
    setNavHeight(height);
  }, [isScrolled, mobileMenuOpen, reserveSpace]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/paquetes?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const reservationCode = reservationLookupQuery.trim().toUpperCase();

  const submitReservationLookup = async () => {
    const code = reservationCode;
    if (!code || code.length < 3) {
      setReservationLookupResults([]);
      setReservationLookupError(null);
      setReservationModalState('empty');
      setReservationModalOpen(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setReservationLookupLoading(true);
    setReservationLookupError(null);
    setReservationLookupResults([]);
    setReservationModalState('loading');
    setReservationModalOpen(true);

    try {
      const res = await fetch(`/api/reservas/by-code?code=${encodeURIComponent(code)}`, {
        method: 'GET',
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'No se pudo consultar.');
      }
      const list = Array.isArray(json.results) ? (json.results as ReservationLookupResult[]) : [];
      if (!controller.signal.aborted) {
        setReservationLookupResults(list);
        setReservationModalState(list.length > 0 ? 'success' : 'empty');
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setReservationLookupError(
        error instanceof Error && error.message ? error.message : 'No pudimos buscar la reserva en este momento.'
      );
      setReservationModalState('error');
    } finally {
      if (!controller.signal.aborted) {
        setReservationLookupLoading(false);
      }
    }
  };

  const reservationLookupDesktop = (
    <div className="relative">
      <form
        className="flex items-center rounded-full border border-white/15 bg-white/10 pl-3.5 pr-1 py-1 transition-colors focus-within:border-white/35 focus-within:bg-white/18"
        onSubmit={(event) => {
          event.preventDefault();
          void submitReservationLookup();
        }}
      >
        <Search className="mr-2 h-4 w-4 shrink-0 text-white/70" />
        <div className="w-[110px]">
          <input
            type="text"
            inputMode="text"
            placeholder="N° reserva"
            className="w-full bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-white/60"
            value={reservationLookupQuery}
            onChange={(event) =>
              setReservationLookupQuery(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9-]/g, '')
                  .slice(0, 40)
              )
            }
          />
        </div>
        <button
          type="submit"
          className="ml-2 rounded-full bg-[#2BB8BF] px-3.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#22A9B0]"
          aria-label="Buscar mi reserva"
        >
          {reservationLookupLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando
            </span>
          ) : (
            'Buscar'
          )}
        </button>
      </form>
    </div>
  );

  const reservationLookupMobile = (
    <form
      className="flex items-center rounded-[16px] border border-white/[0.06] bg-white/[0.04] px-4 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        setMobileMenuOpen(false);
        void submitReservationLookup();
      }}
    >
      <Search className="mr-2 h-4 w-4 shrink-0 text-[#2BB8BF]" />
      <input
        type="text"
        inputMode="text"
        placeholder="N° reserva"
        className="w-full min-w-0 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/35"
        value={reservationLookupQuery}
        onChange={(event) =>
          setReservationLookupQuery(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9-]/g, '')
              .slice(0, 40)
          )
        }
      />
      <button
        type="submit"
        className="ml-2 shrink-0 rounded-full bg-[#2BB8BF] px-4 py-2 text-[12px] font-bold text-white transition active:scale-95"
        aria-label="Buscar mi reserva"
      >
        {reservationLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
      </button>
    </form>
  );

  const navContent = isHomeMockup ? (
    <nav
      ref={navRef as unknown as React.RefObject<HTMLElement>}
      className="fixed top-0 left-0 right-0 z-[100] px-3 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-4"
      onClick={() => {
        if (mobileMenuOpen) setMobileMenuOpen(false);
        if (userPopupOpen) setUserPopupOpen(false);
      }}
    >
      <div className="container mx-auto">
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-[26px] border border-white/[0.07] px-3 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-5',
            isScrolled
              ? 'h-[68px] bg-[#1B3A46]/95 shadow-[0_12px_34px_rgba(12,40,52,0.30)]'
              : 'h-[72px] bg-[#1B3A46]/78 shadow-[0_10px_30px_rgba(12,40,52,0.22)] md:h-[76px]'
          )}
        >
          <Link href="/" className="flex shrink-0 items-center">
            <div className="flex h-9 shrink-0 items-center md:h-10">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="h-full w-auto object-contain" />
              ) : (
                <Image src={logoSrc} alt={logoAlt} width={160} height={48} className="h-full w-auto object-contain" />
              )}
            </div>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {homeNavLinks.map((item) => {
              const isActive =
                pathname === '/'
                  ? activeSectionId === item.sectionId
                  : Boolean(pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/nav relative flex w-[86px] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-colors duration-300"
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] transition-all duration-300 group-hover/nav:-translate-y-0.5',
                      isActive ? 'text-white' : 'text-white/55 group-hover/nav:text-white'
                    )}
                    strokeWidth={1.6}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-medium leading-none transition-colors duration-300',
                      isActive ? 'text-white' : 'text-white/55 group-hover/nav:text-white/90'
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive ? (
                    <motion.span
                      layoutId="home-nav-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#2BB8BF]"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="mr-1 hidden h-7 w-px bg-white/10 lg:block" />

            <AnimatePresence initial={false}>
              {reservationSearchOpen ? (
                <motion.div
                  key="reservation-lookup"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="hidden overflow-hidden md:block"
                >
                  {reservationLookupDesktop}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <Link
              href="/carrito"
              aria-label="Carrito"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-all duration-300 hover:bg-white/[0.08] hover:text-white active:scale-95"
              onClick={(event) => event.stopPropagation()}
            >
              <ShoppingCart className="h-[19px] w-[19px]" strokeWidth={1.6} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#FF3B30] text-[10px] font-bold text-white ring-2 ring-[#1B3A46]">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                aria-label="Comunidad"
                onClick={(event) => {
                  event.stopPropagation();
                  setUserPopupOpen((value) => !value);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white transition-all duration-300 hover:bg-white/[0.14] active:scale-95"
              >
                <User className="h-[19px] w-[19px]" strokeWidth={1.6} />
              </button>
              <AnimatePresence>
                {userPopupOpen ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#1B3A46]/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="text-sm font-semibold text-white">Comunidad Explorarg</div>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                      Estamos preparando una experiencia exclusiva para que registres tu cuenta, accedas a beneficios especiales y participes de sorteos y promociones únicas.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#2BB8BF]">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#2BB8BF]" />
                      Próximamente disponible
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              type="button"
              aria-label={reservationSearchOpen ? 'Cerrar buscador de reserva' : 'Buscar mi reserva'}
              aria-expanded={reservationSearchOpen}
              onClick={(event) => {
                event.stopPropagation();
                setReservationSearchOpen((value) => !value);
              }}
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#2BB8BF] text-white shadow-[0_8px_20px_rgba(43,184,191,0.35)] transition-all duration-300 hover:bg-[#22A9B0] hover:shadow-[0_10px_26px_rgba(43,184,191,0.45)] active:scale-95 md:flex"
            >
              {reservationSearchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
            </button>

            <button
              ref={mobileMenuButtonRef}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white transition-all duration-300 hover:bg-white/[0.14] active:scale-95 lg:hidden"
              onClick={(event) => {
                event.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[110] lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-0 bg-[#04182B]/45 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.8 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 700) setMobileMenuOpen(false);
              }}
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="fixed inset-x-0 bottom-0 z-10 max-h-[88dvh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#1B3A46]/97 shadow-[0_-20px_60px_rgba(12,40,52,0.4)] backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="shrink-0 px-5 pb-2 pt-3">
                  <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-[22px] font-extrabold tracking-[-0.02em] text-white">Menú</div>
                    <button
                      ref={mobileMenuCloseButtonRef}
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white transition active:scale-90"
                      aria-label="Cerrar menú"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3">
                  <nav className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.04]">
                    {homeNavLinks.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-white/[0.06]',
                            index > 0 && 'border-t border-white/[0.06]'
                          )}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#2BB8BF]/15 text-[#2BB8BF]">
                            <Icon className="h-4 w-4" strokeWidth={1.7} />
                          </span>
                          <span className="flex-1 text-[15px] font-semibold text-white">{item.label}</span>
                          <ChevronRight className="h-4 w-4 text-white/25" />
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-5 space-y-3">
                    <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Tu reserva
                    </div>
                    {reservationLookupMobile}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  ) : (
    <nav
      ref={navRef as unknown as React.RefObject<HTMLElement>}
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${isScrolled ? 'pt-2 md:pt-4' : 'pt-0'}`}
      onClick={() => {
        if (mobileMenuOpen) setMobileMenuOpen(false);
        if (userPopupOpen) setUserPopupOpen(false);
      }}
    >
      {/* Topbar (Se oculta al scrollear para diseño más limpio) */}
      <div className={`overflow-hidden bg-[#2BB8BF] transition-all duration-500 ${isScrolled ? 'h-0 opacity-0' : 'h-10 opacity-100'}`}>
        <div className="container mx-auto px-4 md:px-6 lg:px-8 text-white/90 items-center justify-between py-0 text-[11px] font-medium h-10 flex">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Phone className="w-3.5 h-3.5 opacity-80" />
              <span className="tracking-wide">{telefonos}</span>
            </div>
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-3.5 h-3.5 opacity-80" />
              <span className="tracking-wide">{CONTACT_INFO.whatsappDisplay}</span>
            </div>
            <div className="flex items-center space-x-2 hover:text-white transition cursor-pointer">
              <Mail className="w-3.5 h-3.5 opacity-80" />
              <a href={SOCIAL_MEDIA.email} className="tracking-wide">
                {CONTACT_INFO.email}
              </a>
            </div>
          </div>

          <div className="flex items-stretch h-full">
            <Link
              href="/carrito"
              aria-label="Carrito"
              className="h-full flex items-center px-4 text-white/90 hover:text-white transition relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute right-1 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-1 ring-[#2BB8BF]">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/agencias" className="bg-black/10 hover:bg-black/20 text-white px-8 flex items-center transition-all duration-300 font-bold tracking-[0.15em] text-[10px]">
              AGENCIAS
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className={`mx-auto transition-all duration-500 w-full ${isScrolled
        ? 'px-4 md:px-6 mt-2'
        : 'bg-[#2BB8BF]'
        }`}>
        <div className={`mx-auto transition-all duration-500 ${isScrolled
          ? 'xl:max-w-7xl rounded-[28px] border border-white/15 bg-[#2BB8BF]/95 px-4 md:px-6 shadow-[0_18px_50px_rgba(7,40,82,0.18)] backdrop-blur-xl'
          : 'container border-none bg-[#2BB8BF] px-4 shadow-none md:px-6 lg:px-8'
          }`}>
          <div className="flex items-center justify-between h-16 md:h-24">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0 gap-1">
              <div className="h-12 md:h-16 flex items-center shrink-0">
                {isRemoteUrl(logoSrc) ? (
                  <img
                    src={logoSrc}
                    alt={logoAlt}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    width={192}
                    height={64}
                    className="h-full w-auto object-contain"
                  />
                )}
              </div>
              <span className="font-logo text-2xl leading-none whitespace-nowrap text-white">
                {siteConfig.branding.logo.titleText}
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden lg:flex flex-1 mx-4 flex-col items-center justify-center space-y-1.5 text-[10px] font-semibold tracking-[0.1em] text-white xl:text-[12px]">
              <div className="flex items-center space-x-3">
                <Link href="/#categorias" className="uppercase text-white transition-colors hover:text-white/85">DESTINOS</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/paquetes?tipo=grupal" className="uppercase text-white transition-colors hover:text-white/85">SALIDAS GRUPALES</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/paquetes?tipo=internacional" className="uppercase text-white transition-colors hover:text-white/85">INTERNACIONALES</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/educativos" className="uppercase text-white transition-colors hover:text-white/85">EDUCATIVOS</Link>
              </div>
              <div className="flex items-center space-x-3">
                <Link href="/transportes" className="uppercase text-white transition-colors hover:text-white/85">TRANSPORTE</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/paquetes?tag=escapada,religioso" className="uppercase text-white transition-colors hover:text-white/85">EVENTOS/RECITALES</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/paquetes?tag=promo" className="uppercase text-white transition-colors hover:text-white/85">PROMOS</Link>
                <span className="font-light text-white/35">|</span>
                <Link href="/contacto" className="uppercase text-white transition-colors hover:text-white/85">CONTACTO</Link>
                <span className="font-light text-white/35">|</span>
                {reservationLookupDesktop}
              </div>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="group ml-auto hidden w-48 shrink-0 items-center rounded-full border border-white/15 bg-white px-5 py-2.5 transition-all duration-300 hover:bg-white/95 focus-within:ring-2 focus-within:ring-white/25 2xl:w-64 lg:flex">
              <Search className="mr-2.5 h-4 w-4 shrink-0 text-[#2BB8BF] transition-colors" />
              <input
                type="text"
                placeholder="Buscá tu destino!"
                className="w-full bg-transparent text-xs font-medium text-[#072852] outline-none placeholder:text-[#7C95AE]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>

            <Link
              href="/carrito"
              aria-label="Carrito"
              className="ml-3 hidden lg:flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/12 text-white transition-colors hover:bg-white/18 relative"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#2BB8BF]">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <div className="lg:hidden ml-auto flex items-center gap-2 shrink-0">
              <Link
                href="/carrito"
                aria-label="Carrito"
                className="h-10 w-10 rounded-full bg-white/12 border border-white/15 hover:bg-white/18 transition-colors flex items-center justify-center relative"
                onClick={(event) => event.stopPropagation()}
              >
                <ShoppingCart className="h-5 w-5 text-white" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#2BB8BF]">
                    {cartCount}
                  </span>
                )}
              </Link>
              <button
                ref={mobileMenuButtonRef}
                className="p-2"
                onClick={(event) => {
                  event.stopPropagation();
                  setMobileMenuOpen(!mobileMenuOpen);
                }}
                aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <Menu className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[110] lg:hidden"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              id="mobile-navigation-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
              className="fixed right-0 top-0 z-10 h-[100dvh] w-[86vw] max-w-sm bg-white shadow-2xl overflow-hidden pt-[env(safe-area-inset-top)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="shrink-0 border-b border-gray-100 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-bold">Menú</div>
                    <button
                      ref={mobileMenuCloseButtonRef}
                      type="button"
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-2 -mr-2 bg-gray-100 rounded-full"
                      aria-label="Cerrar menú"
                    >
                      <X className="w-5 h-5 text-gray-900" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] px-6 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                  <nav className="space-y-1 text-left">
                    <Link href="/#categorias" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      DESTINOS
                    </Link>
                    <Link href="/paquetes?tipo=grupal" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      SALIDAS GRUPALES
                    </Link>
                    <Link href="/paquetes?tipo=internacional" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      INTERNACIONALES
                    </Link>
                    <Link href="/educativos" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      EDUCATIVOS
                    </Link>
                    <Link href="/transportes" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      TRANSPORTE
                    </Link>
                    <Link href="/paquetes?tag=escapada,religioso" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      EVENTOS/RECITALES
                    </Link>
                    <Link href="/paquetes?tag=promo" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      PROMOS
                    </Link>
                    <Link href="/contacto" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:text-primary transition" onClick={() => setMobileMenuOpen(false)}>
                      CONTACTO
                    </Link>
                  </nav>

                  <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
                    {reservationLookupMobile}

                    <form onSubmit={handleSearch} className="flex items-center bg-gray-100 rounded-xl px-4 py-3 w-full border border-transparent focus-within:border-primary focus-within:bg-white transition">
                      <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscá tu destino!"
                        className="min-w-0 bg-transparent outline-none text-base w-full text-gray-800 placeholder-gray-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </form>

                    <div className="pt-2">
                      <Link href="/agencias" className="block bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl text-center text-sm transition font-bold tracking-wider" onClick={() => setMobileMenuOpen(false)}>
                        AGENCIAS
                      </Link>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setUserPopupOpen((value) => !value)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                      >
                        <User className="h-4 w-4 text-gray-600" strokeWidth={1.6} />
                        Comunidad Explorarg
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );

  return (
    <>
      {reserveSpace && (
        <div aria-hidden className="w-full transition-[height] duration-500" />
      )}
      {mounted && typeof document !== "undefined"
        ? createPortal(navContent, document.body)
        : navContent}
      <Dialog
        open={reservationModalOpen}
        onOpenChange={(open) => {
          setReservationModalOpen(open);
          if (!open) {
            abortRef.current?.abort();
            setReservationLookupLoading(false);
            setReservationLookupError(null);
            setReservationModalState('idle');
          }
        }}
      >
        <DialogContent className="border-[#CDECEF] bg-white/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[#072852]">
              {reservationModalState === 'loading'
                ? 'Buscando tu reserva'
                : reservationModalState === 'success'
                  ? 'Reserva confirmada'
                  : reservationModalState === 'error'
                    ? 'No pudimos buscar tu reserva'
                    : 'Reserva no encontrada'}
            </DialogTitle>
            <DialogDescription className="text-[#52708E]">
              {reservationModalState === 'success'
                ? 'Mostramos tu reserva según el número ingresado.'
                : reservationModalState === 'empty'
                  ? (reservationCode.length < 4
                    ? 'Ingresá un número de reserva válido para buscar tu reserva confirmada.'
                    : 'No encontramos una reserva con ese número.')
                  : reservationModalState === 'error'
                    ? (reservationLookupError ?? 'Intentá nuevamente en unos minutos.')
                    : 'Ingresá tu número de reserva y presioná buscar.'}
            </DialogDescription>
          </DialogHeader>

          {reservationModalState === 'loading' ? <ReservationLookupLoading /> : null}

          {reservationModalState === 'success' ? (
            <div className="space-y-3">
              {reservationLookupResults.map((result) => (
                <ReservationLookupResultCard
                  key={result.id}
                  result={result}
                  onClose={() => setReservationModalOpen(false)}
                />
              ))}
            </div>
          ) : null}

          {reservationModalState === 'empty' ? (
            <div className="rounded-2xl border border-[#D7EEF0] bg-[#F5FBFC] px-4 py-4 text-sm text-[#52708E]">
              {reservationCode.length < 4
                ? 'Ingresá tu número de reserva y presioná “Buscar mi reserva”.'
                : 'Verificá que el número esté correcto. Si la reserva existe, debería aparecer acá.'}
            </div>
          ) : null}

          {reservationModalState === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {reservationLookupError ?? 'No pudimos buscar tu reserva. Intentá nuevamente.'}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
