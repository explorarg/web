import rawConfig from '@/lib/site-config.json';

export type SiteToken = 'siteName' | 'siteDescription' | 'logoTitleText';

export type SiteConfig = {
  branding: {
    siteName: string;
    siteDescription: string;
    siteUrlDefault: string;
    logo: {
      imagePath: string;
      imageUrl?: string;
      titleText: string;
      altTextTemplate?: string;
    };
    palette: {
      primary: string;
      secondary: string;
      success: string;
      successStrong: string;
      dark: string;
      cream: string;
    };
  };
  company: {
    adminEmailDefault: string;
    whatsappMessageDefault: string;
    contact: {
      direccion: string;
      horario: string;
      email: string;
      telefono: string;
      telefonoSecundario?: string;
      whatsappNumber: string;
      mapUrl: string;
    };
    social: {
      facebook: string;
      instagram: string;
      instagramHandle: string;
      threads?: string;
      tiktok?: string;
      whatsappChannel?: string;
      email: string;
    };
    legal: {
      razonSocial: string;
      cuit: string;
      legajoRnav: string;
    };
    developerCredits: {
      name: string;
      url: string;
    };
  };
  features: {
    showContactMap: boolean;
  };
  seo: {
    locale: string;
    titleDefaultTemplate: string;
    titleTemplate: string;
    openGraphImagePath: string;
    keywords: string[];
  };
  content: {
    homeHero: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitleTemplate: string;
    };
    packagesSection: {
      badge: string;
      title: string;
      subtitleTemplate: string;
    };
    services: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitle: string;
      items: Array<{ icon: string; title: string; desc: string }>;
    };
    values: {
      badge: string;
      title: string;
      subtitle: string;
      items: Array<{ icon: string; number: string; title: string; desc: string }>;
    };
    about: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      image: {
        src: string;
        altTemplate: string;
      };
      paragraphs: string[];
    };
    contactBlock: {
      badge: string;
      titlePrefix: string;
      titleAccent: string;
      subtitle: string;
    };
    contactForm: {
      title: string;
      subtitle: string;
      whatsappCta: string;
      image: {
        src: string;
        altTemplate: string;
      };
    };
    footer: {
      taglineTemplate: string;
      copyrightTemplate: string;
    };
  };
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isRecord(base)) return (override as T) ?? base;
  if (!isRecord(override)) return base;
  const out: Record<string, any> = { ...(base as any) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = out[key];
    if (Array.isArray(current)) {
      out[key] = Array.isArray(value) ? value : current;
      continue;
    }
    if (isRecord(current)) {
      out[key] = deepMerge(current, value);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

function ensureString(value: unknown, fallback: string, opts?: { allowEmpty?: boolean }) {
  const allowEmpty = opts?.allowEmpty ?? false;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) return fallback;
  return value;
}

function ensureBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function ensureStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
}

function normalizeAboutParagraphChunk(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk;
  if (!isRecord(chunk)) return '';

  const text = typeof chunk.text === 'string' ? chunk.text : '';
  const token = typeof chunk.token === 'string' ? `{{${chunk.token}}}` : '';
  const raw = text || token;
  if (!raw) return '';

  return chunk.strong === true ? `**${raw}**` : raw;
}

function normalizeAboutParagraph(value: unknown): string {
  if (typeof value === 'string') return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((chunk) => normalizeAboutParagraphChunk(chunk))
      .join('')
      .trim();
  }

  return normalizeAboutParagraphChunk(value).trim();
}

