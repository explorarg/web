import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface CommunityAuthShellProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
}

export function CommunityAuthShell({ title, subtitle, icon: Icon, children }: CommunityAuthShellProps) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#ffffff_0%,_#F2FAFA_52%,_#E8F2F2_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.9),_transparent_72%)]" />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md items-center justify-center sm:min-h-[calc(100svh-5rem)]">
        <section className="relative w-full overflow-hidden rounded-[26px] border border-white/90 bg-white px-6 pb-6 pt-7 shadow-[0_24px_64px_rgba(16,61,72,0.12)] sm:px-8 sm:pb-8 sm:pt-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#F0F8F7] to-transparent" />
          <div className="relative">
            <header className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8F6F4] text-[#167F82]">
                <Icon aria-hidden="true" className="h-9 w-9" strokeWidth={1.7} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#258E90]">Explorarg</p>
              <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-[#153F4A]">{title}</h1>
              <p className="mt-2 max-w-[300px] text-sm leading-6 text-[#60777D]">{subtitle}</p>
            </header>
            {children}
            <footer className="mt-8 border-t border-[#E4ECEC] pt-5 text-center text-xs text-[#82979A]">
              Explorarg <span className="mx-1.5 text-[#C3D3D3]">·</span> Viajes para descubrir
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
