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

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, authLoading: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const lastUid = localStorage.getItem('last_uid');

      if (firebaseUser) {
        localStorage.setItem('last_uid', firebaseUser.uid);
      } else if (lastUid && !sessionStorage.getItem('intentional_signout')) {
        // Diagnostic: the user was signed in before, and no signOut() was traced.
        console.warn('[Auth] Session lost without a sign-out. Stored login was cleared or rejected.');
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
