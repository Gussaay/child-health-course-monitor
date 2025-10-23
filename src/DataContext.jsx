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
    
    listPendingFacilitatorSubmissions,
    getFacilitatorApplicationSettings,
    
    listPendingFederalSubmissions,
    listPendingCoordinatorSubmissions,
    listPendingLocalitySubmissions,
    getCoordinatorApplicationSettings

} from './data';
import { useAuth } from './hooks/useAuth';

const DataCacheContext = createContext();

export const useDataCache = () => useContext(DataCacheContext);

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [cache, setCache] = useState({
        // --- START OF FIX: Initialize all array caches to null ---
        courses: null,
        participants: null, 
        facilitators: null,
        funders: null,
        federalCoordinators: null,
        stateCoordinators: null,
        localityCoordinators: null,
        healthFacilities: null,
        
        pendingFacilitatorSubmissions: null,
        facilitatorApplicationSettings: { isActive: false, openCount: 0 },
        
        pendingFederalSubmissions: null,
        pendingStateSubmissions: null,
        pendingLocalitySubmissions: null,
        coordinatorApplicationSettings: { isActive: false, openCount: 0 },
        // --- END OF FIX ---
    });

    const [isLoading, setIsLoading] = useState({
        courses: true,
        participants: true,
        facilitators: true,
        healthFacilities: true,
        
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
    });
    
    const cacheRef = useRef(cache);
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    const createFetcher = useCallback((key, fetchFn) => {
        return async (force = false) => {
            const currentCache = cacheRef.current[key];
            
            // --- START OF FIX: Check for null, not length ---
            // We consider data "cached" if it's not null (even if it's an empty array)
            const hasData = currentCache !== null;
            // --- END OF FIX ---
            
            const isDefaultSettings = (key.includes('Settings') && currentCache?.openCount === 0);

            if (hasData && !force && !isDefaultSettings) {
                setIsLoading(prev => ({ ...prev, [key]: false }));
                return currentCache;
            }

            setIsLoading(prev => ({ ...prev, [key]: true }));
            try {
                const data = await fetchFn(); 
                setCache(prev => ({ ...prev, [key]: data }));
                return data;
            } catch (error) {
                console.error(`Failed to fetch ${key}:`, error);
                
                // --- START OF FIX: On error, set to an empty array or default object ---
                // This prevents re-fetching on every tab switch after a failure
                const defaultEmpty = key.includes('Settings') 
                    ? { isActive: false, openCount: 0 } 
                    : [];
                setCache(prev => ({ ...prev, [key]: defaultEmpty }));
                return defaultEmpty;
                // --- END OF FIX ---
            } finally {
                setIsLoading(prev => ({ ...prev, [key]: false }));
            }
        };
    }, []); // Empty array is correct

    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', listAllCourses),
        fetchParticipants: createFetcher('participants', listAllParticipants),
        fetchFacilitators: createFetcher('facilitators', listFacilitators),
        fetchFunders: createFetcher('funders', listFunders),
        fetchFederalCoordinators: createFetcher('federalCoordinators', listFederalCoordinators),
        fetchStateCoordinators: createFetcher('stateCoordinators', listStateCoordinators),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', listLocalityCoordinators),
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities),

        fetchPendingFacilitatorSubmissions: createFetcher('pendingFacilitatorSubmissions', listPendingFacilitatorSubmissions),
        fetchFacilitatorApplicationSettings: createFetcher('facilitatorApplicationSettings', getFacilitatorApplicationSettings),

        fetchPendingFederalSubmissions: createFetcher('pendingFederalSubmissions', listPendingFederalSubmissions),
        fetchPendingStateSubmissions: createFetcher('pendingStateSubmissions', listPendingCoordinatorSubmissions),
        fetchPendingLocalitySubmissions: createFetcher('pendingLocalitySubmissions', listPendingLocalitySubmissions),
        fetchCoordinatorApplicationSettings: createFetcher('coordinatorApplicationSettings', getCoordinatorApplicationSettings),
    }), [createFetcher]);

    useEffect(() => {
        if (!user) {
            // Clear all cache on logout, reset to null
            setCache({
                courses: null, 
                participants: null,
                facilitators: null, 
                funders: null,
                federalCoordinators: null, 
                stateCoordinators: null, 
                localityCoordinators: null,
                healthFacilities: null,
                pendingFacilitatorSubmissions: null,
                facilitatorApplicationSettings: { isActive: false, openCount: 0 },
                pendingFederalSubmissions: null,
                pendingStateSubmissions: null,
                pendingLocalitySubmissions: null,
                coordinatorApplicationSettings: { isActive: false, openCount: 0 },
            });
            setIsLoading({
                courses: true,
                participants: true,
                facilitators: true,
                healthFacilities: true,
                pendingFacilitatorSubmissions: true,
                facilitatorApplicationSettings: true,
                pendingFederalSubmissions: true,
                pendingStateSubmissions: true,
                pendingLocalitySubmissions: true,
                coordinatorApplicationSettings: true,
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