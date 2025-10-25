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
    listHealthFacilities, // Now supports incremental fetch
    
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
    
    // Tracks the last successful fetch time for health facilities to enable incremental updates
    const [lastFacilitiesFetchTime, setLastFacilitiesFetchTime] = useState(0); 
    
    const cacheRef = useRef(cache);
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    const createFetcher = useCallback((key, fetchFn) => {
        
        // Custom fetcher for Health Facilities with incremental logic
        if (key === 'healthFacilities') {
             // 'incremental' flag is passed from the dashboard component
             return async (force = false, incremental = false) => { 
                const currentCache = cacheRef.current.healthFacilities;
                const hasData = currentCache !== null;

                let fetchPromise;
                let fetchTime = 0;
                
                // 1. Determine Fetch Type
                if (force || !hasData) {
                    // FULL FETCH (Initial load or forced button click)
                    fetchPromise = listHealthFacilities({}); // No timestamp filter
                    fetchTime = Date.now();
                } else if (incremental && lastFacilitiesFetchTime > 0) {
                    // INCREMENTAL FETCH (Periodic polling)
                    const lastUpdatedAfter = new Date(lastFacilitiesFetchTime);
                    fetchPromise = listHealthFacilities({ lastUpdatedAfter });
                    fetchTime = Date.now();
                } else {
                    // CACHE HIT (return existing data)
                    setIsLoading(prev => ({ ...prev, [key]: false }));
                    return currentCache;
                }

                setIsLoading(prev => ({ ...prev, [key]: true }));
                try {
                    const newData = await fetchPromise;
                    
                    let updatedData;
                    if (force || !hasData || !incremental) {
                        // Full fetch: replace cache completely
                        updatedData = newData; 
                    } else {
                        // Incremental fetch: merge the new/updated docs with existing cache
                        const facilityMap = new Map(currentCache.map(f => [f.id, f]));
                        newData.forEach(f => facilityMap.set(f.id, f)); // Overwrite or add
                        updatedData = Array.from(facilityMap.values());
                    }
                    
                    setCache(prev => ({ ...prev, [key]: updatedData }));
                    setLastFacilitiesFetchTime(fetchTime); // Update the timestamp only on success
                    
                    return updatedData;

                } catch (error) {
                    console.error(`Failed to fetch ${key}:`, error);
                    const defaultEmpty = [];
                    setCache(prev => ({ ...prev, [key]: defaultEmpty }));
                    return defaultEmpty;
                } finally {
                    setIsLoading(prev => ({ ...prev, [key]: false }));
                }
            };
        }
        
        // Original fetcher for all other keys (courses, facilitators, etc.)
        return async (force = false) => {
             const currentCache = cacheRef.current[key];
            const hasData = currentCache !== null;
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
                const defaultEmpty = key.includes('Settings') ? { isActive: false, openCount: 0 } : [];
                setCache(prev => ({ ...prev, [key]: defaultEmpty }));
                return defaultEmpty;
            } finally {
                setIsLoading(prev => ({ ...prev, [key]: false }));
            }
        };
    }, [lastFacilitiesFetchTime]);

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
            setLastFacilitiesFetchTime(0); // Reset timestamp on logout
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