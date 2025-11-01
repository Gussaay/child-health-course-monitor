// firebase.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  // --- Using the "Browser key" from your other screenshot ---
  apiKey: "AIzaSyDhGYv7E7KMeiLvF6yjjKkhr1fJ2BL7iupA",
  authDomain: "imnci-courses-monitor.firebaseapp.com",
  projectId: "imnci-courses-monitor",
  // --- This is the corrected storage bucket URL ---
  storageBucket: "imnci-courses-monitor.appspot.com",
  messagingSenderId: "928082473485",
  appId: "1:928082473485:web:cbbde89d57c657f52a9b44",
  measurementId: "G-MX7PF4VTLC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);

// Initialize Firestore with offline persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});