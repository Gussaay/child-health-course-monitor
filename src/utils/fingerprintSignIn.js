// src/utils/fingerprintSignIn.js
// Fingerprint (or face) sign-in for the Android app.
//
// After anyone signs in once on the app, their sign-in is kept in the phone's
// secure key store (Android Keystore, through @capgo/capacitor-native-biometric).
// Nothing is asked: it is turned on for everyone whose phone has a fingerprint
// set up. When they later land on the sign-in screen (a lost session, or after
// Log out), one touch of the fingerprint signs them back in, without typing a
// password or going through Google.
//
// What is kept is Firebase's own saved session (user.toJSON(), the same record
// Firebase writes to localStorage), not the password, so it works the same for
// password and Google accounts. Signing back in writes that record back where
// Firebase looks for it and reloads; Firebase then refreshes the token as it
// does on any app start. A session the server no longer accepts (password
// changed, account disabled) ends in a normal sign-out, and the saved copy is
// then dropped (see takeFailedRestore).
//
// The web site and APKs built before this change (which get new code through
// live updates but lack the native plugin) skip all of this.
import { Capacitor } from '@capacitor/core';

const SERVER = 'com.nchp.monitoring.app.fingerprint-signin';
const RESTORING = 'fp_signin_restoring';

export function fingerprintSupported() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeBiometric');
  } catch {
    return false;
  }
}

let pluginPromise = null;
function plugin() {
  if (!pluginPromise) {
    pluginPromise = import('@capgo/capacitor-native-biometric').then((m) => m.NativeBiometric);
  }
  return pluginPromise;
}

// True when the phone has a fingerprint (or face) enrolled.
export async function fingerprintReady() {
  if (!fingerprintSupported()) return false;
  try {
    const res = await (await plugin()).isAvailable({ useFallback: false });
    return !!res?.isAvailable;
  } catch {
    return false;
  }
}

// The persisted Firebase record, checked before it is used.
export function isUsableSession(json) {
  return !!(json && typeof json === 'object'
    && typeof json.uid === 'string' && json.uid
    && typeof json.apiKey === 'string' && json.apiKey
    && typeof json.appName === 'string' && json.appName
    && json.stsTokenManager && typeof json.stsTokenManager.refreshToken === 'string'
    && json.stsTokenManager.refreshToken);
}

// The key Firebase reads the signed-in user from (browserLocalPersistence).
export function firebaseUserKey(json) {
  return `firebase:authUser:${json.apiKey}:${json.appName}`;
}

let savedFor = null;
// Called whenever someone is signed in on the app. Keeps the saved copy
// current (Firebase can hand out a new refresh token) and confirms that a
// fingerprint sign-in worked.
export async function rememberForFingerprint(user) {
  if (!user || !fingerprintSupported()) return;
  try {
    // The token was accepted, so a fingerprint sign-in that led here worked.
    await user.getIdToken();
    try { sessionStorage.removeItem(RESTORING); } catch { /* storage blocked */ }
  } catch {
    return; // offline or refused: keep what is saved, try again next start
  }
  const json = typeof user.toJSON === 'function' ? user.toJSON() : null;
  if (!isUsableSession(json)) return;
  const fingerprint = `${json.uid}:${json.stsTokenManager.refreshToken}`;
  if (savedFor === fingerprint) return;
  if (!(await fingerprintReady())) return;
  try {
    const NB = await plugin();
    await NB.setCredentials({
      server: SERVER,
      username: JSON.stringify({ uid: json.uid, email: user.email || '', name: user.displayName || '' }),
      password: JSON.stringify(json),
    });
    savedFor = fingerprint;
  } catch (err) {
    console.warn('[Fingerprint] Could not save sign-in:', err?.message || err);
  }
}

// The account saved on this phone ({ uid, email, name }), or null. Reading
// it does not need a fingerprint; using it does.
export async function savedFingerprintAccount() {
  if (!fingerprintSupported()) return null;
  try {
    const NB = await plugin();
    const { isSaved } = await NB.isCredentialsSaved({ server: SERVER });
    if (!isSaved) return null;
    if (!(await fingerprintReady())) return null;
    const { username } = await NB.getCredentials({ server: SERVER });
    const account = JSON.parse(username || 'null');
    return account?.uid ? account : null;
  } catch {
    return null;
  }
}

export async function forgetFingerprintAccount() {
  savedFor = null;
  if (!fingerprintSupported()) return;
  try { await (await plugin()).deleteCredentials({ server: SERVER }); } catch { /* nothing saved */ }
}

// Asks for the fingerprint, then signs in. Resolves 'ok' (the page is
// reloading), 'cancelled' or 'failed'.
export async function signInWithFingerprint({ title, subtitle, cancel } = {}) {
  if (!fingerprintSupported()) return 'failed';
  const NB = await plugin();
  try {
    await NB.verifyIdentity({
      reason: subtitle,
      title,
      subtitle,
      negativeButtonText: cancel,
      useFallback: false,
      maxAttempts: 5,
    });
  } catch {
    return 'cancelled';
  }
  try {
    const { username, password } = await NB.getCredentials({ server: SERVER });
    const json = JSON.parse(password || 'null');
    const account = JSON.parse(username || 'null');
    if (!isUsableSession(json) || account?.uid !== json.uid) return 'failed';
    localStorage.setItem(firebaseUserKey(json), JSON.stringify(json));
    localStorage.setItem('last_uid', json.uid);
    try { sessionStorage.setItem(RESTORING, json.uid); sessionStorage.removeItem('intentional_signout'); } catch { /* storage blocked */ }
    window.location.reload();
    return 'ok';
  } catch (err) {
    console.warn('[Fingerprint] Sign-in failed:', err?.message || err);
    return 'failed';
  }
}

// True once, when a fingerprint sign-in just led back to the sign-in screen
// (the server refused the saved session). The saved copy is dropped so the
// person signs in once normally and it is saved again.
export async function takeFailedRestore() {
  let failed = false;
  try {
    failed = !!sessionStorage.getItem(RESTORING);
    sessionStorage.removeItem(RESTORING);
  } catch { /* storage blocked */ }
  if (failed) await forgetFingerprintAccount();
  return failed;
}
