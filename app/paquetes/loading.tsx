import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] bg-white">
      <div className="aspect-[4/3] w-full skeleton" />
      <div className="space-y-3 p-4">
        <Line className="h-4 w-3/4" />
        <Line className="w-1/2" />
        <div className="space-y-2 pt-1">
          <Line className="w-2/3" />
          <Line className="w-1/2" />
        </div>
        <div className="flex items-end justify-between pt-3">
          <div className="space-y-2">
            <Line className="h-2 w-10" />
            <Line className="h-4 w-24" />
          </div>
          <div className="h-10 w-28 rounded-[16px] skeleton" />
        </div>
      </div>
    </div>
  );
}

export default function LoadingPaquetes() {
  return (
    <div className="min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />

      <section className="border-b border-[#E4EDF6] bg-[#F5FAFF]">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <div className="max-w-2xl space-y-4">
            <Line className="h-2 w-24" />
            <div className="h-9 w-64 rounded-2xl skeleton md:h-12 md:w-96" />
            <Line className="w-80 max-w-full" />
          </div>
        </div>
      </section>

      <section className="bg-[#F5FAFF] pb-12 pt-6 md:pb-16 md:pt-10">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <aside className="lg:col-span-1">
              <div className="rounded-[24px] border border-[#E7EEF5] bg-white p-5">
                <div className="flex items-center justify-between">
                  <Line className="h-4 w-20" />
                  <Line className="h-3 w-14" />
                </div>
                <div className="mt-6 space-y-6">
                  {Array.from({ length: 3 }).map((_, group) => (
                    <div key={group} className="space-y-3">
                      <Line className="h-2 w-16" />
                      <div className="h-10 w-full rounded-md skeleton" />
                      {group === 2
                        ? Array.from({ length: 4 }).map((__, item) => (
                            <div key={item} className="flex items-center gap-2.5">
                              <div className="h-4 w-4 rounded skeleton" />
                              <Line className="w-28" />
                            </div>
                          ))
                        : null}
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="mb-6 flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
                <Line className="w-24" />
                <div className="hidden gap-3 sm:flex">
                  <div className="h-9 w-40 rounded-md skeleton" />
                  <div className="h-9 w-32 rounded-md skeleton" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
