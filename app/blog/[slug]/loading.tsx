import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

export default function LoadingBlogPost() {
  return (
    <div className="min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-white">
      <Navbar variant="homeMockup" reserveSpace />

      <section className="pb-10 md:pb-14">
        <div className="relative left-1/2 h-[420px] w-screen max-w-[100vw] -translate-x-1/2 skeleton md:h-[560px]" />

        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded-2xl skeleton" />
              <Line className="w-1/2" />
              <div className="space-y-3 pt-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Line key={i} className={i % 4 === 3 ? 'w-2/3' : 'w-full'} />
                ))}
              </div>
            </div>

            <aside className="space-y-7">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <Line className="h-2 w-20" />
                  <Line className="w-28" />
                </div>
              </div>
              <div className="h-px bg-[#E9EFF5]" />
              <div className="space-y-3">
                <Line className="h-2 w-20" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 w-10 rounded-full skeleton" />
                  ))}
                </div>
              </div>
              <div className="h-px bg-[#E9EFF5]" />
              <div className="space-y-3">
                <Line className="h-4 w-44" />
                <Line className="w-full" />
                <div className="h-12 w-full rounded-full skeleton skeleton-dark" />
                <div className="h-12 w-full rounded-full skeleton" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