function ensureAbsoluteUrl(value: unknown, fallback: string) {
  const candidate = ensureString(value, fallback);
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    return u.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  branding: {
    siteName: 'Sitio',
    siteDescription: 'Descripción del sitio',
    siteUrlDefault: 'https://example.com',
    logo: {
      imagePath: '/logo.png',
      imageUrl: '',
      titleText: 'Sitio',
      altTextTemplate: '{{siteName}} Logo',
    },
    palette: {
      primary: '#0B6E4F',
      secondary: '#F2C14E',
      success: '#16A34A',
      successStrong: '#15803D',
      dark: '#0F172A',
      cream: '#FAF7F0',
    },
  },
  company: {
    adminEmailDefault: 'admin@example.com',
    whatsappMessageDefault: 'Hola! Quiero consultar por: ',
    contact: {
      direccion: '',
      horario: '',
      email: '',
      telefono: '',
      telefonoSecundario: '',
      whatsappNumber: '',
      mapUrl: '',
    },
    social: {
      facebook: '',
      instagram: '',
      instagramHandle: '',
      threads: '',
      tiktok: '',
      whatsappChannel: '',
      email: '',
    },
    legal: {
      razonSocial: '',
      cuit: '',
      legajoRnav: '',
    },
    developerCredits: {
      name: 'Tucs Digital',
      url: '',
    },
  },
  features: {
    showContactMap: true,
  },
  seo: {
    locale: 'es_AR',
    titleDefaultTemplate: '{{siteName}}',
    titleTemplate: '%s | {{siteName}}',
    openGraphImagePath: '/og-image.jpg',
    keywords: [],
  },
  content: {
    homeHero: {
      badge: '',
      titlePrefix: '',
      titleAccent: '',
      subtitleTemplate: '{{siteDescription}}',
    },
    packagesSection: {
      badge: '',
      title: '',
      subtitleTemplate: '',
    },
    services: {
      badge: '',
      titlePrefix: '',
      titleAccent: '',
      subtitle: '',
      items: [],
    },
    values: {
      badge: '',
      title: '',
      subtitle: '',
      items: [],
    },
    about: {
      badge: '',
      titlePrefix: '',
      titleAccent: '',
      image: {
        src: '/images/hero1.webp',
        altTemplate: 'Equipo de {{siteName}}',
      },
      paragraphs: [],
    },
    contactBlock: {
      badge: '',
      titlePrefix: '',
      titleAccent: '',
      subtitle: '',
    },
    contactForm: {
      title: '',
      subtitle: '',
      whatsappCta: 'Abrir WhatsApp',
      image: {
        src: '/images/3.jpg',
        altTemplate: '{{siteName}}',
      },
    },
    footer: {
      taglineTemplate: '{{siteDescription}}',
      copyrightTemplate: '© {{year}} {{logoTitleText}}. Todos los derechos reservados.',
    },
  },
};

