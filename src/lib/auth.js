import {
  getAuth, 
  GoogleAuthProvider,
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult
} from "firebase/auth";
import { firebaseApp } from "./firebase";
import { Capacitor } from '@capacitor/core';

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

function canUseSessionStorage() {
  try { 
    sessionStorage.setItem("__t","1"); 
    sessionStorage.removeItem("__t"); 
    return true; 
  }
  catch { 
    return false; 
  }
}

export async function signInWithGoogle() {
  // Never attempt web browser sign-ins on Native, Capgo handles it.
  if (Capacitor.isNativePlatform()) {
     throw new Error("Web login function called on a native device. Use SocialLogin instead.");
  }

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = e && e.code;
    const popupBlocked = code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
    const topLevel = window.top === window.self;
    
    // Only attempt Redirect flow if strictly on a standard web-browser.
    if (popupBlocked && topLevel && canUseSessionStorage()) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw e;
    }
  }
}

export function completeRedirect() {
  getRedirectResult(auth).catch((error) => {
      console.warn("Redirect result error handling:", error);
  });
}