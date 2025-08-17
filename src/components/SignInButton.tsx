// src/components/SignInButton.jsx
import React, { useState } from "react";
import { signInWithGoogle } from "../lib/auth";

export default function SignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onClick} disabled={loading}>
        {loading ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && <div role="alert" style={{ color: "crimson" }}>{error}</div>}
    </div>
  );
}
