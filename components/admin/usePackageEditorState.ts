'use client';

import { useCallback, useState } from 'react';
import type { Paquete, PickupPointItem, ReservationPricingConfig, ReservationRoomType, RoomTypeDefinition, Salida } from '@/types';
import type { CondicionItem, ItineraryItem } from '@/lib/packages/admin-form';

export type ImageAsset = {
  url: string;
  key?: string;
};

type Options = {
  defaultCondiciones: CondicionItem[];
};

export function usePackageEditorState({ defaultCondiciones }: Options) {
  const [imagenTarjetaPreview, setImagenTarjetaPreview] = useState<string[]>([]);
  const [imagenTarjetaOriginal, setImagenTarjetaOriginal] = useState<string>('');
  const [imagenTarjetaKey, setImagenTarjetaKey] = useState<string>('');
  const [originalImagenTarjetaKey, setOriginalImagenTarjetaKey] = useState<string | null>(null);
  const [imagenPortadaPreview, setImagenPortadaPreview] = useState<string[]>([]);
  const [imagenPortadaOriginal, setImagenPortadaOriginal] = useState<string>('');
  const [imagenPortadaKey, setImagenPortadaKey] = useState<string>('');
  const [originalImagenPortadaKey, setOriginalImagenPortadaKey] = useState<string | null>(null);
  const [galeriaPreview, setGaleriaPreview] = useState<string[]>([]);
  const [galleryAssets, setGalleryAssets] = useState<ImageAsset[]>([]);
  const [originalGaleriaKeys, setOriginalGaleriaKeys] = useState<string[]>([]);
  const [includeItems, setIncludeItems] = useState<string[]>([]);
  const [selectedTransportes, setSelectedTransportes] = useState<string[]>([]);
  const [tagItems, setTagItems] = useState<string[]>([]);
  const [noIncludeItems, setNoIncludeItems] = useState<string[]>([]);
  const [extrasOpcionales, setExtrasOpcionales] = useState<string[]>([]);
  const [condicionesItems, setCondicionesItems] = useState<CondicionItem[]>(defaultCondiciones.map((item) => ({ ...item })));
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPointItem[]>([]);
  const [seatSelectionEnabled, setSeatSelectionEnabled] = useState(false);
  const [seatLayoutId, setSeatLayoutId] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [transportOrigin, setTransportOrigin] = useState('');
  const [transportDestination, setTransportDestination] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [reservationPricing, setReservationPricing] = useState<ReservationPricingConfig | null>(null);
  const [roomTypes, setRoomTypes] = useState<ReservationRoomType[]>([]);
  const [roomTypeOptions, setRoomTypeOptions] = useState<RoomTypeDefinition[]>([]);

  const handleImagenTarjetaChange = useCallback(
    (urls: string[]) => {
      const nextUrl = urls[0] ?? '';
      setImagenTarjetaPreview(nextUrl ? [nextUrl] : []);
      if (!nextUrl) {
        setImagenTarjetaKey('');
        return;
      }
      setImagenTarjetaKey((currentKey) => (nextUrl !== imagenTarjetaPreview[0] ? '' : currentKey));
    },
    [imagenTarjetaPreview]
  );

  const handleImagenPortadaChange = useCallback(
    (urls: string[]) => {
      const nextUrl = urls[0] ?? '';
      setImagenPortadaPreview(nextUrl ? [nextUrl] : []);
      if (!nextUrl) {
        setImagenPortadaKey('');
        return;
      }
      setImagenPortadaKey((currentKey) => (nextUrl !== imagenPortadaPreview[0] ? '' : currentKey));
    },
    [imagenPortadaPreview]
  );

  const handleGaleriaChange = useCallback((newImages: string[]) => {
    setGaleriaPreview(newImages);
    setGalleryAssets((prevAssets) => {
      const available = [...prevAssets];
      return newImages.map((url) => {
        const matchIndex = available.findIndex((asset) => asset.url === url);
        if (matchIndex !== -1) {
          const [matched] = available.splice(matchIndex, 1);
          return matched;
        }
        return { url };
      });
    });
  }, []);

  const hydrateFromPackage = useCallback(
    (data: Paquete, helpers: { getBlobKeyFromUrl: (url: string) => string | null }) => {
      const tarjeta = data.imagenTarjeta || data.imagenPrincipal || '';
      const portada = data.imagenPortada || data.imagenPrincipal || '';
      const galeria = data.galeria || [];
      const galeriaKeys = data.galeriaKeys ?? [];
      const tarjetaKey = data.imagenTarjetaKey ?? data.imagenPrincipalKey ?? helpers.getBlobKeyFromUrl(tarjeta) ?? '';
      const portadaKey = data.imagenPortadaKey ?? data.imagenPrincipalKey ?? helpers.getBlobKeyFromUrl(portada) ?? '';

      setImagenTarjetaOriginal(tarjeta);
      setImagenPortadaOriginal(portada);
      setImagenTarjetaPreview(tarjeta ? [tarjeta] : []);
      setImagenTarjetaKey(tarjetaKey);
      setOriginalImagenTarjetaKey(tarjetaKey || null);
      setImagenPortadaPreview(portada ? [portada] : []);
      setImagenPortadaKey(portadaKey);
      setOriginalImagenPortadaKey(portadaKey || null);
      setGaleriaPreview(galeria);
      setGalleryAssets(
        galeria.map((url, idx) => ({
          url,
          key: (galeriaKeys[idx] || helpers.getBlobKeyFromUrl(url)) ?? undefined,
        }))
      );
      setOriginalGaleriaKeys(
        galeria
          .map((url, idx) => (galeriaKeys[idx] || helpers.getBlobKeyFromUrl(url)) ?? '')
          .filter((key): key is string => Boolean(key))
      );
      setIncludeItems(data.incluye || []);
      setSelectedTransportes((data.tiposTransporte || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean));
      setTagItems(data.tags || []);
      setNoIncludeItems(data.noIncluye || []);
      setExtrasOpcionales(
        Array.isArray((data as any).extrasOpcionales)
          ? (data as any).extrasOpcionales.map((item: any) => String(item ?? '').trim()).filter(Boolean)
          : []
      );
      setCondicionesItems(
        Array.isArray(data.condiciones) && data.condiciones.length > 0
          ? data.condiciones.map((item) => ({
              titulo: String(item?.titulo ?? ''),
              texto: String(item?.texto ?? ''),
            }))
          : defaultCondiciones.map((item) => ({ ...item }))
      );
      setItineraryItems(
        Array.isArray((data as any).itinerario)
          ? (data as any).itinerario
              .map((item: any) => ({
                titulo: String(item?.titulo ?? '').trim(),
                descripcion: String(item?.descripcion ?? '').trim(),
              }))
              .filter((item: ItineraryItem) => item.titulo.length > 0 || item.descripcion.length > 0)
          : []
      );
      setSalidas(data.salidas || []);
      const configRaw = (data as any).pickupPointsConfig;
      if (Array.isArray(configRaw)) {
        setPickupPoints(
          configRaw
            .map((item: any) => ({
              label: String(item?.label ?? '').trim(),
              time: String(item?.time ?? '').trim(),
              hasExtra: Boolean(item?.hasExtra),
              extraAmount: Boolean(item?.hasExtra) ? Math.max(0, Number(item?.extraAmount ?? 0) || 0) : 0,
            }))
            .filter((item: PickupPointItem) => item.label.length > 0)
        );
      } else if (Array.isArray((data as any).pickupPoints)) {
        setPickupPoints(
          (data as any).pickupPoints
            .map((item: any) => ({
              label: String(item ?? '').trim(),
              time: '',
              hasExtra: false,
              extraAmount: 0,
            }))
            .filter((item: PickupPointItem) => item.label.length > 0)
        );
      } else {
        setPickupPoints([]);
      }
      setSeatSelectionEnabled(Boolean((data as any).seatSelectionEnabled));
      setSeatLayoutId(String((data as any).seatLayoutId ?? ''));
      setTransportCompany(String((data as any).transportCompany ?? ''));
      setTransportOrigin(String((data as any).transportOrigin ?? ''));
      setTransportDestination(String((data as any).transportDestination ?? ''));
      setFechaVencimiento(String((data as any).fechaVencimiento ?? ''));
      setRoomTypes(
        Array.isArray(data.roomTypes)
          ? data.roomTypes
          : []
      );
      setRoomTypeOptions(Array.isArray(data.roomTypeOptions) ? data.roomTypeOptions : []);
      const rawPricing = (data as any).reservationPricing;
      if (rawPricing && typeof rawPricing === 'object') {
        const mode = String((rawPricing as any).mode ?? '').trim().toLowerCase();
        if (mode === 'fixed' || mode === 'percent') {
          setReservationPricing({
            mode: mode as ReservationPricingConfig['mode'],
            fixedUnitAmount:
              typeof (rawPricing as any).fixedUnitAmount === 'number'
                ? Number((rawPricing as any).fixedUnitAmount) || 0
                : null,
            single:
              (rawPricing as any).single && typeof (rawPricing as any).single === 'object'
                ? {
                    adultPercent: Number((rawPricing as any).single.adultPercent) || 0,
                    minorPercent:
                      typeof (rawPricing as any).single.minorPercent === 'number'
                        ? Number((rawPricing as any).single.minorPercent) || 0
                        : null,
                  }
                : null,
            group:
              (rawPricing as any).group && typeof (rawPricing as any).group === 'object'
                ? {
                    adultPercent: Number((rawPricing as any).group.adultPercent) || 0,
                    minorPercent:
                      typeof (rawPricing as any).group.minorPercent === 'number'
                        ? Number((rawPricing as any).group.minorPercent) || 0
                        : null,
                  }
                : null,
            allowCustomPercent: Boolean((rawPricing as any).allowCustomPercent),
          });
        } else {
          setReservationPricing(null);
        }
      } else {
        setReservationPricing(null);
      }
    },
    [defaultCondiciones]
  );

  return {
    imagenTarjetaPreview,
    setImagenTarjetaPreview,
    imagenTarjetaOriginal,
    imagenTarjetaKey,
    setImagenTarjetaKey,
    originalImagenTarjetaKey,
    imagenPortadaPreview,
    setImagenPortadaPreview,
    imagenPortadaOriginal,
    imagenPortadaKey,
    setImagenPortadaKey,
    originalImagenPortadaKey,
    galeriaPreview,
    setGaleriaPreview,
    galleryAssets,
    setGalleryAssets,
    originalGaleriaKeys,
    includeItems,
    setIncludeItems,
    selectedTransportes,
    setSelectedTransportes,
    tagItems,
    setTagItems,
    noIncludeItems,
    setNoIncludeItems,
    extrasOpcionales,
    setExtrasOpcionales,
    condicionesItems,
    setCondicionesItems,
    itineraryItems,
    setItineraryItems,
    salidas,
    setSalidas,
    pickupPoints,
    setPickupPoints,
    seatSelectionEnabled,
    setSeatSelectionEnabled,
    seatLayoutId,
    setSeatLayoutId,
    transportCompany,
    setTransportCompany,
    transportOrigin,
    setTransportOrigin,
    transportDestination,
    setTransportDestination,
    fechaVencimiento,
    setFechaVencimiento,
    reservationPricing,
    setReservationPricing,
    roomTypes,
    setRoomTypes,
    roomTypeOptions,
    setRoomTypeOptions,
    handleImagenTarjetaChange,
    handleImagenPortadaChange,
    handleGaleriaChange,
    hydrateFromPackage,
  };
}
