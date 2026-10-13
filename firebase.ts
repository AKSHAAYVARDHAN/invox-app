import { initializeApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : ({} as Record<string, string>);
const activeProjectId = env.VITE_FIREBASE_PROJECT_ID || 'invox-7';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyFakeKeyForLocalDevAndTests12345',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${activeProjectId}.firebaseapp.com`,
  projectId: activeProjectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${activeProjectId}.firebasestorage.app`,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${activeProjectId}-default-rtdb.firebaseio.com`,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  console.log('[AUTH_INIT] Firebase initialized for project:', activeProjectId, '| authDomain:', firebaseConfig.authDomain);
}

// Connect to default Firestore database on invox-7
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app);
export const functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1');

const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY;

export const appCheck = typeof window !== 'undefined' && appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

