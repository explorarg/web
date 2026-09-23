"use client";

type SectionDividerProps = {
  variant?: "light" | "dark";
};

export default function SectionDivider({ variant = "light" }: SectionDividerProps) {
  const gradient =
    variant === "dark"
      ? "from-black/0 via-black/35 to-black/0"
      : "from-cream/0 via-cream/90 to-cream/0";

  return (
    <div className="relative -mt-16 h-28 w-full overflow-hidden md:-mt-20 md:h-36">
      <div className={`absolute inset-0 bg-linear-to-r ${gradient} blur-3xl`} />
      <div className={`absolute inset-0 bg-linear-to-r ${gradient} blur-2xl`} />
    </div>
  );
}
