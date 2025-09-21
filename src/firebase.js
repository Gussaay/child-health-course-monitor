// firebase.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage"; // Import the storage service

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbIZPGWOb7s0DyJFaXcV_0hQsMwTZZRKU",
  authDomain: "imnci-courses-monitor.firebaseapp.com",
  projectId: "imnci-courses-monitor",
  storageBucket: "gs://imnci-courses-monitor.firebasestorage.app",
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
export const storage = getStorage(app); // Initialize and export the storage instance

// ENABLE OFFLINE DATA PERSISTENCE
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Firestore persistence failed: can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        console.error("Firestore persistence is not available in this browser environment.");
    }
  });