// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [userStates, setUserStates] = useState([]);
    const [userLocalities, setUserLocalities] = useState([]); 
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(null);
                setUserStates([]);
                setUserLocalities([]); 
                setAuthLoading(false);
                return;
            }

            setUser(firebaseUser); 
            // ⚡ CRITICAL FIX: Drop the Splash Screen IMMEDIATELY.
            // Do NOT wait for the network to fetch localities before letting the app boot.
            setAuthLoading(false); 

            // --- SILENT BACKGROUND FETCH ---
            const userRef = doc(db, "users", firebaseUser.uid);
            
            try {
                // 1. Try cache first for instant data population
                try {
                    const cachedSnap = await getDoc(userRef, { source: 'cache' });
                    if (cachedSnap.exists()) {
                        const data = cachedSnap.data(); 
                        setUserStates(data.assignedState ? [data.assignedState] : []);
                        setUserLocalities(data.assignedLocality ? [data.assignedLocality] : []); 
                    }
                } catch(e) {}
                
                // 2. Try server for fresh data (happens invisibly in the background)
                const serverSnap = await getDoc(userRef, { source: 'server' });
                if (serverSnap.exists()) {
                    const data = serverSnap.data(); 
                    setUserStates(data.assignedState ? [data.assignedState] : []);
                    setUserLocalities(data.assignedLocality ? [data.assignedLocality] : []); 
                }
            } catch (error) {
                console.warn("[Auth] Background fetch failed (poor network). Keeping cached data.");
            }
        });
        
        return unsubscribe;
    }, []);

    return { user, userStates, userLocalities, authLoading }; 
};