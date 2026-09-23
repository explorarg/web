import { ADMIN_EMAIL } from '@/lib/constants';

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function verifyFirebaseIdToken(idToken: string) {
  if (!FIREBASE_API_KEY) {
    throw new Error('Falta la clave de API de Firebase');
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? 'Token inválido');
  }
  const data = await response.json();
  return data.users?.[0];
}

export async function requireAdminToken(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    throw new Error('Necesitás autenticarte');
  }
  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    throw new Error('Token inválido');
  }
  const email = String(user.email ?? '').trim().toLowerCase();
  if (!email || email !== ADMIN_EMAIL) {
    throw new Error('Acceso denegado');
  }
  return user;
}
