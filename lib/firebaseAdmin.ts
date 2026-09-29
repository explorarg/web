import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

function normalizeEnvString(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function normalizePrivateKey(value: unknown): string | null {
  const s = normalizeEnvString(value);
  if (!s) return null;
  return s.replace(/\\n/g, '\n');
}

function initFromEnvParts(): Auth | null {
  const projectId = normalizeEnvString(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalizeEnvString(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) return null;
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    } as any),
  });
  return getAuth();
}

function parseServiceAccountJson(raw: string): any | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
      }
      return parsed;
    } catch {
      return null;
    }
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    try {
      const json = Buffer.from(trimmed, 'base64').toString('utf-8');
      const parsed = JSON.parse(json);
      if (parsed?.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
      }
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function init() {
  if (_adminAuth || _adminDb) return;
  if (getApps().length > 0) {
    _adminAuth = getAuth();
    _adminDb = getFirestore();
    return;
  }
  const fromParts = initFromEnvParts();
  if (fromParts) {
    _adminAuth = fromParts;
    _adminDb = getFirestore();
    return;
  }

  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? '';
  if (saRaw) {
    const parsed = parseServiceAccountJson(saRaw);
    if (parsed) {
      initializeApp({
        credential: cert(parsed),
      });
      _adminAuth = getAuth();
      _adminDb = getFirestore();
      return;
    }
    console.warn('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT presente pero no válido. Admin deshabilitado.');
    _adminAuth = null;
    return;
  }
  // Sin credenciales explícitas, no inicializamos para evitar errores en local
  console.warn('[firebaseAdmin] No se encontraron credenciales. Firebase Admin deshabilitado.');
  _adminAuth = null;
  _adminDb = null;
}

init();

export const adminAuth: Auth | null = _adminAuth;

export function getAdminDb(): Firestore | null {
  return _adminDb;
}
