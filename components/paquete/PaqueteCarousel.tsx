'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Camera, Heart, MapPin } from 'lucide-react';

export default function PaqueteCarousel({
  images,
  title,
  badgeLabel,
  locationLabel,
  caption,
}: {
  images: string[];
  title: string;
  badgeLabel?: string | null;
  locationLabel?: string;
  caption?: string;
}) {
  const list = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const [imageLoading, setImageLoading] = useState(true);
  const total = Math.max(1, list.length);
  const current = list.length ? list[0] : '/images/placeholder-package.jpg';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#D2E5F6] bg-white shadow-[0_16px_42px_rgba(15,66,116,0.14)]">
      <div className="relative h-[240px] sm:h-[320px] md:h-[390px]">
        {imageLoading ? <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#DCEBFA] via-[#ECF5FE] to-[#DCEBFA]" /> : null}
        <Image
          src={current}
          alt={title}
          fill
          className={`object-cover transition-opacity duration-500 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          priority
          onLoad={() => setImageLoading(false)}
        />

        {/* <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/35 via-black/0 to-black/0" /> */}

        {badgeLabel ? (
          <div className="absolute left-4 top-4 rounded-full bg-[#FFE48A] px-3 py-1 text-xs font-bold text-[#17314D] shadow-sm">
            {badgeLabel}
          </div>
        ) : null}

      </div>
    </div>
  );
}
