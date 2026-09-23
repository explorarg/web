'use client';

import { useEffect } from 'react';

export default function HydrationFix() {
  useEffect(() => {
    const body = document.body;
    if (body.hasAttribute('cz-shortcut-listen')) {
      body.removeAttribute('cz-shortcut-listen');
    }
  }, []);
  return null;
}
