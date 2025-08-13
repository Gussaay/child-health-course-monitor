import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Prefer local .env; fall back to FIREBASE_WEBAPP_CONFIG injected by App Hosting
const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

let config = cfg;
if (!cfg?.apiKey && typeof window !== 'undefined') {
  try {
    // In App Hosting, FIREBASE_WEBAPP_CONFIG is provided at build time
    if (typeof FIREBASE_WEBAPP_CONFIG !== 'undefined') {
      config = JSON.parse(FIREBASE_WEBAPP_CONFIG);
    }
  } catch {}
}

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => { /* ignore multi-tab */ });

export const googleProvider = new GoogleAuthProvider();
export const signInWithGooglePopup = () => signInWithPopup(auth, googleProvider);
