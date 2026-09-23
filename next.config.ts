import type { NextConfig } from "next";

const r2HostnameFromBaseUrl = (() => {
  const baseUrl = process.env.R2_PUBLIC_BASE || '';

  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: '**.r2.dev',
      },
      ...(r2HostnameFromBaseUrl
        ? [
            {
              protocol: 'https' as const,
              hostname: r2HostnameFromBaseUrl,
            },
          ]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 año
    // Las imágenes se sirven directo desde R2: sin optimizador de Vercel
    unoptimized: true,
  },
  // Configuración para uploads grandes
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Optimizar compilación para navegadores modernos
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Configuración de transpilación para reducir JavaScript antiguo
  transpilePackages: [],
  // Optimización de compilación - reducir transpilación para navegadores modernos
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Configuración de webpack para optimizar polyfills
  webpack: (config, { isServer }) => {
    // Reducir polyfills innecesarios
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
