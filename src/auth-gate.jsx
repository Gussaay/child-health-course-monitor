import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { SignInBox, UserBadge } from './auth-ui.jsx';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setReady(true); }), []);
  if (!ready) return <div className="p-6 text-gray-600">Loading…</div>;
  if (!user) return <SignInBox />;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-end p-3"><UserBadge user={user} /></div>
      {children}
    </div>
  );
}
