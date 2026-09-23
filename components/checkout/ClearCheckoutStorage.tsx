'use client';

import { useEffect } from 'react';

const CHECKOUT_STORAGE_PREFIX = 'checkout_form_';

function getCheckoutStorageKey(slug: string, date: string, people: number) {
  return `${CHECKOUT_STORAGE_PREFIX}${slug}_${date}_${people}`;
}

/** Limpia el formulario de checkout guardado en sessionStorage al llegar a la página de éxito. */
export default function ClearCheckoutStorage({
  slug,
  date,
  people,
}: {
  slug: string;
  date: string;
  people: number;
}) {
  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    try {
      sessionStorage.removeItem(getCheckoutStorageKey(slug, date, people));
    } catch {
      // ignore
    }
  }, [slug, date, people]);
  return null;
}
