import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

export default function LoadingContacto() {
  return (
    <div className="min-h-[100dvh] bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />

      <section className="border-b border-[#E4EDF6] pt-0 md:pt-16">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-4">
              <Line className="h-2 w-24" />
              <div className="h-9 w-72 rounded-2xl skeleton md:h-12 md:w-[26rem]" />
              <div className="h-9 w-56 rounded-2xl skeleton md:h-12 md:w-72" />
              <Line className="w-80 max-w-full" />
            </div>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded skeleton" />
              <Line className="w-56" />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="rounded-[24px] border border-[#E4EDF6] bg-white p-6 md:p-8">
              <Line className="h-2 w-28" />
              <div className="mt-5 divide-y divide-[#EDF3F9]">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 shrink-0 rounded-full skeleton" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Line className="h-2 w-20" />
                      <Line className="w-40" />
                    </div>
                    <div className="h-4 w-4 shrink-0 rounded skeleton" />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-start gap-3 border-t border-[#EDF3F9] pt-6">
                <div className="mt-0.5 h-4 w-4 shrink-0 rounded skeleton" />
                <div className="space-y-2">
                  <Line className="h-2 w-24" />
                  <Line className="w-44" />
                </div>
              </div>

              <div className="mt-6 border-t border-[#EDF3F9] pt-6">
                <Line className="h-2 w-20" />
                <div className="mt-4 flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 w-10 rounded-full skeleton" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-[24px] border border-[#E4EDF6] bg-white p-6 md:p-8">
              <Line className="h-2 w-36" />
              <div className="mt-7 space-y-7">
                <div className="space-y-2">
                  <Line className="h-2 w-24" />
                  <div className="h-11 w-full rounded-md skeleton" />
                </div>
                <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Line className="h-2 w-24" />
                      <div className="h-11 w-full rounded-md skeleton" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Line className="h-2 w-16" />
                  <div className="h-11 w-full rounded-md skeleton" />
                </div>
                <div className="space-y-2">
                  <Line className="h-2 w-20" />
                  <div className="h-28 w-full rounded-md skeleton" />
                </div>
                <div className="h-12 w-full rounded-full skeleton skeleton-dark sm:w-52" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
