// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// +++ IMPORT the offline persistence function +++
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbIZPGWOb7s0DyJFaXcV_0hQsMwTZZRKU",
  authDomain: "imnci-courses-monitor.firebaseapp.com",
  projectId: "imnci-courses-monitor",
  storageBucket: "imnci-courses-monitor.appspot.com",
  messagingSenderId: "928082473485",
  appId: "1:928082473485:web:cbbde89d57c657f52a9b44",
  measurementId: "G-MX7PF4VTLC"
};

export const app = initializeApp(firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

// +++ ENABLE OFFLINE DATA PERSISTENCE +++
// This one line enables the app to work offline by caching data.
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
        // This can happen if you have multiple tabs of the app open
        console.warn("Firestore persistence failed: can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
        // The browser is likely private or doesn't support the feature
        console.error("Firestore persistence is not available in this browser environment.");
    }
  });