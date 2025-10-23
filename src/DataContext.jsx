// DataContext.jsx
import React, { useState, createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
    listAllCourses,
    listAllParticipants,
    listFacilitators, 
    listFunders, 
    listFederalCoordinators, 
    listStateCoordinators, 
    listLocalityCoordinators,
    listHealthFacilities,
    
    // --- START OF FIX: Import missing data functions ---
    // (Assuming these are the function names from your data.js)
    listPendingFacilitatorSubmissions,
    getFacilitatorApplicationSettings,
    
    listPendingFederalSubmissions,
    listPendingStateSubmissions,
    listPendingLocalitySubmissions,
    getCoordinatorApplicationSettings
    // --- END OF FIX ---

} from './data';
import { useAuth } from './hooks/useAuth';

const DataCacheContext = createContext();

export const useDataCache = () => useContext(DataCacheContext);

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [cache, setCache] = useState({
        courses: [],
        participants: [], 
        facilitators: [],
        funders: [],
        federalCoordinators: [],
        stateCoordinators: [],
        localityCoordinators: [],
        healthFacilities: [],
        
        // --- START OF FIX: Add new cache properties ---
        pendingFacilitatorSubmissions: [],
        facilitatorApplicationSettings: { isActive: false, openCount: 0 },
        
        pendingFederalSubmissions: [],
        pendingStateSubmissions: [],
        pendingLocalitySubmissions: [],
        coordinatorApplicationSettings: { isActive: false, openCount: 0 },
        // --- END OF FIX ---
    });

    const [isLoading, setIsLoading] = useState({
        courses: true,
        participants: true,
        facilitators: true,
        healthFacilities: true,
        
        // --- START OF FIX: Add loading states for new properties ---
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
        // --- END OF FIX ---
    });
    
    const cacheRef = useRef(cache);
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    const createFetcher = useCallback((key, fetchFn) => {
        return async (force = false) => {
            const currentCache = cacheRef.current[key];
            
            // --- MODIFIED: Improved check for both arrays and objects ---
            const hasData = Array.isArray(currentCache) 
                ? currentCache.length > 0 
                : (currentCache instanceof Map ? currentCache.size > 0 : (typeof currentCache === 'object' && currentCache !== null ? Object.keys(currentCache).length > 0 : false));
            
            // For settings objects, we want to fetch them if they are in their default state
            const isDefaultSettings = (key.includes('Settings') && currentCache.openCount === 0);

            if (hasData && !force && !isDefaultSettings) {
                setIsLoading(prev => ({ ...prev, [key]: false }));
                return currentCache;
            }
            // --- END MODIFICATION ---

            setIsLoading(prev => ({ ...prev, [key]: true }));
            try {
                const data = await fetchFn(); 
                setCache(prev => ({ ...prev, [key]: data }));
                return data;
            } catch (error) {
                console.error(`Failed to fetch ${key}:`, error);
                // --- MODIFIED: Return appropriate empty type ---
                if (Array.isArray(currentCache)) return [];
                if (currentCache instanceof Map) return new Map();
                if (typeof currentCache === 'object' && currentCache !== null) return {};
                return undefined;
            } finally {
                setIsLoading(prev => ({ ...prev, [key]: false }));
            }
        };
    }, []); 

    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', listAllCourses),
        fetchParticipants: createFetcher('participants', listAllParticipants),
        fetchFacilitators: createFetcher('facilitators', listFacilitators),
        fetchFunders: createFetcher('funders', listFunders),
        fetchFederalCoordinators: createFetcher('federalCoordinators', listFederalCoordinators),
        fetchStateCoordinators: createFetcher('stateCoordinators', listStateCoordinators),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', listLocalityCoordinators),
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities),

        // --- START OF FIX: Add new fetchers ---
        fetchPendingFacilitatorSubmissions: createFetcher('pendingFacilitatorSubmissions', listPendingFacilitatorSubmissions),
        fetchFacilitatorApplicationSettings: createFetcher('facilitatorApplicationSettings', getFacilitatorApplicationSettings),

        fetchPendingFederalSubmissions: createFetcher('pendingFederalSubmissions', listPendingFederalSubmissions),
        fetchPendingStateSubmissions: createFetcher('pendingStateSubmissions', listPendingStateSubmissions),
        fetchPendingLocalitySubmissions: createFetcher('pendingLocalitySubmissions', listPendingLocalitySubmissions),
        fetchCoordinatorApplicationSettings: createFetcher('coordinatorApplicationSettings', getCoordinatorApplicationSettings),
        // --- END OF FIX ---
    }), [createFetcher]);

    useEffect(() => {
        if (!user) {
            // Clear all cache on logout
            setCache({
                courses: [], 
                participants: [],
                facilitators: [], 
                funders: [],
                federalCoordinators: [], 
                stateCoordinators: [], 
                localityCoordinators: [],
                healthFacilities: [],
                // --- START OF FIX: Reset new cache properties ---
                pendingFacilitatorSubmissions: [],
                facilitatorApplicationSettings: { isActive: false, openCount: 0 },
                pendingFederalSubmissions: [],
                pendingStateSubmissions: [],
                pendingLocalitySubmissions: [],
                coordinatorApplicationSettings: { isActive: false, openCount: 0 },
                // --- END OF FIX ---
            });
            setIsLoading({
                courses: true,
                participants: true,
                facilitators: true,
                healthFacilities: true,
                // --- START OF FIX: Reset new loading states ---
                pendingFacilitatorSubmissions: true,
                facilitatorApplicationSettings: true,
                pendingFederalSubmissions: true,
                pendingStateSubmissions: true,
                pendingLocalitySubmissions: true,
                coordinatorApplicationSettings: true,
                // --- END OF FIX ---
            });
        }
    }, [user]); 


    const value = { 
        ...cache, 
        ...fetchers, 
        isLoading,
    };

    return (
        <DataCacheContext.Provider value={value}>
            {children}
        </DataCacheContext.Provider>
    );
};