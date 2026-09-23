import { WHATSAPP_NUMBER, WHATSAPP_MESSAGE_DEFAULT } from '@/lib/constants';

export function getWhatsAppLink(message?: string): string {
  const encodedMessage = encodeURIComponent(message || WHATSAPP_MESSAGE_DEFAULT);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
}

export function getWhatsAppLinkForPackage(packageTitle: string): string {
  const message = `${WHATSAPP_MESSAGE_DEFAULT}${packageTitle}`;
  return getWhatsAppLink(message);
}

export function getWhatsAppLinkForExperience({
  experienceTitle,
  date,
  people,
}: {
  experienceTitle: string;
  date?: string;
  people?: number;
}): string {
  const baseMessage = `Hola! Quiero reservar ${experienceTitle}. Me pasás disponibilidad y detalles?`;
  const details = [
    date ? `Fecha tentativa: ${date}` : null,
    people ? `Personas: ${people}` : null,
  ].filter(Boolean);

  const message = details.length > 0 ? `${baseMessage} ${details.join(' - ')}` : baseMessage;
  return getWhatsAppLink(message);
}
