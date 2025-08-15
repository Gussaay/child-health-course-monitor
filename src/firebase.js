// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDRZoNR9e1AnE9RyqPZ-eXYbHkWOUJmoyI", // Use your actual config
  authDomain: "imnci-courses-monitor.firebaseapp.com",
  projectId: "imnci-courses-monitor",
  storageBucket: "imnci-courses-monitor.firebaseapp.com",
  messagingSenderId: "928082473485",
  appId: "1:928082473485:web:cbbde89d57c657f52a9b44",
  measurementId: "G-MX7PF4VTLC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);