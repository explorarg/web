function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3 rounded-full skeleton ${className}`} />;
}

export default function LoadingCheckout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl skeleton" />
          <div className="space-y-2">
            <Line className="h-2 w-20" />
            <Line className="h-4 w-48" />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
              <Line className="h-5 w-44" />
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Line className="h-2 w-24" />
                    <div className="h-11 w-full rounded-xl skeleton" />
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <Line className="h-2 w-28" />
                <div className="h-24 w-full rounded-xl skeleton" />
              </div>
              <div className="mt-6 h-12 w-full rounded-xl skeleton skeleton-dark" />
            </div>

            <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded skeleton" />
                  <Line className="w-24" />
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60">
              <Line className="h-2 w-32" />
              <div className="mt-5 flex gap-3">
                <div className="h-16 w-16 shrink-0 rounded-xl skeleton" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Line className="h-4 w-full" />
                  <Line className="w-2/3" />
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <Line className="w-32" />
                    <Line className="w-20" />
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <Line className="h-4 w-24" />
                <div className="h-6 w-32 rounded-full skeleton skeleton-dark" />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl skeleton" />
                <div className="flex-1 space-y-2">
                  <Line className="w-32" />
                  <Line className="w-24" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
