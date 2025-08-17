import { initializeApp, getApps, getApp } from "firebase/app";

export const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:      import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
