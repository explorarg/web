import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

export default function LoadingPaqueteDetail() {
  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />

      <main className="container mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <Line className="h-2 w-64 max-w-full" />

        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="h-[240px] overflow-hidden rounded-3xl skeleton sm:h-[320px] md:h-[390px]" />

            <div className="rounded-3xl border border-[#E4EDF6] bg-white p-6">
              <div className="space-y-3">
                <div className="h-8 w-3/4 rounded-2xl skeleton" />
                <Line className="w-1/2" />
                <Line className="w-full" />
                <Line className="w-11/12" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[#E4EDF6] px-4 py-3">
                    <div className="h-4 w-4 rounded skeleton" />
                    <Line className="mt-3 w-20" />
                    <Line className="mt-2 h-2 w-16" />
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] rounded-2xl skeleton" />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-[#E4EDF6] bg-white p-5">
                  <Line className="w-24" />
                  <div className="mt-4 space-y-2">
                    <Line className="w-11/12" />
                    <Line className="w-10/12" />
                    <Line className="w-9/12" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-[#E4EDF6] bg-white p-5">
              <div className="space-y-3">
                <Line className="w-40" />
                <Line className="w-full" />
                <Line className="w-11/12" />
                <Line className="w-3/4" />
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#E4EDF6] bg-white p-5">
              <Line className="h-2 w-16" />
              <div className="mt-3 h-9 w-40 rounded-2xl skeleton skeleton-dark" />
              <Line className="mt-3 w-28" />

              <div className="mt-5 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[#E4EDF6] p-3">
                    <Line className="h-2 w-16" />
                    <Line className="mt-2 w-32" />
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2.5">
                <div className="h-12 w-full rounded-full skeleton skeleton-dark" />
                <div className="h-12 w-full rounded-full skeleton" />
              </div>
            </div>

            <div className="rounded-3xl border border-[#E4EDF6] bg-white p-5">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full skeleton" />
                    <Line className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
}
