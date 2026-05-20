// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Network } from '@capacitor/network';
import { auth, db } from '../firebase';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [userStates, setUserStates] = useState([]);
    const [userLocalities, setUserLocalities] = useState([]); 
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Check network status to prevent the app from hanging if offline
                    const status = await Network.getStatus();
                    const isOffline = !status.connected;
                    
                    const userRef = doc(db, "users", firebaseUser.uid);
                    let userSnap;

                    try {
                        // If offline, force cache. If online, try server.
                        const sourceOptions = isOffline ? { source: 'cache' } : {};
                        userSnap = await getDoc(userRef, sourceOptions);
                    } catch (e) {
                        // If the server request fails (e.g., spotty connection), aggressively fallback to cache
                        console.warn("[Auth] Network fetch failed, falling back to local cache.");
                        userSnap = await getDoc(userRef, { source: 'cache' });
                    }

                    setUser(firebaseUser); // Set the base user immediately

                    if (userSnap && userSnap.exists()) {
                        const data = userSnap.data(); 
                        setUserStates(data.assignedState ? [data.assignedState] : []);
                        setUserLocalities(data.assignedLocality ? [data.assignedLocality] : []); 
                    } else {
                        setUserStates([]);
                        setUserLocalities([]); 
                    }
                } catch (error) {
                    console.error("[Auth] Critical error fetching user profile:", error);
                    // Ensure we still unlock the app even if the profile metadata fails entirely
                    setUser(firebaseUser); 
                    setUserStates([]);
                    setUserLocalities([]);
                }
            } else {
                setUser(null);
                setUserStates([]);
                setUserLocalities([]); 
            }
            
            // Unconditionally clear the loading state so the app actually boots
            setAuthLoading(false);
        });
        
        return unsubscribe;
    }, []);

    return { user, userStates, userLocalities, authLoading }; 
};