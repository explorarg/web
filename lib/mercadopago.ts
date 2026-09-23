import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

export const mercadopagoEnabled = Boolean(ACCESS_TOKEN);

export function assertMercadoPagoEnabled(context?: string): void {
  if (mercadopagoEnabled) return;
  const extra = context ? ` (${context})` : '';
  throw new Error(
    `Mercado Pago no está configurado${extra}. Definí MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.`
  );
}

// Inicializar cliente de Mercado Pago
export const getMercadoPagoClient = () => {
  assertMercadoPagoEnabled('Client');
  return new MercadoPagoConfig({ 
    accessToken: ACCESS_TOKEN!,
    options: {
      timeout: 30000,
    }
  });
};

// Crear preferencia de pago
export async function createPreference(params: {
  items: Array<{
    id?: string;
    title: string;
    description?: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
    picture_url?: string;
  }>;
  external_reference: string;
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  notification_url?: string;
  payer?: {
    email?: string;
    name?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
  };
  auto_return?: 'approved' | 'all';
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
}) {
  const client = getMercadoPagoClient();
  const preference = new Preference(client);

  // Preparar items con id si no existe (requerido por el SDK)
  const itemsWithId = params.items.map((item, index) => ({
    id: item.id || `item-${index}`,
    ...item
  }));

  const result = await preference.create({
    body: {
      items: itemsWithId as any,
      external_reference: params.external_reference,
      back_urls: params.back_urls,
      notification_url: params.notification_url,
      payer: params.payer,
      ...(params.auto_return ? { auto_return: params.auto_return } : {}),
      expires: params.expires ?? false,
      ...(params.expiration_date_from && { expiration_date_from: params.expiration_date_from }),
      ...(params.expiration_date_to && { expiration_date_to: params.expiration_date_to }),
    }
  });

  return result;
}

// Obtener información de un pago
export async function getPayment(paymentId: string) {
  const client = getMercadoPagoClient();
  const payment = new Payment(client);
  
  const result = await payment.get({ id: paymentId });
  return result;
}

// Buscar pagos por external_reference
export async function searchPayments(externalReference: string) {
  const client = getMercadoPagoClient();
  const payment = new Payment(client);
  
  const result = await payment.search({
    options: {
      external_reference: externalReference,
    }
  });
  
  return result;
}

// Tipos de estado de pago de Mercado Pago
export type MercadoPagoPaymentStatus = 
  | 'pending'           // Pendiente
  | 'approved'          // Aprobado
  | 'authorized'        // Autorizado (pendiente de captura)
  | 'in_process'        // En proceso
  | 'in_mediation'      // En mediación
  | 'rejected'          // Rechazado
  | 'cancelled'         // Cancelado
  | 'refunded'          // Reembolsado
  | 'charged_back';     // Contracargo

// Mapear estado de Mercado Pago a estado de reserva interno
export function mapPaymentStatusToReservationStatus(
  mpStatus: MercadoPagoPaymentStatus | string
): 'pending' | 'reserved' | 'completed' | 'cancelled' {
  switch (mpStatus) {
    case 'approved':
      return 'completed';
    case 'authorized':
    case 'in_process':
      return 'reserved';
    case 'pending':
      return 'pending';
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'cancelled';
    default:
      return 'pending';
  }
}

// Verificar si el pago está aprobado
export function isPaymentApproved(status: MercadoPagoPaymentStatus | string): boolean {
  return status === 'approved';
}

// Verificar si el pago está pendiente
export function isPaymentPending(status: MercadoPagoPaymentStatus | string): boolean {
  return ['pending', 'in_process', 'authorized'].includes(status);
}

// Verificar si el pago fue rechazado o cancelado
export function isPaymentRejected(status: MercadoPagoPaymentStatus | string): boolean {
  return ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status);
}

// Formatear monto para Mercado Pago (convierte a formato con decimales)
export function formatAmountForMP(amount: number): number {
  // Mercado Pago espera montos con 2 decimales (ej: 1000.00 = $1000)
  return Number((amount / 100).toFixed(2));
}

// Convertir monto de MP a centavos (para guardar en BD)
export function parseAmountFromMP(amount: number): number {
  return Math.round(amount * 100);
}

// Obtener URL de checkout de preferencia
export function getCheckoutUrl(preferenceResponse: any): string | null {
  return preferenceResponse.init_point || preferenceResponse.sandbox_init_point || null;
}
