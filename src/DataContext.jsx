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
    listIMNCIVisitReports, // <-- ADD THIS IMPORT
    listEENCVisitReports, // <-- NEW IMPORT
    listParticipantTestsForCourse, // <-- ADD THIS IMPORT
    
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

// --- NEW: Helper function to create a stable cache key from a filter object ---
const getFilterKey = (filters) => {
  if (!filters || Object.keys(filters).length === 0) return 'all';
  // Sort keys to ensure {a:1, b:2} and {b:2, a:1} produce the same key
  const sortedKeys = Object.keys(filters).sort();
  return sortedKeys.map(key => `${key}:${filters[key]}`).join('|');
};

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
        healthFacilities: null, // This remains the *currently displayed* facilities
        skillMentorshipSubmissions: null,
        imnciVisitReports: null,
        eencVisitReports: null, // <-- NEW STATE
        participantTests: null,
        
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
        healthFacilities: true, // This is now just the *main* loading spinner
        skillMentorshipSubmissions: true,
        imnciVisitReports: true,
        eencVisitReports: true, // <-- NEW STATE
        participantTests: true,
        
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
    });
    
    // --- MODIFICATION: These refs now store data *per filter key* ---
    const [lastFacilitiesFetchTime, setLastFacilitiesFetchTime] = useState({}); 
    const lastFacilitiesFetchTimeRef = useRef(lastFacilitiesFetchTime);
    const fetchingRef = useRef({}); // Tracks fetch status *per filter key*
    // --- END MODIFICATION ---

    // --- NEW: Internal cache for *all* fetched facility filters ---
    const facilitiesFilterCacheRef = useRef({});
    // --- NEW: Ref to track the *currently displayed* filter key ---
    const currentFacilitiesFilterKeyRef = useRef('all');
    
    const cacheRef = useRef(cache);
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    useEffect(() => {
        lastFacilitiesFetchTimeRef.current = lastFacilitiesFetchTime;
    }, [lastFacilitiesFetchTime]);
    

    const createFetcher = useCallback((key, fetchFn) => {
        
        // --- START CACHE-ONLY REWRITE: `healthFacilities` fetcher ---
        if (key === 'healthFacilities') {
             return async (filters = {}, force = false) => { 
                
                const filterKey = getFilterKey(filters);
                const internalCache = facilitiesFilterCacheRef.current;
                
                // --- Path 1: Data is in cache (and not a forced refresh) ---
                if (internalCache[filterKey] && !force) {
                    const cachedData = internalCache[filterKey];
                    
                    // If the filter is new, update the main state to display it.
                    if (filterKey !== currentFacilitiesFilterKeyRef.current) {
                        setCache(prev => ({ ...prev, healthFacilities: cachedData }));
                        currentFacilitiesFilterKeyRef.current = filterKey;
                    }
                    
                    // Turn off any spinners and return the cached data.
                    // NO server fetch is performed.
                    setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    return cachedData;
                }

                // --- Path 2: Data NOT in cache, or `force = true` ---
                // This path will show a loading spinner and fetch from server.
                
                // Show main loading spinner
                setIsLoading(prev => ({ ...prev, healthFacilities: true }));
                
                // Prevent duplicate fetches for the *same filter*
                const currentDisplayCache = cacheRef.current.healthFacilities;
                if (fetchingRef.current[filterKey]) return currentDisplayCache; 
                fetchingRef.current[filterKey] = true;

                try {
                    // Fetch data from server
                    const newData = await listHealthFacilities(filters); 
                    const fetchTime = Date.now();
                    
                    // --- Save to BOTH caches ---
                    facilitiesFilterCacheRef.current[filterKey] = newData; // Internal ref
                    setCache(prev => ({ ...prev, healthFacilities: newData })); // Main state
                    
                    // Update timestamp (useful if you add a 'force' button later)
                    setLastFacilitiesFetchTime(prev => ({ ...prev, [filterKey]: fetchTime })); 
                    currentFacilitiesFilterKeyRef.current = filterKey;
                    
                    return newData;

                } catch (error) {
                    console.error(`Failed to fetch ${key} for ${filterKey}:`, error);
                    const defaultEmpty = [];
                    // Save empty result to caches to prevent re-fetch loop
                    facilitiesFilterCacheRef.current[filterKey] = defaultEmpty;
                    setCache(prev => ({ ...prev, healthFacilities: defaultEmpty }));
                    return defaultEmpty;
                } finally {
                    // Turn off main spinner and per-key fetching flag
                    setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    fetchingRef.current[filterKey] = false;
                }
            };
        }
        // --- END CACHE-ONLY REWRITE ---
        
        // --- Standard "Stale-While-Revalidate" Fetcher (for all other data) ---
        // --- MODIFIED TO BE "CACHE-ONLY" ---
        return async (force = false) => {
             const currentCache = cacheRef.current[key];
            const hasData = currentCache !== null;
            const isDefaultSettings = (key.includes('Settings') && currentCache?.openCount === 0);

            // Path 1: Initial load (no data), forced refresh, or default settings
            if (hasData === false || force || isDefaultSettings) {
                setIsLoading(prev => ({ ...prev, [key]: true }));
                if (fetchingRef.current[key]) return currentCache;
                fetchingRef.current[key] = true;
                
                try {
                    const data = await fetchFn({}); 
                    setCache(prev => ({ ...prev, [key]: data })); // Save to cache
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

            // Path 2: Data is in cache (and !force)
            // Return the STALE data immediately.
            // DO NOT fetch in the background.
            setIsLoading(prev => ({ ...prev, [key]: false }));
            return currentCache;
        };
    }, []); // No dependencies, refs are stable

    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', (opts) => listAllCourses(opts)),
        fetchParticipants: createFetcher('participants', (opts) => listAllParticipants(opts)),
        fetchFacilitators: createFetcher('facilitators', (opts) => listFacilitators(opts)),
        fetchFunders: createFetcher('funders', (opts) => listFunders(opts)),
        fetchFederalCoordinators: createFetcher('federalCoordinators', (opts) => listFederalCoordinators(opts)),
        fetchStateCoordinators: createFetcher('stateCoordinators', (opts) => listStateCoordinators(opts)),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', (opts) => listLocalityCoordinators(opts)),
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities), // This one is special
        fetchSkillMentorshipSubmissions: createFetcher('skillMentorshipSubmissions', (opts) => listMentorshipSessions(opts)),
        fetchIMNCIVisitReports: createFetcher('imnciVisitReports', (opts) => listIMNCIVisitReports(opts)),
        fetchEENCVisitReports: createFetcher('eencVisitReports', (opts) => listEENCVisitReports(opts)), // <-- NEW FETCHER
        fetchParticipantTests: createFetcher('participantTests', (opts) => listParticipantTestsForCourse(opts)),
        
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
                skillMentorshipSubmissions: null,
                imnciVisitReports: null,
                eencVisitReports: null, // <-- NEW STATE
                participantTests: null,
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
                skillMentorshipSubmissions: true,
                imnciVisitReports: true,
                eencVisitReports: true, // <-- NEW STATE
                participantTests: true,
                pendingFacilitatorSubmissions: true,
                facilitatorApplicationSettings: true,
                pendingFederalSubmissions: true,
                pendingStateSubmissions: true,
                pendingLocalitySubmissions: true,
                coordinatorApplicationSettings: true,
            });
            // --- MODIFICATION: Reset all refs on logout ---
            setLastFacilitiesFetchTime({});
            facilitiesFilterCacheRef.current = {};
            currentFacilitiesFilterKeyRef.current = 'all';
            fetchingRef.current = {};
            // --- END MODIFICATION ---
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