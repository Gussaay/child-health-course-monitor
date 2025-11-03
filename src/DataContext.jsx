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
    listMentorshipSessions, // <-- ADD THIS IMPORT
    
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
        skillMentorshipSubmissions: null, // <-- ADD THIS
        
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
        skillMentorshipSubmissions: true, // <-- ADD THIS
        
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
    });
    
    // Tracks the last successful fetch time for health facilities to enable incremental updates
    const [lastFacilitiesFetchTime, setLastFacilitiesFetchTime] = useState(0); 
    const lastFacilitiesFetchTimeRef = useRef(lastFacilitiesFetchTime); // <-- ADD THIS REF
    
    const cacheRef = useRef(cache);
    const fetchingRef = useRef({}); // <-- ADD THIS REF
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    // --- START FIX: Add useEffect to sync state to ref ---
    useEffect(() => {
        lastFacilitiesFetchTimeRef.current = lastFacilitiesFetchTime;
    }, [lastFacilitiesFetchTime]);
    // --- END FIX ---

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
                    // --- MODIFICATION: Pass empty sourceOptions to use getData default (cache) ---
                    fetchPromise = listHealthFacilities({}); 
                    fetchTime = Date.now();
                // --- START FIX: Use ref instead of state ---
                } else if (incremental && lastFacilitiesFetchTimeRef.current > 0) {
                    // INCREMENTAL FETCH (Periodic polling)
                    const lastUpdatedAfter = new Date(lastFacilitiesFetchTimeRef.current); // <-- USE REF
                // --- END FIX ---
                    // --- MODIFICATION: Pass empty sourceOptions to use getData (will get server) ---
                    fetchPromise = listHealthFacilities({ lastUpdatedAfter });
                    fetchTime = Date.now();
                } else {
                    // CACHE HIT (return existing data)
                    setIsLoading(prev => ({ ...prev, [key]: false }));

                    // --- NEW: Stale-while-revalidate for healthFacilities cache hits ---
                    if (!fetchingRef.current[key]) {
                        fetchingRef.current[key] = true;
                        listHealthFacilities({}) // No timestamp, just get all from server
                            .then(data => {
                                setCache(prev => ({ ...prev, [key]: data }));
                                setLastFacilitiesFetchTime(Date.now()); // Update timestamp
                            })
                            .catch(error => {
                                console.error(`Background fetch for ${key} failed:`, error);
                            })
                            .finally(() => {
                                fetchingRef.current[key] = false;
                            });
                    }
                    // --- END NEW ---
                    return currentCache;
                }

                setIsLoading(prev => ({ ...prev, [key]: true }));
                
                if (fetchingRef.current[key]) return currentCache; // Prevent race condition
                fetchingRef.current[key] = true;

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
                    fetchingRef.current[key] = false;
                }
            };
        }
        
        // --- THIS IS THE NEW "STALE-WHILE-REVALIDATE" FETCHER ---
        return async (force = false) => {
             const currentCache = cacheRef.current[key];
            const hasData = currentCache !== null;
            const isDefaultSettings = (key.includes('Settings') && currentCache?.openCount === 0);

            // Path 1: Initial load (no data), forced refresh, or default settings
            if (hasData === false || force || isDefaultSettings) {
                // Show spinner, wait for this fetch
                setIsLoading(prev => ({ ...prev, [key]: true }));

                if (fetchingRef.current[key]) {
                    return currentCache; // A fetch is already in progress
                }

                fetchingRef.current[key] = true;
                try {
                    // --- FIX: Pass { source: 'server' } ---
                    // We must force a server fetch if force=true
                    const data = await fetchFn({ source: 'server' }); 
                    setCache(prev => ({ ...prev, [key]: data }));
                    return data;
                } catch (error) {
                    console.error(`Failed to fetch ${key}:`, error);
                    const defaultEmpty = key.includes('Settings') ? { isActive: false, openCount: 0 } : [];
                    setCache(prev => ({ ...prev, [key]: defaultEmpty }));
                    return defaultEmpty;
                } finally {
                    setIsLoading(prev => ({ ...prev, [key]: false }));
                    fetchingRef.current[key] = false;
                }
            }

            // Path 2: Stale-While-Revalidate (hasData and !force)
            // We have data, so return it immediately and fetch in background.
            // NO loading spinner.
            
            if (!fetchingRef.current[key]) { // Only fetch if not already fetching
                fetchingRef.current[key] = true;
                
                // Fire-and-forget promise (no await)
                // We pass { source: 'server' } to tell data.js to skip its
                // cache and go straight to the network.
                fetchFn({ source: 'server' })
                    .then(data => {
                        // Update the cache silently in the background
                        setCache(prev => ({ ...prev, [key]: data }));
                    })
                    .catch(error => {
                        // Don't bother the user, just log it
                        console.error(`Background fetch for ${key} failed:`, error);
                    })
                    .finally(() => {
                        fetchingRef.current[key] = false;
                    });
            }
            
            // Return the STALE data immediately
            setIsLoading(prev => ({ ...prev, [key]: false })); // Ensure spinner is off
            return currentCache;
        };
    // --- START FIX: Remove lastFacilitiesFetchTime from dependency array ---
    }, []); // fetchingRef is stable
    // --- END FIX ---

    // --- MODIFICATION: Update fetchers to pass `opts` to the data.js functions ---
    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', (opts) => listAllCourses(opts)),
        fetchParticipants: createFetcher('participants', (opts) => listAllParticipants(opts)),
        fetchFacilitators: createFetcher('facilitators', (opts) => listFacilitators(opts)),
        fetchFunders: createFetcher('funders', (opts) => listFunders(opts)),
        fetchFederalCoordinators: createFetcher('federalCoordinators', (opts) => listFederalCoordinators(opts)),
        fetchStateCoordinators: createFetcher('stateCoordinators', (opts) => listStateCoordinators(opts)),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', (opts) => listLocalityCoordinators(opts)),
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities), // This one is special
        fetchSkillMentorshipSubmissions: createFetcher('skillMentorshipSubmissions', (opts) => listMentorshipSessions(opts)), // <-- ADD THIS
        
        fetchPendingFacilitatorSubmissions: createFetcher('pendingFacilitatorSubmissions', (opts) => listPendingFacilitatorSubmissions(opts)),
        fetchFacilitatorApplicationSettings: createFetcher('facilitatorApplicationSettings', (opts) => getFacilitatorApplicationSettings(opts)),
        fetchPendingFederalSubmissions: createFetcher('pendingFederalSubmissions', (opts) => listPendingFederalSubmissions(opts)),
        fetchPendingStateSubmissions: createFetcher('pendingStateSubmissions', (opts) => listPendingCoordinatorSubmissions(opts)),
        fetchPendingLocalitySubmissions: createFetcher('pendingLocalitySubmissions', (opts) => listPendingLocalitySubmissions(opts)),
        fetchCoordinatorApplicationSettings: createFetcher('coordinatorApplicationSettings', (opts) => getCoordinatorApplicationSettings(opts)),
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
                skillMentorshipSubmissions: null, // <-- ADD THIS
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
                skillMentorshipSubmissions: true, // <-- ADD THIS
                pendingFacilitatorSubmissions: true,
                facilitatorApplicationSettings: true,
                pendingFederalSubmissions: true,
                pendingStateSubmissions: true,
                pendingLocalitySubmissions: true,
                coordinatorApplicationSettings: true,
            });
            setLastFacilitiesFetchTime(0); // Reset timestamp on logout
            fetchingRef.current = {}; // <-- ADD THIS: Reset fetching status on logout
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