"use client";

const stats = [
  { value: "+25", label: "años", sublabel: "De experiencia" },
  { value: "+10.000", label: "viajeros", sublabel: "felices" },
  { value: "+50", label: "destinos", sublabel: "increíbles" },
  { value: "100%", label: "", sublabel: "Compromiso" },
] as const;

export default function HomeStatsStrip() {
  return (
    <section className="bg-[#F5FAFF] py-8 md:py-10">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-[0_14px_45px_rgba(0,0,0,0.06)] px-6 py-6 md:px-10 md:py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
            {stats.map((s) => (
              <div key={s.value} className="space-y-1">
                <div className="text-[#2BB8BF] text-2xl md:text-3xl font-extrabold tracking-tight">{s.value}</div>
                <div className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{s.label}</div>
                <div className="text-xs text-gray-500">{s.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

