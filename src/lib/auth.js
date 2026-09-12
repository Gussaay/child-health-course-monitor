// src/auth.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth } from './firebase'; // reuse the ONE auth instance (was: getAuth(firebaseApp) with an undefined import)

export { auth };
export const googleProvider = new GoogleAuthProvider();

function canUseSessionStorage() {
  try {
    sessionStorage.setItem('__t', '1');
    sessionStorage.removeItem('__t');
    return true;
  } catch {
    return false;
  }
}

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    throw new Error('Web login function called on a native device. Use SocialLogin instead.');
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = e?.code;
    const popupBlocked =
      code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment';
    const topLevel = window.top === window.self;

    if (popupBlocked && topLevel && canUseSessionStorage()) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw e;
    }
  }
}

export function completeRedirect() {
  if (Capacitor.isNativePlatform()) return;
  getRedirectResult(auth).catch((error) => {
    console.warn('Redirect result error:', error);
  });
}
