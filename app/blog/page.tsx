import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { getBlogListData } from '@/lib/blogListData';
import BlogListClient from '@/components/BlogListClient';
import { siteConfig } from '@/lib/siteConfig';

/** Sin caché: los cambios del admin (blog) se ven de inmediato */
export const revalidate = 0;

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Blog - ${SITE_NAME}`,
  description: 'Novedades, lanzamientos y tips para viajar mejor.',
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/blog`,
    title: `Blog - ${SITE_NAME}`,
    description: 'Novedades, lanzamientos y tips para viajar mejor.',
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Blog - ${SITE_NAME}`,
    description: 'Novedades, lanzamientos y tips para viajar mejor.',
  },
};

export default async function BlogPage() {
  const data = await getBlogListData();

  return <BlogListClient posts={data.posts} banners={data.banners} />;
}
