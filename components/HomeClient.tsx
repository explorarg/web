"use client";

import type { BlogPost, Categoria, Paquete } from "@/types";
import Navbar from "@/components/Navbar";
import HomeHero from "@/components/home/HomeHero";
import HomeFeaturesRow from "@/components/home/HomeFeaturesRow";
import HomeFeaturedDepartures from "@/components/home/HomeFeaturedDepartures";
import HomeStatsStrip from "@/components/home/HomeStatsStrip";
import HomeDestinationsRow from "@/components/home/HomeDestinationsRow";
import HomeBlogPromo from "@/components/home/HomeBlogPromo";
import HomeBlogSection from "@/components/home/HomeBlogSection";
import HomeContactStrip from "@/components/home/HomeContactStrip";
import HomeNewsletterInline from "@/components/home/HomeNewsletterInline";
import HomeFaqSection from "@/components/home/HomeFaqSection";
import HomeFooter from "@/components/home/HomeFooter";
import ScrollReveal from "@/components/ui/scroll-reveal";

interface HomeClientProps {
  paquetes: Paquete[];
  productosOrdenados: Array<
    | { tipo: "paquete"; paquete: Paquete }
    | { tipo: "subtitle"; titulo: string }
  >;
  categoriasDestacadas: Categoria[];
  banners: string[];
  blogPosts: BlogPost[]; // BLOG OCULTO: se pasa [] desde page; descomentar BlogSection para usar
}

export default function HomeClient({
  paquetes,
  productosOrdenados,
  categoriasDestacadas,
  banners,
  blogPosts,
}: HomeClientProps) {
  const paquetesDestacados = productosOrdenados
    .filter((i): i is { tipo: "paquete"; paquete: Paquete } => i.tipo === "paquete")
    .map((i) => i.paquete);

  const ofertas = paquetes.filter(
    (p) => p.tipo === "oferta" || p.tipos?.includes("oferta")
  );

  return (
    <div className="min-h-[100dvh] bg-[#F5FAFF]">
      <Navbar variant="homeMockup" />
      <HomeHero paquetes={paquetes} backgroundImage={banners?.[0] || null} />
      <ScrollReveal variant="up" delayMs={20}>
        <HomeBlogPromo />

      </ScrollReveal>
      <ScrollReveal variant="up" delayMs={40}>
        <HomeFeaturedDepartures
          id="ofertas"
          eyebrow="Salidas"
          titulo="Ofertas"
          paquetes={ofertas}
        />
      </ScrollReveal>
      <ScrollReveal variant="up" delayMs={40}>
        <HomeFeaturedDepartures
          id="paquetes"
          eyebrow="Salidas"
          titulo="Paquetes Destacados"
          className={ofertas.length ? "bg-[#F5FAFF]" : "bg-white"}
          paquetes={paquetesDestacados.length ? paquetesDestacados : paquetes}
        />
      </ScrollReveal>
      {/* <ScrollReveal variant="scale" delayMs={20}>
        <HomeStatsStrip />
      </ScrollReveal> */}
      <ScrollReveal variant="up" delayMs={30}>
        <HomeDestinationsRow categorias={categoriasDestacadas ?? []} />
      </ScrollReveal>
      {/* <ScrollReveal variant="scale" delayMs={20}>
        <HomeFeaturesRow />
      </ScrollReveal> */}
     {/* HomeBlog */}
      <ScrollReveal variant="up" delayMs={10}>
        <HomeFaqSection />
      </ScrollReveal>
      <ScrollReveal variant="up" delayMs={20}>
        <HomeBlogSection posts={blogPosts ?? []} />
      </ScrollReveal>
      <ScrollReveal variant="up" delayMs={20}>
        <HomeContactStrip />
      </ScrollReveal>
       <ScrollReveal variant="up" delayMs={15}>
        <HomeNewsletterInline />
      </ScrollReveal>      <ScrollReveal variant="up" delayMs={0}>
        <HomeFooter />
      </ScrollReveal>
    </div>
  );
}
