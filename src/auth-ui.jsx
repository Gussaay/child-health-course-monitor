<<<<<<< HEAD
import React, { useState } from 'react';

// --- NEW: Import email/password auth methods ---
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

// Continue importing your initialized 'auth' object from your firebase.js file
import { auth } from './firebase.js';

// --- Sign-In and Sign-Up Component ---
export function SignInBox() {
  // --- NEW: State for form inputs and errors ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // --- NEW: Handler for Email/Password Sign-Up ---
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
      console.error("Sign-up Error:", err);
    }
  };
  
  // --- NEW: Handler for Email/Password Sign-In ---
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
      console.error("Sign-in Error:", err);
    }
  };

  // Handler for Google Sign-In (unchanged)
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .catch((err) => {
        setError(err.message);
        console.error("Google Auth Error:", err);
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Monitoring System</h1>
          <p className="mt-2 text-gray-600">Sign in or create an account</p>
        </div>

        {/* --- NEW: Email and Password Form --- */}
        <form className="space-y-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          {/* Display any authentication errors */}
          {error && <p className="text-sm text-red-600">{error}</p>}
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={handleSignIn} className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-300">Sign In</button>
            <button onClick={handleSignUp} className="w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition duration-300">Sign Up</button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center justify-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-xs font-bold text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Google Sign-In Button */}
        <button 
          onClick={signInWithGoogle}
          className="flex items-center justify-center w-full gap-3 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md"
        >
          <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.902,35.619,44,29.89,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// --- User Display & Sign-Out Button (Unchanged) ---
export function UserBadge({ user }) {
  const signOut = () => {
    auth.signOut();
  };
  
  // Handles users who signed up with email and don't have a display name or photo
  const displayName = user.displayName || user.email;
  const photoURL = user.photoURL;

  return (
    <div className="flex items-center gap-4 bg-white p-2 rounded-full shadow">
      {photoURL ? (
        <img src={photoURL} alt="User" className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
          {displayName?.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-semibold text-gray-800 hidden md:block">{displayName}</span>
      <button 
        onClick={signOut}
        className="bg-red-500 text-white text-xs font-semibold py-1 px-3 rounded-full hover:bg-red-600 transition"
      >
        Sign Out
      </button>
    </div>
  );
}
=======
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
>>>>>>> 2721d1f7321ee81f1f040962e0f5c156b71ac7cb
