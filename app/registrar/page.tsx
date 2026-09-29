import { redirect } from 'next/navigation';

/** Mantiene /registrar como alias de la ruta canónica /registro. */
export default function RegistrarAliasPage() {
  redirect('/registro');
}