function normalizeSiteConfig(input: SiteConfig): SiteConfig {
  const siteName = ensureString(input.branding?.siteName, DEFAULT_SITE_CONFIG.branding.siteName);
  const siteDescription = ensureString(input.branding?.siteDescription, DEFAULT_SITE_CONFIG.branding.siteDescription);
  const siteUrlDefault = ensureAbsoluteUrl(input.branding?.siteUrlDefault, DEFAULT_SITE_CONFIG.branding.siteUrlDefault);

  const logoTitleText = ensureString(
    input.branding?.logo?.titleText,
    ensureString(siteName, DEFAULT_SITE_CONFIG.branding.logo.titleText)
  );

  return {
    branding: {
      siteName,
      siteDescription,
      siteUrlDefault,
      logo: {
        imagePath: ensureString(input.branding?.logo?.imagePath, DEFAULT_SITE_CONFIG.branding.logo.imagePath),
        imageUrl: ensureString(input.branding?.logo?.imageUrl, '', { allowEmpty: true }),
        titleText: logoTitleText,
        altTextTemplate: ensureString(
          input.branding?.logo?.altTextTemplate,
          DEFAULT_SITE_CONFIG.branding.logo.altTextTemplate || '{{siteName}} Logo'
        ),
      },
      palette: {
        primary: ensureString(input.branding?.palette?.primary, DEFAULT_SITE_CONFIG.branding.palette.primary),
        secondary: ensureString(input.branding?.palette?.secondary, DEFAULT_SITE_CONFIG.branding.palette.secondary),
        success: ensureString(input.branding?.palette?.success, DEFAULT_SITE_CONFIG.branding.palette.success),
        successStrong: ensureString(input.branding?.palette?.successStrong, DEFAULT_SITE_CONFIG.branding.palette.successStrong),
        dark: ensureString(input.branding?.palette?.dark, DEFAULT_SITE_CONFIG.branding.palette.dark),
        cream: ensureString(input.branding?.palette?.cream, DEFAULT_SITE_CONFIG.branding.palette.cream),
      },
    },
    company: {
      adminEmailDefault: ensureString(input.company?.adminEmailDefault, DEFAULT_SITE_CONFIG.company.adminEmailDefault),
      whatsappMessageDefault: ensureString(input.company?.whatsappMessageDefault, DEFAULT_SITE_CONFIG.company.whatsappMessageDefault),
      contact: {
        direccion: ensureString(input.company?.contact?.direccion, DEFAULT_SITE_CONFIG.company.contact.direccion, { allowEmpty: true }),
        horario: ensureString(input.company?.contact?.horario, DEFAULT_SITE_CONFIG.company.contact.horario, { allowEmpty: true }),
        email: ensureString(input.company?.contact?.email, DEFAULT_SITE_CONFIG.company.contact.email, { allowEmpty: true }),
        telefono: ensureString(input.company?.contact?.telefono, DEFAULT_SITE_CONFIG.company.contact.telefono, { allowEmpty: true }),
        whatsappNumber: ensureString(input.company?.contact?.whatsappNumber, DEFAULT_SITE_CONFIG.company.contact.whatsappNumber, { allowEmpty: true }),
        mapUrl: ensureString(input.company?.contact?.mapUrl, DEFAULT_SITE_CONFIG.company.contact.mapUrl, { allowEmpty: true }),
      },
      social: {
        facebook: ensureString(input.company?.social?.facebook, DEFAULT_SITE_CONFIG.company.social.facebook, { allowEmpty: true }),
        instagram: ensureString(input.company?.social?.instagram, DEFAULT_SITE_CONFIG.company.social.instagram, { allowEmpty: true }),
        instagramHandle: ensureString(input.company?.social?.instagramHandle, DEFAULT_SITE_CONFIG.company.social.instagramHandle, { allowEmpty: true }),
        threads: ensureString(input.company?.social?.threads, '', { allowEmpty: true }),
        tiktok: ensureString(input.company?.social?.tiktok, '', { allowEmpty: true }),
        email: ensureString(input.company?.social?.email, DEFAULT_SITE_CONFIG.company.social.email, { allowEmpty: true }),
      },
      legal: {
        razonSocial: ensureString(input.company?.legal?.razonSocial, DEFAULT_SITE_CONFIG.company.legal.razonSocial, { allowEmpty: true }),
        cuit: ensureString(input.company?.legal?.cuit, DEFAULT_SITE_CONFIG.company.legal.cuit, { allowEmpty: true }),
        legajoRnav: ensureString(input.company?.legal?.legajoRnav, DEFAULT_SITE_CONFIG.company.legal.legajoRnav, { allowEmpty: true }),
      },
      developerCredits: {
        name: ensureString(input.company?.developerCredits?.name, DEFAULT_SITE_CONFIG.company.developerCredits.name),
        url: ensureString(input.company?.developerCredits?.url, DEFAULT_SITE_CONFIG.company.developerCredits.url, { allowEmpty: true }),
      },
    },
    features: {
      showContactMap: ensureBoolean(input.features?.showContactMap, DEFAULT_SITE_CONFIG.features.showContactMap),
    },
    seo: {
      locale: ensureString(input.seo?.locale, DEFAULT_SITE_CONFIG.seo.locale),
      titleDefaultTemplate: ensureString(input.seo?.titleDefaultTemplate, DEFAULT_SITE_CONFIG.seo.titleDefaultTemplate),
      titleTemplate: ensureString(input.seo?.titleTemplate, DEFAULT_SITE_CONFIG.seo.titleTemplate),
      openGraphImagePath: ensureString(input.seo?.openGraphImagePath, DEFAULT_SITE_CONFIG.seo.openGraphImagePath),
      keywords: ensureStringArray(input.seo?.keywords, DEFAULT_SITE_CONFIG.seo.keywords),
    },
    content: {
      homeHero: {
        badge: ensureString(input.content?.homeHero?.badge, DEFAULT_SITE_CONFIG.content.homeHero.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.homeHero?.titlePrefix, DEFAULT_SITE_CONFIG.content.homeHero.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.homeHero?.titleAccent, DEFAULT_SITE_CONFIG.content.homeHero.titleAccent, { allowEmpty: true }),
        subtitleTemplate: ensureString(input.content?.homeHero?.subtitleTemplate, DEFAULT_SITE_CONFIG.content.homeHero.subtitleTemplate),
      },
      packagesSection: {
        badge: ensureString(input.content?.packagesSection?.badge, DEFAULT_SITE_CONFIG.content.packagesSection.badge, { allowEmpty: true }),
        title: ensureString(input.content?.packagesSection?.title, DEFAULT_SITE_CONFIG.content.packagesSection.title, { allowEmpty: true }),
        subtitleTemplate: ensureString(input.content?.packagesSection?.subtitleTemplate, DEFAULT_SITE_CONFIG.content.packagesSection.subtitleTemplate, { allowEmpty: true }),
      },
      services: {
        badge: ensureString(input.content?.services?.badge, DEFAULT_SITE_CONFIG.content.services.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.services?.titlePrefix, DEFAULT_SITE_CONFIG.content.services.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.services?.titleAccent, DEFAULT_SITE_CONFIG.content.services.titleAccent, { allowEmpty: true }),
        subtitle: ensureString(input.content?.services?.subtitle, DEFAULT_SITE_CONFIG.content.services.subtitle, { allowEmpty: true }),
        items: Array.isArray(input.content?.services?.items)
          ? input.content.services.items
              .map((it: any) => ({
                icon: ensureString(it?.icon, 'Users'),
                title: ensureString(it?.title, '', { allowEmpty: true }),
                desc: ensureString(it?.desc, '', { allowEmpty: true }),
              }))
              .filter((it: any) => it.title.trim().length > 0 || it.desc.trim().length > 0)
          : [],
      },
      values: {
        badge: ensureString(input.content?.values?.badge, DEFAULT_SITE_CONFIG.content.values.badge, { allowEmpty: true }),
        title: ensureString(input.content?.values?.title, DEFAULT_SITE_CONFIG.content.values.title, { allowEmpty: true }),
        subtitle: ensureString(input.content?.values?.subtitle, DEFAULT_SITE_CONFIG.content.values.subtitle, { allowEmpty: true }),
        items: Array.isArray(input.content?.values?.items)
          ? input.content.values.items
              .map((it: any) => ({
                icon: ensureString(it?.icon, 'Award'),
                number: ensureString(it?.number, '', { allowEmpty: true }),
                title: ensureString(it?.title, '', { allowEmpty: true }),
                desc: ensureString(it?.desc, '', { allowEmpty: true }),
              }))
              .filter((it: any) => it.title.trim().length > 0 || it.desc.trim().length > 0)
          : [],
      },
      about: {
        badge: ensureString(input.content?.about?.badge, DEFAULT_SITE_CONFIG.content.about.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.about?.titlePrefix, DEFAULT_SITE_CONFIG.content.about.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.about?.titleAccent, DEFAULT_SITE_CONFIG.content.about.titleAccent, { allowEmpty: true }),
        image: {
          src: ensureString(input.content?.about?.image?.src, DEFAULT_SITE_CONFIG.content.about.image.src),
          altTemplate: ensureString(input.content?.about?.image?.altTemplate, DEFAULT_SITE_CONFIG.content.about.image.altTemplate),
        },
        paragraphs: Array.isArray(input.content?.about?.paragraphs)
          ? input.content.about.paragraphs
              .map((v: unknown) => normalizeAboutParagraph(v))
              .filter((v: string) => v.length > 0)
          : [],
      },
      contactBlock: {
        badge: ensureString(input.content?.contactBlock?.badge, DEFAULT_SITE_CONFIG.content.contactBlock.badge, { allowEmpty: true }),
        titlePrefix: ensureString(input.content?.contactBlock?.titlePrefix, DEFAULT_SITE_CONFIG.content.contactBlock.titlePrefix, { allowEmpty: true }),
        titleAccent: ensureString(input.content?.contactBlock?.titleAccent, DEFAULT_SITE_CONFIG.content.contactBlock.titleAccent, { allowEmpty: true }),
        subtitle: ensureString(input.content?.contactBlock?.subtitle, DEFAULT_SITE_CONFIG.content.contactBlock.subtitle, { allowEmpty: true }),
      },
      contactForm: {
        title: ensureString(input.content?.contactForm?.title, DEFAULT_SITE_CONFIG.content.contactForm.title, { allowEmpty: true }),
        subtitle: ensureString(input.content?.contactForm?.subtitle, DEFAULT_SITE_CONFIG.content.contactForm.subtitle, { allowEmpty: true }),
        whatsappCta: ensureString(input.content?.contactForm?.whatsappCta, DEFAULT_SITE_CONFIG.content.contactForm.whatsappCta),
        image: {
          src: ensureString(input.content?.contactForm?.image?.src, DEFAULT_SITE_CONFIG.content.contactForm.image.src),
          altTemplate: ensureString(input.content?.contactForm?.image?.altTemplate, DEFAULT_SITE_CONFIG.content.contactForm.image.altTemplate),
        },
      },
      footer: {
        taglineTemplate: ensureString(input.content?.footer?.taglineTemplate, DEFAULT_SITE_CONFIG.content.footer.taglineTemplate),
        copyrightTemplate: ensureString(input.content?.footer?.copyrightTemplate, DEFAULT_SITE_CONFIG.content.footer.copyrightTemplate),
      },
    },
  };
}

