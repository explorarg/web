import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { BlogPost } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import Image from 'next/image';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_NAME, SITE_URL, SOCIAL_MEDIA } from '@/lib/constants';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import ShareBar from '@/components/ShareBar';

/** Sin caché: los cambios del admin (blog) se ven de inmediato */
export const revalidate = 0;

async function getPost(slug: string): Promise<BlogPost | null> {
  if (!firebaseEnabled) return null;
  try {
    const q = query(collection(db, 'blog'), where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const post = serializeFirestoreData<BlogPost>({
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    });

    if (!post.visible) return null;
    return post;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const url = `${SITE_URL}/blog/${slug}`;
    return {
      title: `${slug} - ${SITE_NAME}`,
      description: `Nota ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Entrada no encontrada' };
  }

  const url = `${SITE_URL}/blog/${slug}`;
  const description = post.extracto || post.contenido.replace(/<[^>]*>/g, '').substring(0, 160);

  const coverImage = post.imagenPortada || post.imagenTarjeta || post.imagenPrincipal;

  return {
    title: `${post.titulo} - ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${post.titulo} - ${SITE_NAME}`,
      description,
      siteName: SITE_NAME,
      locale: 'es_AR',
      images: coverImage
        ? [
          {
            url: coverImage,
            width: 1200,
            height: 630,
            alt: post.titulo,
          },
        ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.titulo} - ${SITE_NAME}`,
      description,
      images: coverImage ? [coverImage] : [],
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!firebaseEnabled) {
    return (
      <>
        <Navbar variant="homeMockup" reserveSpace />
        <WhatsAppButton />
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{slug}</h1>
              <p className="text-base md:text-lg text-gray-700 mt-3 max-w-none">
                Este contenido requiere configuración de Firebase para mostrarse.
              </p>
            </div>
          </div>
        </section>
        <HomeFooter />
      </>
    );
  }
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const coverImage = post.imagenPortada || post.imagenTarjeta || post.imagenPrincipal;

  const shareUrl = `${SITE_URL}/blog/${slug}`;
  const shareDescription = post.extracto || post.contenido.replace(/<[^>]*>/g, '').substring(0, 160);

  return (
    <div className="w-full min-w-0 overflow-x-clip bg-white">
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />
      {coverImage ? (
        <section className="relative z-20">
          <div className="group/hero relative min-h-[520px] md:min-h-[640px]">
            <div className="absolute inset-0 overflow-hidden">
              <Image
                src={coverImage}
                alt={post.titulo}
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/10" />
            <div className="relative top-100 z-20 container mx-auto px-4 md:px-6 lg:px-8 h-full flex flex-col justify-end pb-10 md:pb-16 lg:pb-20">
              <div className="max-w-3xl">
                <p className="text-sm text-white/80">
                  {post.fechaPublicacion
                    ? new Date(
                      (post.fechaPublicacion as unknown as { seconds?: number }).seconds
                        ? (post.fechaPublicacion as unknown as { seconds: number }).seconds * 1000
                        : post.fechaPublicacion instanceof Date
                          ? post.fechaPublicacion
                          : Date.now()
                    ).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                    : ''}
                </p>
                <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mt-2 tracking-tight">{post.titulo}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/75">
                  {post.categoria ? (
                    <span className="rounded-full border border-white/30 px-3 py-1 font-semibold uppercase tracking-[0.12em]">
                      {post.categoria}
                    </span>
                  ) : null}
                  {post.tiempoLectura ? <span>{post.tiempoLectura} min de lectura</span> : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="pb-10 md:pb-14 bg-white overflow-x-hidden">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl w-full">
              <p className="text-sm text-gray-500">
                {post.fechaPublicacion
                  ? new Date(
                    (post.fechaPublicacion as unknown as { seconds?: number }).seconds
                      ? (post.fechaPublicacion as unknown as { seconds: number }).seconds * 1000
                      : post.fechaPublicacion instanceof Date
                        ? post.fechaPublicacion
                        : Date.now()
                  ).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : ''}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{post.titulo}</h1>
              <p className="text-base md:text-lg text-gray-600 mt-3 max-w-none">{post.extracto}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                {post.categoria ? (
                  <span className="rounded-full border border-gray-200 px-3 py-1 font-semibold uppercase tracking-[0.12em] text-gray-600">
                    {post.categoria}
                  </span>
                ) : null}
                {post.autor ? (
                  <span>
                    Por <span className="font-semibold text-gray-900">{post.autor}</span>
                    {post.autorRol ? ` · ${post.autorRol}` : ''}
                  </span>
                ) : null}
                {post.tiempoLectura ? <span>{post.tiempoLectura} min de lectura</span> : null}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
          <div className="rounded-3xl bg-white">
            <article
              className="prose prose-lg lg:prose-xl max-w-none text-gray-800 prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-a:text-primary prose-a:font-semibold prose-a:underline-offset-4 prose-strong:text-gray-900 prose-hr:border-gray-200 prose-blockquote:border-l-primary/50 prose-blockquote:text-gray-600 prose-img:rounded-2xl prose-img:shadow-md prose-img:border prose-img:border-gray-200 [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-2xl [&_iframe]:shadow-md [&_iframe]:border [&_iframe]:border-gray-200 [&_video]:w-full [&_video]:rounded-2xl [&_video]:shadow-md [&_video]:border [&_video]:border-gray-200 wrap-break-word"
              dangerouslySetInnerHTML={{ __html: post.contenido }}
            />
          </div>

          <aside className="h-fit space-y-7 lg:sticky lg:top-28 md:pt-4 pt-2">
            {post.autor ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2BB8BF]/12 text-sm font-bold text-[#187AA6]">
                    {post.autor.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A6B2C0]">
                      Escrito por
                    </div>
                    <div className="truncate text-sm font-semibold text-[#112B49]">{post.autor}</div>
                    {post.autorRol ? (
                      <div className="truncate text-xs text-[#8A98A8]">{post.autorRol}</div>
                    ) : null}
                  </div>
                </div>
                <div className="h-px bg-[#E9EFF5]" />
              </>
            ) : null}

            <ShareBar title={post.titulo} url={shareUrl} excerpt={shareDescription} />

            <div className="h-px bg-[#E9EFF5]" />

            <div>
              <p className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#112B49]">
                ¿Querés un viaje similar?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#8A98A8]">
                Contanos tu idea y armamos un plan a medida.
              </p>

              <div className="mt-5 space-y-2.5">
                {SOCIAL_MEDIA.whatsapp ? (
                  <a
                    href={SOCIAL_MEDIA.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex w-full items-center justify-between gap-3 rounded-full bg-[#2BB8BF] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#22A9B0]"
                  >
                    Hablar con un asesor
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                ) : null}
                <Link
                  href="/paquetes"
                  className="group inline-flex w-full items-center justify-between gap-3 rounded-full border border-[#E4EDF6] px-5 py-3 text-sm font-semibold text-[#112B49] transition-colors hover:border-[#2BB8BF] hover:text-[#2BB8BF]"
                >
                  Ver paquetes
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <HomeFooter />
    </div>
  );
}
