// src/auth-gate.jsx
import React from 'react';
import { useAuth } from './hooks/useAuth';
import { SignInBox } from './auth-ui.jsx';

export default function AuthGate({ children }) {
  const { user, authLoading } = useAuth(); // shared listener, no duplicate

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) return <SignInBox />;

  return <main>{children}</main>;
}
