import React, { useState } from 'react';

import { 
  GoogleAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

import { auth } from './firebase.js';

// --- Sign-In and Sign-Up Component ---
export function SignInBox() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // --- New state for account linking ---
  // This will hold the password the user wants to link
  const [passwordToLink, setPasswordToLink] = useState('');
  // This flag tells the Google sign-in to perform the link
  const [isLinkingPassword, setIsLinkingPassword] = useState(false);


  const handleEmailPasswordAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Clear any pending link
    setIsLinkingPassword(false);
    setPasswordToLink('');
    
    if (!email) {
      setError("Please enter an email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      // 1. **FIRST ATTEMPT TO SIGN IN**
      try {
        await signInWithEmailAndPassword(auth, email, password);
        // If successful, the user is signed in.
        return; 
      } catch (signInError) {
        // Sign-in failed. Proceed to check methods to provide a clear error/action.
        // The specific error (e.g., 'wrong-password') will be handled below if the method is 'password'.
        console.error("Initial Sign-in Attempt Failed:", signInError);
      }
      
      // 2. Check what sign-in methods exist for this email after sign-in failed
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length === 0) {
        // 3. Case 1: Brand new user. Show message to sign up.
        setError("Account not found. Click 'Sign In / Sign Up' again to create a new account.");
        // --- OPTIONAL: To automatically create the account, uncomment the block below:
        /*
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (signUpError) {
          setError(signUpError.message);
          console.error("Sign-up Error:", signUpError);
        }
        */
      } else if (methods.includes('password')) {
        // 4. Case 2: Email/Password account exists, but the sign-in failed (wrong password/user-not-found, etc.)
        // Since we already attempted sign-in, this indicates a wrong credential.
        setError("Invalid credentials. Please try again or use 'Forgot Password?'.");

      } else if (methods.includes('google.com')) {
        // 5. Case 3: This is a Google user. Start the linking flow.
        setError("This email is registered with Google. Please sign in with Google to link this password to your account.");
        // Save the password and set the flag
        setPasswordToLink(password);
        setIsLinkingPassword(true);
      } else {
        // 6. Case 4: Other provider (e.g., Facebook, etc.)
        setError(`This email is registered with ${methods.join(', ')}. Please use that method to sign in.`);
      }

    } catch (fetchError) {
      // Handle errors from fetchSignInMethodsForEmail (e.g., invalid-email)
      setError(fetchError.message);
      console.error("Fetch Methods Error:", fetchError);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(err.message);
      console.error("Password Reset Error:", err);
    }
  };

  const signInWithGoogle = () => {
    setError('');
    setMessage('');
    const provider = new GoogleAuthProvider();
    
    signInWithPopup(auth, provider)
      .then(async (result) => {
        // --- Check if we need to link a password ---
        if (isLinkingPassword && passwordToLink && result.user.email === email) {
          try {
            // Create an email/password credential with the saved password
            const credential = EmailAuthProvider.credential(result.user.email, passwordToLink);
            // Link it to the (now signed-in) Google user
            await linkWithCredential(result.user, credential);
            setMessage("Password successfully linked to your Google account!");
          } catch (linkError) {
            // Handle errors like 'auth/credential-already-in-use'
            if (linkError.code === 'auth/credential-already-in-use') {
              setError("This account is already linked to a password.");
            } else {
              setError(linkError.message);
            }
            console.error("Linking Error:", linkError);
          } finally {
            // Clear the linking state regardless of outcome
            setIsLinkingPassword(false);
            setPasswordToLink('');
          }
        }
        // --- End of linking logic ---
        
      })
      .catch((err) => {
        // Handle Google sign-in errors
        setError(err.message);
        console.error("Google Auth Error:", err);
        // Clear linking state if Google sign-in fails
        setIsLinkingPassword(false);
        setPasswordToLink('');
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Monitoring System</h1>
          <p className="mt-2 text-gray-600">Sign in or create an account</p>
        </div>

        <form className="space-y-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {/* --- Forgot Password Button --- */}
            <div className="text-right mt-2">
              <button 
                type="button" // Prevent form submission
                onClick={handlePasswordReset}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
              >
                Forgot Password?
              </button>
            </div>
          </div>


          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          
          <div className="flex">
            <button 
              onClick={handleEmailPasswordAuth} 
              className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-300"
            >
              Sign In / Sign Up
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-xs font-bold text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

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