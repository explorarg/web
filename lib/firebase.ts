import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

export function assertFirebaseEnabled(context?: string): void {
  if (firebaseEnabled) return;
  const extra = context ? ` (${context})` : '';
  throw new Error(
    `Firebase no está configurado${extra}. Definí NEXT_PUBLIC_FIREBASE_* en .env.local`
  );
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Auth - Lazy loading para evitar cargar iframe.js en páginas públicas
// Solo se inicializa cuando se necesita (páginas admin)
let authInstance: Auth | null = null;

// Helper para obtener auth de forma lazy (solo cuando se necesita)
export const getAuthInstance = (): Auth => {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Auth solo está disponible en el cliente');
  }
  assertFirebaseEnabled('Auth');
  
  // Lazy initialization - solo inicializar cuando se solicite
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  
  return authInstance;
};

export { app, db };

