'use client';

import { useState } from 'react';
import { Check, Facebook, Linkedin, Mail, Link2, Send, Twitter, Rss, Pin } from 'lucide-react';
import { SITE_NAME } from '@/lib/constants';

interface ShareBarProps {
  title: string;
  url: string;
  excerpt?: string;
}

export default function ShareBar({ title, url, excerpt }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const normalizedExcerpt = excerpt?.replace(/\s+/g, ' ').trim();
  const shortExcerpt = normalizedExcerpt
    ? `${normalizedExcerpt.slice(0, 140).replace(/[.,!?]\s*$/, '')}…`
    : '';
  const shareMessage = `${title} | ${SITE_NAME}. ${shortExcerpt ? `${shortExcerpt} ` : ''}Leé la nota completa en:`;
  const encodedShareMessage = encodeURIComponent(shareMessage);
  const encodedEmailBody = encodeURIComponent(`${shareMessage}\n${url}`);

  const shareItems = [
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodedShareMessage}%20${encodedUrl}`,
      color: '#53AB29',
      customIcon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedShareMessage}`,
      icon: Send,
      color: '#229ED9',
    },
    {
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodedShareMessage}&url=${encodedUrl}`,
      icon: Twitter,
      color: '#0F1419',
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: Facebook,
      color: '#1877F2',
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Linkedin,
      color: '#0A66C2',
    },
    {
      label: 'Pinterest',
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedShareMessage}`,
      icon: Pin,
      color: '#E60023',
    },
    {
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedShareMessage}`,
      icon: Rss,
      color: '#FF4500',
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedEmailBody}`,
      icon: Mail,
      color: '#64748B',
    },
  ];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A6B2C0]">Compartir</p>
      <div className="flex flex-wrap items-center gap-2">
        {shareItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            title={`Compartir en ${item.label}`}
            aria-label={`Compartir en ${item.label}`}
            style={{ ['--brand' as string]: item.color }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7C8F] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[color:var(--brand)] hover:text-white"
          >
            {item.customIcon ? item.customIcon : <item.icon className="h-4 w-4" />}
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar enlace"
          aria-label="Copiar enlace"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-[#112B49] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#112B49] hover:text-white"
        >
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
