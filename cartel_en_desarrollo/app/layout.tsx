import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const normsProBold = localFont({
  src: './fonts/tt-norms-pro-bold/tt-norms-pro-bold.woff2',
  weight: '700',
  style: 'normal',
  variable: '--font-norms-pro-bold',
  display: 'swap',
});

const triesterVector = localFont({
  src: './fonts/triester-vector/triester-vector.otf',
  weight: '400',
  style: 'normal',
  variable: '--font-triester-vector',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VIAGGIO TUR — Próximamente',
  description: 'Preparando los motores para la nueva temporada. Muy pronto lanzamos la nueva web.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  themeColor: '#1E5EFF',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${normsProBold.variable} ${triesterVector.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
