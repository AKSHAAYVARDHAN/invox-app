import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const requiredEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);

if (missingEnv.length > 0) {
  console.warn(
    `[Firebase] Missing Firebase environment variables: ${missingEnv.join(', ')}. ` +
    `Ensure these are defined in your environment (.env.local for local development, or Vercel Project Settings for production).`
  );
}

const activeProjectId = requiredEnv.projectId || 'invox-7';

const firebaseConfig = {
  apiKey: requiredEnv.apiKey || '',
  authDomain: requiredEnv.authDomain || `${activeProjectId}.firebaseapp.com`,
  projectId: activeProjectId,
  storageBucket: requiredEnv.storageBucket || `${activeProjectId}.firebasestorage.app`,
  messagingSenderId: requiredEnv.messagingSenderId || '',
  appId: requiredEnv.appId || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${activeProjectId}-default-rtdb.firebaseio.com`,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  console.log('[AUTH_INIT] Firebase initialized for project:', activeProjectId, '| authDomain:', firebaseConfig.authDomain);
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1');

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

export const appCheck = typeof window !== 'undefined' && appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;
