import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';

function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

export default function LoadingBlog() {
  return (
    <div className="min-h-[100dvh] bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />

      <section className="border-b border-[#E4EDF6] pt-16 md:pt-20">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-4">
              <Line className="h-2 w-28" />
              <div className="h-9 w-72 rounded-2xl skeleton md:h-12 md:w-[26rem]" />
              <div className="h-9 w-48 rounded-2xl skeleton md:h-12 md:w-64" />
              <Line className="w-80 max-w-full" />
            </div>
            <Line className="w-32" />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="h-[380px] rounded-[28px] skeleton md:h-[520px]" />

        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 md:mt-14 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-4/3 w-full rounded-[22px] skeleton" />
              <div className="mt-5 space-y-2.5">
                <Line className="h-2 w-32" />
                <Line className="h-4 w-full" />
                <Line className="h-4 w-2/3" />
                <Line className="w-11/12" />
                <Line className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <HomeFooter />
    </div>
  );
}