export const siteConfig: SiteConfig = normalizeSiteConfig(deepMerge(DEFAULT_SITE_CONFIG, rawConfig) as SiteConfig);

export function resolveTokenValue(token: SiteToken): string {
  if (token === 'siteName') return siteConfig.branding.siteName;
  if (token === 'siteDescription') return siteConfig.branding.siteDescription;
  return siteConfig.branding.logo.titleText;
}

export function renderTemplate(template: string, vars?: Record<string, string>) {
  if (typeof template !== 'string' || template.length === 0) return '';
  const baseVars: Record<string, string> = {
    siteName: siteConfig.branding.siteName,
    siteDescription: siteConfig.branding.siteDescription,
    logoTitleText: siteConfig.branding.logo.titleText,
    year: String(new Date().getFullYear()),
    ...(vars ?? {}),
  };

  return Object.entries(baseVars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function getBrandLogoSrc() {
  const candidate = (siteConfig.branding.logo.imageUrl || '').trim();
  const local = (siteConfig.branding.logo.imagePath || '').trim();
  if (candidate.length > 0) return candidate;
  if (local.length > 0) return local;
  return DEFAULT_SITE_CONFIG.branding.logo.imagePath;
}

export function isRemoteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export function getBrandLogoAbsolute(siteUrl: string) {
  const src = getBrandLogoSrc();
  if (isRemoteUrl(src)) return src;
  return `${siteUrl}${src}`;
}
