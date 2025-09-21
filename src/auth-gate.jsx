import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { SignInBox } from './auth-ui.jsx';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-600">Loading...</p></div>;
  }

  if (!user) {
    return <SignInBox />;
  }

  // If the user is logged in, simply render the child components (your main application)
  return (
    <div>
      <main>
        {children}
      </main>
    </div>
  );
}