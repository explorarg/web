'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  BookOpen,
  Package,
  Newspaper,
  Handshake,
  FolderKanban,
  Image as ImageIcon,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Mail,
  Loader2,
  Compass,
  CalendarCheck,
  ChevronRight,
  Users,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SITE_NAME } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Ventas', href: '/admin/ventas', icon: Handshake },
  { name: 'Categorías', href: '/admin/categorias', icon: FolderKanban },
  { name: 'Paquetes', href: '/admin/paquetes', icon: Package },
  { name: 'Butacas', href: '/admin/butacas', icon: CalendarCheck },
  { name: 'Vendedores', href: '/admin/vendedores', icon: Users },
  { name: 'Plantillas micro', href: '/admin/plantillas-micro', icon: Compass },
  { name: 'Blog', href: '/admin/blog', icon: Newspaper},
  { name: 'Comunidad', href: '/admin/comunidad', icon: Users},
  { name: 'Banners', href: '/admin/banners', icon: ImageIcon },
  { name: 'Consultas', href: '/admin/consultas', icon: MessageSquare },
  { name: 'Newsletter', href: '/admin/newsletter', icon: Mail },
  // { name: 'Documentación', href: '/admin/documentacion', icon: BookOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/admin/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const matchesHref = (href: string) => {
    if (href === '/admin/ventas') {
      return pathname === href || pathname.startsWith(href + '/') || pathname === '/admin/reservas' || pathname.startsWith('/admin/reservas/');
    }
    if (href === '/admin') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className={cn('min-h-screen bg-gray-50')}>
      {/* Sidebar móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar oscuro */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-64 bg-gray-900 text-gray-400 transform transition-transform duration-200 ease-in-out z-50',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
            <Link href="/admin" className="flex items-center space-x-3">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="h-8 w-auto object-contain" />
              ) : (
                <Image
                  src={logoSrc}
                  alt={logoAlt}
                  width={120}
                  height={36}
                  className="h-8 w-auto object-contain"
                />
              )}
            </Link>
            <button
              className="lg:hidden text-gray-400 hover:text-gray-200"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 relative">
            {navigation.map((item) => {
              const isActive = matchesHref(item.href);
              return (
                <div key={item.name} className="relative">
                  <Link
                    href={item.href}
                    className={cn(
                      'relative group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                      isActive
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    )}
                    onClick={(e) => {
                      setSidebarOpen(false);
                    }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-rail"
                        className="absolute left-0 top-1/2 h-5 -translate-y-1/2 w-1 rounded-full bg-white/90"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <item.icon className={cn('h-4 w-4', isActive ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-300')} />
                    <span className="font-medium">{item.name}</span>
                    {/* {item.isNew && (
                      <span className="ml-auto inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                        new
                      </span>
                    )} */}
                  </Link>

                </div>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-white/5">
            {user && (
              <div className="mb-3 px-3 py-2 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-500">Conectado como:</p>
                <p className="text-sm font-medium text-gray-300 truncate">
                  {user.email}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-400 hover:bg-white/5 hover:text-gray-200 disabled:opacity-50"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                  Cerrando...
                </>
              ) : (
                <>
                  <LogOut className="mr-3 h-4 w-4" />
                  Cerrar sesión
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header minimal */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="h-14 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden text-gray-600 hover:text-gray-900"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav className="flex items-center gap-1.5 text-sm text-gray-500">
                <Link href="/admin" className="hover:text-gray-700 transition-colors">
                  Admin
                </Link>
                {(() => {
                  const parts = pathname.split('/').filter(Boolean);
                  if (parts.length <= 1) return null;
                  let hrefAcc = '/admin';
                  return parts.slice(1).map((seg, idx) => {
                    hrefAcc += `/${seg}`;
                    const isLast = idx === parts.slice(1).length - 1;
                    const label = seg.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
                    return (
                      <span key={`${seg}-${idx}`} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                        {isLast ? (
                          <span className="text-gray-800 font-medium">{label}</span>
                        ) : (
                          <Link href={hrefAcc} className="hover:text-gray-700 transition-colors">
                            {label}
                          </Link>
                        )}
                      </span>
                    );
                  });
                })()}
              </nav>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/60">
              <Link href="/" target="_blank">
                Ver sitio
              </Link>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
