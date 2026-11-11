// src/hooks/useAuth.js
// One auth listener for the whole app, shared through context.
// Before, every component that called useAuth() started with user = null and
// its own listener, so for a moment some parts of the app "saw" a signed-out
// user. Any code that reacts to that null (redirect to login, signOut, clear
// data) logs the user out. The API is unchanged: const { user, authLoading } = useAuth();
import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

// A sign-out nobody asked for, noted on this device and reported to
// Admin > Problems once the person is signed in again.
const LOST_KEY = 'auth_session_lost';
let reportingLost = false;
function reportLostSession() {
  if (reportingLost) return;
  let lost = null;
  try { lost = JSON.parse(localStorage.getItem(LOST_KEY) || 'null'); } catch { return; }
  if (!lost) return;
  reportingLost = true;
  // The note is removed only once the report is saved, so a failed write is retried at the next sign-in.
  import('../data').then(({ submitProblemReport }) => submitProblemReport({
    kind: 'permission',
    what: `Signed out without pressing Log out (at ${lost.at}, ${lost.online ? 'online' : 'offline'}${lost.uid ? `, previous account ${lost.uid}` : ''})`,
    context: 'session-lost',
    source: 'useAuth.js',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 300) : null,
    appVersion: typeof window !== 'undefined' ? window.__APP_VERSION__ || null : null,
    reporterEmail: auth.currentUser?.email || null,
  })).then(() => {
    try { localStorage.removeItem(LOST_KEY); } catch { /* storage blocked */ }
  }).catch(() => { /* kept for the next sign-in */ }).finally(() => { reportingLost = false; });
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, authLoading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const lastUid = localStorage.getItem('last_uid');

      if (firebaseUser) {
        localStorage.setItem('last_uid', firebaseUser.uid);
        try { sessionStorage.removeItem('intentional_signout'); } catch { /* storage blocked */ }
        reportLostSession();
      } else if (lastUid && !sessionStorage.getItem('intentional_signout')) {
        // Diagnostic: the user was signed in before, and no signOut() was traced.
        console.warn('[Auth] Session lost without a sign-out. Stored login was cleared or rejected.');
        // Kept until the next sign-in, when it can be sent to Admin > Problems
        // (a signed-out device cannot write a report).
        try {
          localStorage.setItem(LOST_KEY, JSON.stringify({ at: new Date().toISOString(), uid: lastUid, online: navigator.onLine }));
        } catch { /* storage full or blocked */ }
      }

      setState({ user: firebaseUser || null, authLoading: false });
    });
    return unsubscribe;
  }, []);

  return createElement(AuthContext.Provider, { value: state }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}

// Use this in your logout button instead of calling signOut(auth) directly,
// so the diagnostic above can tell real logouts from lost sessions.
export async function logout() {
  sessionStorage.setItem('intentional_signout', '1');
  localStorage.removeItem('last_uid');
  await auth.signOut();
}
