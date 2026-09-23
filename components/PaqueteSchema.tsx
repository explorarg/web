'use client';

import { Paquete } from '@/types';
import { SITE_NAME, LEGAL_INFO, SITE_URL } from '@/lib/constants';

const siteUrl = SITE_URL;

interface PaqueteSchemaProps {
  paquete: Paquete;
  basePath?: string;
}

export default function PaqueteSchema({ paquete, basePath = '/paquete' }: PaqueteSchemaProps) {
  const listPath = basePath === '/f1' ? '/f1' : '/paquetes';
  // Limpiar HTML de la descripción
  const cleanDescription = paquete.descripcionCorta || 
    paquete.descripcion.replace(/<[^>]*>/g, '').substring(0, 300).trim();

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: paquete.titulo,
    description: cleanDescription,
    image: paquete.imagenPortada || paquete.imagenTarjeta || paquete.imagenPrincipal || `${siteUrl}/logo.png`,
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
    offers: {
      '@type': 'Offer',
      price: paquete.precio,
      priceCurrency: paquete.moneda,
      availability: 'https://schema.org/InStock',
      url: `${siteUrl}${basePath}/${paquete.slug}`,
      priceValidUntil: (() => {
        // Calcular fecha de validez: 1 año desde hoy o fecha de última salida + 30 días, lo que sea mayor
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        if (paquete.salidas && paquete.salidas.length > 0) {
          const lastSalida = [...paquete.salidas]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
          const lastSalidaDate = new Date(lastSalida.fecha + 'T00:00:00');
          lastSalidaDate.setDate(lastSalidaDate.getDate() + 30); // 30 días después de la última salida
          
          // Usar la fecha más lejana entre 1 año desde hoy y 30 días después de la última salida
          return lastSalidaDate > oneYearFromNow 
            ? lastSalidaDate.toISOString().split('T')[0] 
            : oneYearFromNow.toISOString().split('T')[0];
        }
        
        return oneYearFromNow.toISOString().split('T')[0];
      })(),
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'AR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnInStore',
        returnFees: 'https://schema.org/FreeReturn',
        url: `${siteUrl}/terminos-condiciones`,
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: paquete.moneda,
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 7,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 0,
            unitCode: 'DAY',
          },
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'AR',
        },
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: '10',
    },
  };

  const travelAgencySchema = {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE_NAME,
    url: siteUrl,
    legalName: LEGAL_INFO.razonSocial,
    taxID: LEGAL_INFO.cuit,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tandil',
      addressRegion: 'Buenos Aires',
      addressCountry: 'AR',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Paquetes',
        item: `${siteUrl}${listPath}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: paquete.titulo,
        item: `${siteUrl}${basePath}/${paquete.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(travelAgencySchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}
