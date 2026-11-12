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

let lastAvailability = null;
// True when the phone has a fingerprint (or face) enrolled.
export async function fingerprintReady() {
  if (!fingerprintSupported()) return false;
  try {
    const res = await (await plugin()).isAvailable({ useFallback: false });
    lastAvailability = res || null;
    return !!res?.isAvailable;
  } catch (err) {
    lastAvailability = { isAvailable: false, error: String(err?.message || err) };
    return false;
  }
}

// What happened the last time this phone tried to keep the sign-in, shown on
// the sign-in screen so a missing fingerprint button can be explained.
const STATUS_KEY = 'fp_signin_status';
function setStatus(state, detail = '') {
  try { localStorage.setItem(STATUS_KEY, JSON.stringify({ state, detail: String(detail).slice(0, 200), at: new Date().toISOString() })); } catch { /* storage blocked */ }
}
function readStatus() {
  try { return JSON.parse(localStorage.getItem(STATUS_KEY) || 'null'); } catch { return null; }
}

// A copy kept in the app's own storage, used when the phone's key store
// refuses to save (some phones' key stores fail on long values). Firebase
// keeps the same session in this storage anyway; the fingerprint is still
// asked before it is used.
const LOCAL_COPY = 'fp_signin_copy';
function readLocalCopy() {
  try {
    const copy = JSON.parse(localStorage.getItem(LOCAL_COPY) || 'null');
    return copy && isUsableSession(copy.session) && copy.account?.uid === copy.session.uid ? copy : null;
  } catch { return null; }
}

let reportedSaveError = false;
function reportSaveError(message) {
  if (reportedSaveError) return;
  reportedSaveError = true;
  import('../data').then(({ submitProblemReport }) => submitProblemReport({
    kind: 'permission',
    what: `Fingerprint sign-in could not be saved: ${message}`.slice(0, 300),
    context: 'fingerprint-signin',
    source: 'fingerprintSignIn.js',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 300) : null,
    appVersion: typeof window !== 'undefined' ? window.__APP_VERSION__ || null : null,
  })).catch(() => { /* best effort */ });
}

// Why the fingerprint button is or is not on the sign-in screen:
// 'on', 'old_apk', 'no_fingerprint', 'not_yet' (no sign-in kept yet) or
// 'web'. `detail` carries the phone's own reason when there is one.
export async function fingerprintStatus() {
  if (!Capacitor.isNativePlatform()) return { state: 'web' };
  if (!fingerprintSupported()) return { state: 'old_apk' };
  if (!(await fingerprintReady())) {
    return { state: 'no_fingerprint', detail: lastAvailability?.errorCode ?? lastAvailability?.error ?? '' };
  }
  if (await savedFingerprintAccount()) return { state: 'on' };
  const last = readStatus();
  return { state: 'not_yet', detail: last?.state === 'save_failed' ? last.detail : '' };
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
  if (!(await fingerprintReady())) {
    setStatus('no_fingerprint', lastAvailability?.errorCode ?? lastAvailability?.error ?? '');
    return;
  }
  const account = { uid: json.uid, email: user.email || '', name: user.displayName || '' };
  try {
    const NB = await plugin();
    await NB.setCredentials({
      server: SERVER,
      username: JSON.stringify(account),
      password: JSON.stringify(json),
    });
    try { localStorage.removeItem(LOCAL_COPY); } catch { /* storage blocked */ }
    savedFor = fingerprint;
    setStatus('on', 'keystore');
  } catch (err) {
    const message = String(err?.message || err);
    console.warn('[Fingerprint] Key store refused the sign-in, keeping it in app storage:', message);
    try {
      localStorage.setItem(LOCAL_COPY, JSON.stringify({ account, session: json }));
      savedFor = fingerprint;
      setStatus('on', `app storage (${message})`);
    } catch (err2) {
      setStatus('save_failed', `${message}; ${err2?.message || err2}`);
    }
    reportSaveError(message);
  }
}

// The account saved on this phone ({ uid, email, name }), or null. Reading
// it does not need a fingerprint; using it does.
export async function savedFingerprintAccount() {
  if (!fingerprintSupported()) return null;
  try {
    if (!(await fingerprintReady())) return null;
    const NB = await plugin();
    const { isSaved } = await NB.isCredentialsSaved({ server: SERVER });
    if (isSaved) {
      const { username } = await NB.getCredentials({ server: SERVER });
      const account = JSON.parse(username || 'null');
      if (account?.uid) return account;
    }
  } catch { /* fall back to the app-storage copy */ }
  return readLocalCopy()?.account || null;
}

export async function forgetFingerprintAccount() {
  savedFor = null;
  try { localStorage.removeItem(LOCAL_COPY); } catch { /* storage blocked */ }
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
    let json = null;
    let account = null;
    try {
      const { username, password } = await NB.getCredentials({ server: SERVER });
      json = JSON.parse(password || 'null');
      account = JSON.parse(username || 'null');
    } catch { /* not in the key store: try the app-storage copy */ }
    if (!isUsableSession(json)) {
      const copy = readLocalCopy();
      if (copy) { json = copy.session; account = copy.account; }
    }
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
