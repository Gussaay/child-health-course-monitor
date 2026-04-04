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
    listMentorshipSessions, 
    listIMNCIVisitReports, 
    listEENCVisitReports, 
    listParticipantTestsForCourse, 
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

const getFilterKey = (filters) => {
  if (!filters || Object.keys(filters).length === 0) return 'all';
  const sortedKeys = Object.keys(filters).sort();
  return sortedKeys.map(key => `${key}:${filters[key]}`).join('|');
};

// --- 24-HOUR CACHE EXPIRATION CONSTANT ---
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
        skillMentorshipSubmissions: null,
        imnciVisitReports: null,
        eencVisitReports: null, 
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
        healthFacilities: true, 
        skillMentorshipSubmissions: true,
        imnciVisitReports: true,
        eencVisitReports: true, 
        participantTests: true,
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
    });
    
    const [lastFacilitiesFetchTime, setLastFacilitiesFetchTime] = useState({}); 
    const lastFacilitiesFetchTimeRef = useRef(lastFacilitiesFetchTime);
    const fetchingRef = useRef({}); 

    const facilitiesFilterCacheRef = useRef({});
    const currentFacilitiesFilterKeyRef = useRef('all');
    const cacheRef = useRef(cache);
    
    useEffect(() => { cacheRef.current = cache; }, [cache]);
    useEffect(() => { lastFacilitiesFetchTimeRef.current = lastFacilitiesFetchTime; }, [lastFacilitiesFetchTime]);
    
    const createFetcher = useCallback((key, fetchFn) => {
        if (key === 'healthFacilities') {
             return async (filters = {}, force = false) => { 
                const filterKey = getFilterKey(filters);
                const internalCache = facilitiesFilterCacheRef.current;
                
                // Determine if cache is stale (> 24 hours)
                const timeKey = `lastServerFetch_${key}_${filterKey}`;
                const lastFetchTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
                const isStale = (Date.now() - lastFetchTime) > CACHE_TTL_MS;
                const shouldForceServer = force || isStale;
                
                // 1. Memory Cache validation
                if (internalCache[filterKey] && !shouldForceServer) {
                    const cachedData = internalCache[filterKey];
                    if (filterKey !== currentFacilitiesFilterKeyRef.current) {
                        setCache(prev => ({ ...prev, healthFacilities: cachedData }));
                        currentFacilitiesFilterKeyRef.current = filterKey;
                    }
                    setIsLoading(prev => prev.healthFacilities === false ? prev : { ...prev, healthFacilities: false });
                    return cachedData;
                }

                if (fetchingRef.current[filterKey]) return cacheRef.current.healthFacilities; 
                fetchingRef.current[filterKey] = true;

                // 2. Try fetching from Firebase IndexedDB Cache first (if not forced/stale)
                if (!shouldForceServer) {
                    try {
                        const cachedData = await listHealthFacilities(filters, { source: 'cache' });
                        // Accept ANY successful cache read, even if it's an empty array []
                        if (cachedData !== undefined && cachedData !== null) {
                            facilitiesFilterCacheRef.current[filterKey] = cachedData;
                            if (filterKey === currentFacilitiesFilterKeyRef.current || currentFacilitiesFilterKeyRef.current === 'all') {
                                setCache(prev => ({ ...prev, healthFacilities: cachedData }));
                                currentFacilitiesFilterKeyRef.current = filterKey;
                            }
                            setIsLoading(prev => prev.healthFacilities === false ? prev : { ...prev, healthFacilities: false });
                            fetchingRef.current[filterKey] = false;
                            
                            // SUCCESS: Return immediately to prevent background server fetch
                            return cachedData; 
                        }
                    } catch (e) {
                        // Silent catch, fallback to server
                    }
                }

                setIsLoading(prev => prev.healthFacilities === true ? prev : { ...prev, healthFacilities: true });

                // 3. Fetch from Server (Happens if forced, stale > 24h, or cache is empty)
                try {
                    const newData = await listHealthFacilities(filters, { source: 'server' }); 
                    
                    // Mark successful server fetch time in local storage
                    localStorage.setItem(timeKey, Date.now().toString());

                    facilitiesFilterCacheRef.current[filterKey] = newData;
                    setCache(prev => ({ ...prev, healthFacilities: newData }));
                    setLastFacilitiesFetchTime(prev => ({ ...prev, [filterKey]: Date.now() })); 
                    currentFacilitiesFilterKeyRef.current = filterKey;
                    return newData;
                } catch (error) {
                    console.error(`Failed to fetch ${key} for ${filterKey}:`, error);
                    const defaultEmpty = [];
                    if (!facilitiesFilterCacheRef.current[filterKey]) {
                        facilitiesFilterCacheRef.current[filterKey] = defaultEmpty;
                        setCache(prev => ({ ...prev, healthFacilities: defaultEmpty }));
                    }
                    return defaultEmpty;
                } finally {
                    setIsLoading(prev => prev.healthFacilities === false ? prev : { ...prev, healthFacilities: false });
                    fetchingRef.current[filterKey] = false;
                }
            };
        }
        
        return async (force = false) => {
            const currentCache = cacheRef.current[key];
            const hasData = currentCache !== null;
            const isDefaultSettings = (key.includes('Settings') && currentCache?.openCount === 0);

            // Determine if cache is stale (> 24 hours)
            const timeKey = `lastServerFetch_${key}`;
            const lastFetchTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
            const isStale = (Date.now() - lastFetchTime) > CACHE_TTL_MS;
            const shouldForceServer = force || isStale;

            // If we already hold the data in active memory, serve it instantly
            if (hasData && !shouldForceServer && !isDefaultSettings) {
                return currentCache;
            }

            if (fetchingRef.current[key]) return currentCache;
            fetchingRef.current[key] = true;
            
            // 1. Try Firebase Cache first to ensure zero delay (if not forced/stale)
            if (!shouldForceServer) {
                try {
                    const cachedData = await fetchFn({ source: 'cache' });
                    // Accept ANY successful cache read, even if it's an empty array []
                    if (cachedData !== undefined && cachedData !== null) {
                        setCache(prev => ({ ...prev, [key]: cachedData }));
                        setIsLoading(prev => prev[key] === false ? prev : { ...prev, [key]: false });
                        fetchingRef.current[key] = false;
                        
                        // SUCCESS: Return immediately to prevent background server fetch
                        return cachedData;
                    }
                } catch (e) {
                    // Silent catch, fallback to server
                }
            }

            setIsLoading(prev => prev[key] === true ? prev : { ...prev, [key]: true });
            
            // 2. Fetch fresh data from Server (Happens if forced, stale > 24h, or cache read failed)
            try {
                const data = await fetchFn({ source: 'server' }); 
                
                // Mark successful server fetch time in local storage
                localStorage.setItem(timeKey, Date.now().toString());

                setCache(prev => ({ ...prev, [key]: data })); 
                return data;
            } catch (error) {
                console.error(`Failed to fetch ${key}:`, error);
                if (cacheRef.current[key] === null) {
                    const defaultEmpty = key.includes('Settings') ? { isActive: false, openCount: 0 } : [];
                    setCache(prev => ({ ...prev, [key]: defaultEmpty }));
                    return defaultEmpty;
                }
                return cacheRef.current[key];
            } finally {
                setIsLoading(prev => prev[key] === false ? prev : { ...prev, [key]: false });
                fetchingRef.current[key] = false;
            }
        };
    }, []); 

    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', (opts) => listAllCourses(opts)),
        fetchParticipants: createFetcher('participants', (opts) => listAllParticipants(opts)),
        fetchFacilitators: createFetcher('facilitators', (opts) => listFacilitators(opts)),
        fetchFunders: createFetcher('funders', (opts) => listFunders(opts)),
        fetchFederalCoordinators: createFetcher('federalCoordinators', (opts) => listFederalCoordinators(opts)),
        fetchStateCoordinators: createFetcher('stateCoordinators', (opts) => listStateCoordinators(opts)),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', (opts) => listLocalityCoordinators(opts)),
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities), 
        fetchSkillMentorshipSubmissions: createFetcher('skillMentorshipSubmissions', (opts) => listMentorshipSessions(opts)),
        fetchIMNCIVisitReports: createFetcher('imnciVisitReports', (opts) => listIMNCIVisitReports(opts)),
        fetchEENCVisitReports: createFetcher('eencVisitReports', (opts) => listEENCVisitReports(opts)), 
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
            setCache({
                courses: null, participants: null, facilitators: null, funders: null, federalCoordinators: null, stateCoordinators: null, localityCoordinators: null, healthFacilities: null, skillMentorshipSubmissions: null, imnciVisitReports: null, eencVisitReports: null, participantTests: null, pendingFacilitatorSubmissions: null, facilitatorApplicationSettings: { isActive: false, openCount: 0 }, pendingFederalSubmissions: null, pendingStateSubmissions: null, pendingLocalitySubmissions: null, coordinatorApplicationSettings: { isActive: false, openCount: 0 },
            });
            setIsLoading({
                courses: true, participants: true, facilitators: true, healthFacilities: true, skillMentorshipSubmissions: true, imnciVisitReports: true, eencVisitReports: true, participantTests: true, pendingFacilitatorSubmissions: true, facilitatorApplicationSettings: true, pendingFederalSubmissions: true, pendingStateSubmissions: true, pendingLocalitySubmissions: true, coordinatorApplicationSettings: true,
            });
            setLastFacilitiesFetchTime({});
            facilitiesFilterCacheRef.current = {};
            currentFacilitiesFilterKeyRef.current = 'all';
            fetchingRef.current = {};
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