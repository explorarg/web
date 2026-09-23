import ConsultarReservaClient from '@/components/consultar-reserva/ConsultarReservaClient';

export const revalidate = 0;

type SearchParams = Promise<{ code?: string }>;

export default async function ConsultarReservaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const initialCode = String(sp.code ?? '').trim();
  return <ConsultarReservaClient initialCode={initialCode} />;
}
