"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";

type Props = {
  imageSrc?: string;
};

export default function HomeNewsletterInline({
  imageSrc = "/images/pexels-wanderer-731217.jpg",
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Ingresá un email válido");
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "newsletter"), where("email", "==", email.toLowerCase()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        toast.error("Este email ya está suscrito");
        return;
      }
      await addDoc(collection(db, "newsletter"), {
        email: email.toLowerCase(),
        fechaSuscripcion: Timestamp.now(),
        activo: true,
      });
      toast.success("¡Suscripción exitosa!");
      setEmail("");
    } catch {
      toast.error("No se pudo suscribir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#F5FAFF] py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="group relative overflow-hidden rounded-[28px] shadow-[0_28px_80px_rgba(7,40,82,0.18)] transition-shadow duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_36px_100px_rgba(7,40,82,0.28)]">
          <div className="absolute inset-0">
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#06222E] via-[#06222E]/70 to-transparent transition-opacity duration-700 group-hover:opacity-90" />
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100 [background-image:radial-gradient(60%_70%_at_15%_35%,rgba(43,184,191,0.28),transparent)]"
            />
          </div>

          <div className="relative z-10 grid grid-cols-1 items-center gap-8 px-6 py-10 md:px-12 md:py-14 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/60 transition-colors duration-500 group-hover:text-white/80">
                Suscribite y recibí las mejores ofertas
              </p>
              <h2 className="mt-4 text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-[40px]">
                Tu próximo destino
                <br />
                está{" "}
                <span className="font-logo italic font-normal text-[#FFD34D]">más cerca</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
                Suscribite y recibí en tu mail promociones exclusivas, novedades y mucho más.
              </p>
            </div>

            <div className="lg:col-span-6 lg:justify-self-end lg:w-full lg:max-w-[520px]">
              <form
                onSubmit={submit}
                className="flex flex-col gap-2 rounded-[26px] bg-white/95 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:-translate-y-0.5 focus-within:shadow-[0_24px_55px_rgba(0,0,0,0.3)] focus-within:ring-2 focus-within:ring-[#2BB8BF]/40 sm:flex-row sm:items-center sm:rounded-full"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Tu correo electrónico
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu correo electrónico"
                  disabled={loading}
                  className="h-12 w-full min-w-0 flex-1 bg-transparent px-5 text-sm text-[#112B49] outline-none placeholder:text-[#A6B2C0]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="group/btn inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#2BB8BF] px-7 text-sm font-semibold text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#22A9B0] hover:shadow-[0_12px_26px_rgba(43,184,191,0.4)] active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? "Enviando..." : "Suscribirme"}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

