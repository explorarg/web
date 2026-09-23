import DevelopmentNotice from "@/components/DevelopmentNotice";
import HomeClient from "@/components/HomeClient";
import { getHomeData } from "@/lib/homeData";

/** Sin caché: los cambios del admin se ven de inmediato en el front */
export const revalidate = 0;

/** Pon en true para volver a mostrar el cartel "Sitio en desarrollo" en la home */
const SHOW_DEVELOPMENT_NOTICE = false;

export default async function Home() {
  if (SHOW_DEVELOPMENT_NOTICE) {
    return <DevelopmentNotice />;
  }
  const data = await getHomeData();
  return (
    <HomeClient
      paquetes={data.paquetes}
      productosOrdenados={data.productosOrdenados}
      categoriasDestacadas={data.categoriasDestacadas}
      banners={data.banners}
      blogPosts={data.blogPosts}
    />
  );
}
