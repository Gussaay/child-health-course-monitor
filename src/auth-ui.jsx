import React, { useState, useEffect } from 'react';

import { 
  GoogleAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  updateProfile 
} from 'firebase/auth';

import { auth } from './firebase.js';

// --- Sign-In and Sign-Up Component ---
export function SignInBox() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // --- State: Loading indicator ---
  const [isLoading, setIsLoading] = useState(false);
  
  // --- State: To toggle between sign-in and sign-up ---
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [fullName, setFullName] = useState(''); // Also used for profile update

  // --- NEW STATE for missing full name prompt ---
  const [isMissingName, setIsMissingName] = useState(false);


  // --- Check auth state on initial component load ---
  useEffect(() => {
    const timer = setTimeout(() => {
        const user = auth.currentUser;
        if (user) {
            // User is already logged in when this component loaded.
            // Check if their name is missing.
            checkAndPromptForName(user, true); // Pass 'true' to skip success message
        }
    }, 100); 
    
    return () => clearTimeout(timer);
  }, []);


  // --- Helper to check and prompt for name ---
  const checkAndPromptForName = (user, skipSuccessMessage = false) => {
    // Check if displayName is missing, null, or only whitespace.
    const isNameMissing = !user || !user.displayName || user.displayName.trim().length === 0;

    if (isNameMissing) {
      setMessage("Welcome! Please enter your full name to complete your profile.");
      setIsMissingName(true);
      return true; // Name is missing
    }
    
    // If name is present, set a "redirecting" message and ensure we STAY loading.
    // App.jsx is about to unmount this component.
    if (!skipSuccessMessage) {
        setMessage("Sign in successful. Redirecting..."); // <-- NEW
        setIsLoading(true); // Ensure we stay in a loading state
    }
    
    setIsMissingName(false);
    return false; // Name is present
  };

  // --- *** MODIFIED HANDLER (THE FIX IS HERE) *** ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    setError('');

    if (!fullName) {
        setError("Please enter your full name before continuing.");
        return;
    }

    setIsLoading(true);
    setMessage("Updating profile..."); // Give immediate feedback

    try {
        await updateProfile(user, { displayName: fullName });
        // After successful profile update, auth.currentUser is updated.
        // App.jsx's 'user' state from useAuth is now stale.
        // We must force a reload of the app.
        
        setMessage("Profile updated! Redirecting...");
        
        // --- THE FIX ---
        // This forces App.jsx to re-mount. On re-mount, useAuth
        // will get the new auth.currentUser, isProfileIncomplete
        // will be false, and the main app will render.
        window.location.reload();
        
    } catch (err) {
        setError(err.message);
        console.error("Profile Update Error:", err);
        setIsLoading(false); // Stop loading ONLY on error.
    } 
    // --- 'finally' block removed ---
  };


  // --- Sign-Up Handler ---
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!fullName || !email || password.length < 6) {
      if (!fullName) setError("Please enter your full name.");
      else if (!email) setError("Please enter an email address.");
      else setError("Password must be at least 6 characters long.");
      return;
    }
    
    setIsLoading(true); // START loading

    try {
      // 1. Create the user
      await createUserWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser; // Use auth.currentUser after creation

      // 2. Update their profile with the full name
      await updateProfile(user, {
        displayName: fullName
      });

      // This will set the "Redirecting" message and keep loading
      checkAndPromptForName(user);

    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use. Please Sign In instead.");
        setIsSignUpMode(false);
      } else {
        setError(err.message);
      }
      console.error("Sign-up Error:", err);
      setIsLoading(false); // Stop loading on error
    } 
  };


  // --- handleSignIn function ---
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsMissingName(false); // Reset name prompt state
    
    if (!email) {
      setError("Please enter an email address.");
      return;
    }
    
    // --- Step 1: Automatic Google Sign-In for blank password ---
    if (!password) {
        console.log(`[DEBUG] No password entered. Attempting immediate Google sign-in...`);
        setMessage("Checking account type and signing you in...");
        signInWithGoogle(); // Call with no arguments (no linking)
        return;
    }
    
    setIsLoading(true); // START loading (for non-Google sign-in path)

    // --- Step 2: Check for sign-in methods ---
    let methods;
    try {
        console.log(`[DEBUG] Fetching methods for: ${email}`);
        methods = await fetchSignInMethodsForEmail(auth, email);
        console.log(`[DEBUG] Sign-in methods found:`, methods);
    } catch (err) {
        setError(err.message);
        console.error("Fetch Methods Error:", err);
        setIsLoading(false); // END loading on error
        return;
    }
    
    // --- CORE FIX: If NO methods exist, it must be a Sign Up ---
    if (methods.length === 0) { 
        setError("Account not found. Please Sign Up to create a new account.");
        setPassword(''); 
        setIsSignUpMode(true);
        setIsLoading(false); // END loading when switching mode
        return;
    }

    // --- Step 3: Attempt Email/Password sign-in FIRST (Crucial for linking) ---
    if (methods.includes('password')) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            setPassword(''); 

            // Check for missing full name and prompt/Welcome with name
            if (checkAndPromptForName(userCredential.user)) {
                // Name is missing. checkAndPromptForName set the state.
                // We need to stop loading so they can type their name.
                setIsLoading(false);
                return; 
            }
            
            // If we get here, name is PRESENT.
            // checkAndPromptForName set the "Redirecting" message.
            // We must NOT stop loading.
            return; // Keep loading, wait for unmount.

        } catch (err) {
            
            // 1. AUTOMATIC GOOGLE SIGN-IN & LINKING TRIGGER (on WRONG PASSWORD + Google method available)
            if (err.code === 'auth/wrong-password' && methods.includes('google.com')) {
                setMessage("Sign-in failed with password. Retrying with Google to complete sign-in and link your password...");
                const passwordToAttemptLink = password; // Capture password
                setPassword(''); 
                signInWithGoogle(passwordToAttemptLink); // Pass password as argument
                return;
            } 
            
            // 2. Original LINKING LOGIC (on different credential error)
            if (err.code === 'auth/account-exists-with-different-credential' && methods.includes('google.com')) {
                setMessage("This account is registered with Google. Retrying with Google to link this password...");
                const passwordToAttemptLink = password; // Capture password
                setPassword(''); 
                signInWithGoogle(passwordToAttemptLink); // Pass password as argument
                return;
            } 
            
            // 3. Handle wrong password failure (for pure email/password accounts)
            if (err.code === 'auth/wrong-password') {
                setError("Invalid credentials. Please try again or use 'Forgot Password?'.");
            } else {
                setError(err.message);
            }
            console.error("Password Sign In Error:", err);
            setIsLoading(false); // END loading on error
            return;
        }
    }
    
    // --- Step 4 (NEW): Handle Google-only account if password sign-in method was NOT present ---
    if (methods.includes('google.com')) {
        
        if (password) {
            console.log("[DEBUG] Google-only account. User provided password. Setting up for linking...");
            setMessage("This email is registered with Google. Please sign in with Google to link this new password to your account.");
            const passwordToAttemptLink = password; // Capture password
            setPassword(''); // Clear the input field
            signInWithGoogle(passwordToAttemptLink); // Pass password as argument
            return;

        } else {
            setPassword('');
            setMessage("This email is registered with Google. Signing you in with Google...");
            signInWithGoogle(); // Call with no arguments
            return;
        }
    }

    // Case 5: Other provider (e.g., Facebook, etc.)
    setError(`This email is registered with ${methods.join(', ')}. Please use that method to sign in.`);
    setIsLoading(false); // END loading on error/final message
  };


  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }
    
    setIsLoading(true); // START loading

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(err.message);
      console.error("Password Reset Error:", err);
    } finally {
        setIsLoading(false); // END loading
    }
  };

  
  // --- signInWithGoogle function ---
  const signInWithGoogle = (passwordToAttemptLink = null) => {
    if (!passwordToAttemptLink) {
      setError('');
      setMessage('');
    }
    
    setIsLoading(true); // START loading (Google sign-in)
    setIsMissingName(false); // Reset name prompt state

    const provider = new GoogleAuthProvider();
    
    signInWithPopup(auth, provider)
      .then(async (result) => {
        
        let user = result.user;

        // --- Linking logic (must happen first) ---
        if (passwordToAttemptLink && user.email === email) {
          try {
            console.log("[DEBUG] Google sign-in successful. Attempting to link password...");
            const credential = EmailAuthProvider.credential(user.email, passwordToAttemptLink);
            await linkWithCredential(user, credential);
            setMessage("Password successfully linked! Redirecting..."); // <-- MODIFIED Message
            setError(''); 
            user = auth.currentUser; // Get the latest user object after linking
            console.log("[DEBUG] Password linking successful.");
          } catch (linkError) {
            if (linkError.code === 'auth/credential-already-in-use') {
              setError("This account is already linked to a password.");
            } else {
              setError(linkError.message);
            }
            console.error("Linking Error:", linkError);
            setIsLoading(false); // Stop loading on LINK error
          } finally {
            setPassword(''); 
          }
        }
        
        // --- Check for missing full name and prompt/Welcome with name ---
        if (checkAndPromptForName(user)) {
            // Name is missing, so we must stop loading
            setIsLoading(false);
            return; // Wait for profile update
        }
        
        // If we reach here, linking is done/not needed AND name is present.
        // checkAndPromptForName has set the "Redirecting" message
        // and isLoading is still true. We just wait for unmount.
        
      })
      .catch((err) => {
        setError(err.message);
        console.error("Google Auth Error:", err);
        setIsMissingName(false); // Ensure error resets the name prompt
        setIsLoading(false); // Stop loading on auth error
      })
      .finally(() => {
          // Only stop loading IF we are being prompted to enter a name.
          if (isMissingName) {
              setIsLoading(false);
          }
      });
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    setError('');
    setMessage('');
    setIsLoading(false);
    setIsMissingName(false); // Reset
    setFullName(''); // Reset
  };

  // --- RENDER LOGIC: Profile Update Prompt (Priority 1) ---
  if (isMissingName) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl text-center">
            <h1 className="text-3xl font-bold text-gray-800">Complete Your Profile</h1>
            <p className="mt-2 text-gray-600">Please enter your full name to continue.</p>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <form className="space-y-4" onSubmit={handleUpdateProfile}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
              <button
                type="submit"
                className="w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition duration-300 disabled:bg-gray-400"
                disabled={isLoading}
              >
                {isLoading ? (message ? message : 'Updating Profile...') : 'Save and Continue'}
              </button>
            </form>
          </div>
        </div>
    );
  }

  // --- RENDER LOGIC: Original Sign-In/Sign-Up Form (Priority 2) ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Monitoring System</h1>
          <p className="mt-2 text-gray-600">
            {isSignUpMode ? "Create a new account" : "Sign in to your account"}
          </p>
        </div>

        <form className="space-y-4">
          {/* --- Input Fields (Disabled while loading) --- */}
          {isSignUpMode && (
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          )}

          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
          <div>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password ()"
              className="w-full px-4 py-2 text-gray-700 bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={isSignUpMode}
              disabled={isLoading}
            />
            
            {/* --- Forgot Password (Disabled while loading) --- */}
            {!isSignUpMode && (
              <div className="text-right mt-2">
                <button 
                  type="button" 
                  onClick={handlePasswordReset}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none disabled:opacity-50"
                  disabled={isLoading} 
                >
                  {isLoading ? 'Processing...' : 'Forgot Password?'}
                </button>
              </div>
            )}
          </div>


          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}
          
          {/* --- Sign-In / Sign-Up Buttons with Loading State --- */}
          <div className="flex">
            {isSignUpMode ? (
              <button 
                onClick={handleSignUp} 
                className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-300 disabled:bg-gray-400"
                disabled={isLoading} 
              >
                {isLoading ? (message ? message : 'Creating Account...') : 'Sign Up'}
              </button>
            ) : (
              <button 
                onClick={handleSignIn} 
                className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition duration-300 disabled:bg-gray-400"
                disabled={isLoading} 
              >
                {isLoading ? (message ? message : 'Signing In...') : 'Sign In'}
              </button>
            )}
          </div>
        </form>

        {/* --- Toggle Button (Disabled while loading) --- */}
        <div className="text-sm text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="focus:outline-none disabled:opacity-50"
            disabled={isLoading} 
          >
            {isSignUpMode 
              ? <span className="font-medium text-indigo-600 hover:text-indigo-500">Already have an account? Sign In</span> 
              : <span className="font-bold text-red-600">if this your first time, please sign up</span>}
          </button>
        </div>


        {/* --- THIS IS THE FIX --- */}
        <div className="flex items-center justify-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 text-xs font-bold text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div> 
        {/* --- END OF FIX --- */}
        
        {/* --- Google Sign-In Button (Disabled while loading) --- */}
        <button 
          onClick={() => signInWithGoogle()} // Explicitly call with no args
          className="flex items-center justify-center w-full gap-3 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md disabled:bg-gray-400"
          disabled={isLoading} 
        >
          <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19-5.238C39.902,35.619,44,29.89,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
          {isLoading ? (message ? message : 'Processing...') : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}