// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [userStates, setUserStates] = useState([]);
    const [userLocalities, setUserLocalities] = useState([]); // --- ADDED ---
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                setUser(user);
                if (userSnap.exists()) {
                    const data = userSnap.data(); // --- Get data object
                    setUserStates(data.assignedState ? [data.assignedState] : []);
                    setUserLocalities(data.assignedLocality ? [data.assignedLocality] : []); // --- ADDED ---
                } else {
                    setUserStates([]);
                    setUserLocalities([]); // --- ADDED ---
                }
            } else {
                setUser(null);
                setUserStates([]);
                setUserLocalities([]); // --- ADDED ---
            }
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    return { user, userStates, userLocalities, authLoading }; // --- UPDATED ---
};