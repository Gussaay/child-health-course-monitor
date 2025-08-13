import React, { useState } from 'react';
import { auth, signInWithGooglePopup } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

export function SignInBox() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, pw);
      else await createUserWithEmailAndPassword(auth, email, pw);
    } catch (e) { setErr(e.message || String(e)); }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 mt-10">
      <h2 className="text-xl font-bold mb-3">Sign in to IMCI Monitor</h2>
      {err && <div className="p-2 mb-3 rounded bg-red-50 text-red-700 text-sm">{err}</div>}
      <form className="grid gap-3" onSubmit={submit}>
        <input className="border rounded-lg p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded-lg p-2" placeholder="Password" type="password" value={pw} onChange={e=>setPw(e.target.value)} />
        <button className="px-4 py-2 rounded-xl bg-blue-600 text-white"> {mode==='login'?'Sign in':'Create account'} </button>
        <button type="button" className="px-4 py-2 rounded-xl border" onClick={()=>setMode(mode==='login'?'register':'login')}>
          {mode==='login'?'Need an account? Register':'Have an account? Sign in'}
        </button>
      </form>
      <div className="my-3 text-center text-sm text-gray-500">or</div>
      <button className="w-full px-4 py-2 rounded-xl border" onClick={signInWithGooglePopup}>Continue with Google</button>
    </div>
  );
}

export function UserBadge({ user }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm"><b>{user.email}</b></div>
      <button className="px-3 py-1 rounded-lg border" onClick={()=>signOut(auth)}>Sign out</button>
    </div>
  );
}
