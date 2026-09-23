'use client';

import { Card, CardContent, CardFooter } from '@/components/ui/card';

/** Skeleton para tarjetas de Experiencias y Paquetes (transparente + blur) */
export default function SkeletonPaqueteCard() {
  return (
    <Card className="w-full max-w-sm mx-auto flex flex-col py-0 gap-0 rounded-2xl border-0 shadow-lg relative aspect-4/5 md:aspect-4/5 min-h-[340px] overflow-hidden bg-transparent border border-white/20">
      <div className="absolute inset-0 bg-white/10 backdrop-blur-md animate-pulse" />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between p-3">
          <div className="h-5 w-20 bg-white/20 backdrop-blur-sm rounded-md animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm animate-pulse" />
        </div>
        <CardContent className="relative z-10 mt-auto p-4 space-y-2">
          <div className="h-3 w-24 bg-white/25 backdrop-blur-sm rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-white/25 backdrop-blur-sm rounded animate-pulse" />
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full bg-white/20 backdrop-blur-sm rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-white/20 backdrop-blur-sm rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-white/20 backdrop-blur-sm rounded animate-pulse" />
          </div>
          <div className="flex gap-1 pt-2">
            <div className="h-6 w-6 rounded bg-white/20 backdrop-blur-sm animate-pulse" />
            <div className="h-6 w-6 rounded bg-white/20 backdrop-blur-sm animate-pulse" />
            <div className="h-6 w-6 rounded bg-white/20 backdrop-blur-sm animate-pulse" />
          </div>
        </CardContent>
        <CardFooter className="relative z-10 p-4 pt-2 flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-3 w-12 bg-white/25 backdrop-blur-sm rounded animate-pulse" />
            <div className="h-4 w-20 bg-white/25 backdrop-blur-sm rounded animate-pulse" />
          </div>
          <div className="h-9 w-9 md:w-24 rounded-lg bg-white/20 backdrop-blur-sm animate-pulse" />
        </CardFooter>
      </div>
    </Card>
  );
}
