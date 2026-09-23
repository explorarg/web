'use client';

import Image from 'next/image';
import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

export default function PaqueteGalleryGrid({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  const preview = list.slice(0, 5);
  const remaining = Math.max(0, list.length - preview.length);
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Convertir las rutas de imágenes al formato que requiere yet-another-react-lightbox
  const slides = list.map((src) => ({ src }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {preview.map((src, idx) => {
          const isLast = idx === preview.length - 1;
          return (
            <button
              key={`${src}-${idx}`}
              type="button"
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#D2E5F6] bg-[#EAF3FC] transition-transform hover:scale-[1.02]"
              onClick={() => {
                setCurrentIndex(idx);
                setIsOpen(true);
              }}
            >
              <Image
                src={src}
                alt={`${title} ${idx + 1}`}
                fill
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
              />
              {isLast && remaining > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-[#072852]/55 text-sm font-bold text-white backdrop-blur-[2px]">
                  +{remaining}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Lightbox
        open={isOpen}
        close={() => setIsOpen(false)}
        slides={slides}
        index={currentIndex}
        plugins={[Zoom, Fullscreen, Slideshow, Thumbnails]}
        animation={{ fade: 400, swipe: 300 }}
        carousel={{
          padding: '16px',
          spacing: '24px',
        }}
        styles={{
          container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
        }}
      />
    </>
  );
}
