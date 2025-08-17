import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult
} from "firebase/auth";
import { firebaseApp } from "./firebase";

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

function canUseSessionStorage() {
  try { sessionStorage.setItem("__t","1"); sessionStorage.removeItem("__t"); return true; }
  catch { return false; }
}

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = e && e.code;
    const popupBlocked = code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
    const topLevel = window.top === window.self;
    if (popupBlocked && topLevel && canUseSessionStorage()) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw e;
    }
  }
}

export function completeRedirect() {
  getRedirectResult(auth).catch(() => {});
}
