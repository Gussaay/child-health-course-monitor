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
    getCoordinatorApplicationSettings,
    listProjects,
    listMasterPlans,
    listOperationalPlans,
    listUnitMeetings,
    listIMNCIPatientRecords
} from './data';
import { useAuth } from './hooks/useAuth';

const DataCacheContext = createContext();

export const useDataCache = () => useContext(DataCacheContext);

const getFilterKey = (filters) => {
  if (!filters || Object.keys(filters).length === 0) return 'all';
  const sortedKeys = Object.keys(filters).sort();
  return sortedKeys.map(key => `${key}:${filters[key]}`).join('|');
};

// --- 1-HOUR CACHE EXPIRATION CONSTANT ---
const CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

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
        imnciPatientRecords: null, // <--- ADDED
        participantTests: null,
        pendingFacilitatorSubmissions: null,
        facilitatorApplicationSettings: { isActive: false, openCount: 0 },
        pendingFederalSubmissions: null,
        pendingStateSubmissions: null,
        pendingLocalitySubmissions: null,
        coordinatorApplicationSettings: { isActive: false, openCount: 0 },
        projects: null,
        masterPlans: null,
        operationalPlans: null,
        unitMeetings: null,
    });

    const [isLoading, setIsLoading] = useState({
        courses: true,
        participants: true,
        facilitators: true,
        healthFacilities: true, 
        skillMentorshipSubmissions: true,
        imnciVisitReports: true,
        eencVisitReports: true, 
        imnciPatientRecords: true, // <--- ADDED
        participantTests: true,
        pendingFacilitatorSubmissions: true,
        facilitatorApplicationSettings: true,
        pendingFederalSubmissions: true,
        pendingStateSubmissions: true,
        pendingLocalitySubmissions: true,
        coordinatorApplicationSettings: true,
        projects: true,
        masterPlans: true,
        operationalPlans: true,
        unitMeetings: true,
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
                
                // Determine if cache is stale (> 1 hour)
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
                
                // Only set global loading to true if we don't have it in memory already
                if (!internalCache[filterKey]) {
                    setIsLoading(prev => ({ ...prev, healthFacilities: true }));
                }

                // 2. ALWAYS Try fetching from Firebase IndexedDB Cache first
                let localData = [];
                if (!internalCache[filterKey]) {
                    try {
                        const cachedData = await listHealthFacilities(filters, { source: 'cache' });
                        if (cachedData !== undefined && cachedData !== null) {
                            localData = cachedData;
                            facilitiesFilterCacheRef.current[filterKey] = localData;
                            
                            if (filterKey === currentFacilitiesFilterKeyRef.current || currentFacilitiesFilterKeyRef.current === 'all') {
                                setCache(prev => ({ ...prev, healthFacilities: localData }));
                                currentFacilitiesFilterKeyRef.current = filterKey;
                            }
                            
                            // STALE-WHILE-REVALIDATE: Instantly drop the loading flag if cache yielded data!
                            if (localData.length > 0) {
                                setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                            }
                            
                            if (!shouldForceServer) {
                                setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                                fetchingRef.current[filterKey] = false;
                                return localData; 
                            }
                        }
                    } catch (e) {
                        // Silent catch, fallback
                    }
                } else {
                    localData = internalCache[filterKey];
                    // Drop flag immediately if memory cache exists
                    if (localData.length > 0) {
                        setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    }
                }

                // --- OFFLINE GUARD: Return local cache instantly if offline ---
                if (!navigator.onLine) {
                    setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    fetchingRef.current[filterKey] = false;
                    return localData;
                }
                // --------------------------------------------------------------

                // 3. Fetch ONLY Deltas from Server
                try {
                    let effectiveLastFetchTime = lastFetchTime;
                    if (!localData || localData.length === 0) {
                        effectiveLastFetchTime = 0;
                    }

                    const activeFilters = { ...filters };
                    if (effectiveLastFetchTime > 0) {
                        activeFilters.lastUpdatedAfter = new Date(effectiveLastFetchTime);
                    }
                    
                    const newOrUpdatedData = await listHealthFacilities(activeFilters, { source: 'server' }); 
                    
                    let finalMergedData = localData;

                    if (newOrUpdatedData && newOrUpdatedData.length > 0) {
                        const dataMap = new Map((localData || []).map(item => [item.id, item]));
                        
                        newOrUpdatedData.forEach(newItem => {
                            if (newItem && newItem.id) {
                                dataMap.set(newItem.id, newItem);
                            }
                        });
                        
                        finalMergedData = Array.from(dataMap.values());
                    }
                    
                    localStorage.setItem(timeKey, Date.now().toString());

                    facilitiesFilterCacheRef.current[filterKey] = finalMergedData;
                    setCache(prev => ({ ...prev, healthFacilities: finalMergedData }));
                    setLastFacilitiesFetchTime(prev => ({ ...prev, [filterKey]: Date.now() })); 
                    currentFacilitiesFilterKeyRef.current = filterKey;
                    return finalMergedData;
                } catch (error) {
                    console.error(`Failed to fetch ${key} for ${filterKey}:`, error);
                    const defaultEmpty = [];
                    if (!facilitiesFilterCacheRef.current[filterKey]) {
                        facilitiesFilterCacheRef.current[filterKey] = defaultEmpty;
                        setCache(prev => ({ ...prev, healthFacilities: defaultEmpty }));
                    }
                    return localData || defaultEmpty;
                } finally {
                    setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    fetchingRef.current[filterKey] = false;
                }
            };
        }
        
        return async (force = false) => {
            const currentCache = cacheRef.current[key];
            const hasData = currentCache !== null;
            const isDefaultSettings = (key.includes('Settings') && currentCache?.openCount === 0);

            const timeKey = `lastServerFetch_${key}`;
            const lastFetchTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
            const isStale = (Date.now() - lastFetchTime) > CACHE_TTL_MS;
            const shouldForceServer = force || isStale;

            if (hasData && !shouldForceServer && !isDefaultSettings) {
                setIsLoading(prev => prev[key] === false ? prev : { ...prev, [key]: false });
                return currentCache;
            }

            if (fetchingRef.current[key]) return currentCache;
            fetchingRef.current[key] = true;
            
            // ONLY set loading to true if we DON'T have data in memory cache
            if (!hasData) {
                setIsLoading(prev => ({ ...prev, [key]: true }));
            }
            
            // 2. ALWAYS Try Firebase Cache first to establish our "Base"
            let localData = hasData ? currentCache : [];
            if (!hasData) {
                try {
                    const cachedData = await fetchFn({ source: 'cache' });
                    if (cachedData !== undefined && cachedData !== null) {
                        localData = cachedData;
                        
                        setCache(prev => ({ ...prev, [key]: localData }));
                        
                        // STALE-WHILE-REVALIDATE: Immediately disable loading if cache yielded data
                        if ((Array.isArray(localData) && localData.length > 0) || (!Array.isArray(localData) && localData && Object.keys(localData).length > 0)) {
                            setIsLoading(prev => ({ ...prev, [key]: false }));
                        }
                        
                        if (!shouldForceServer) {
                            setIsLoading(prev => ({ ...prev, [key]: false }));
                            fetchingRef.current[key] = false;
                            return localData;
                        }
                    }
                } catch (e) {
                    // Silent catch, fallback
                }
            } else {
                // Ensure loading is false if memory cache exists
                setIsLoading(prev => ({ ...prev, [key]: false }));
            }
            
            // --- OFFLINE GUARD: Return local cache instantly if offline ---
            if (!navigator.onLine) {
                setIsLoading(prev => ({ ...prev, [key]: false }));
                fetchingRef.current[key] = false;
                return localData;
            }
            // --------------------------------------------------------------

            // 3. Fetch ONLY Deltas from Server
            try {
                let effectiveLastFetchTime = lastFetchTime;
                if ((!localData || (Array.isArray(localData) && localData.length === 0)) && !key.includes('Settings')) {
                    effectiveLastFetchTime = 0;
                }

                const newOrUpdatedData = await fetchFn({ source: 'server' }, effectiveLastFetchTime); 
                
                let finalMergedData = localData;

                if (Array.isArray(newOrUpdatedData) && newOrUpdatedData.length > 0) {
                    const dataMap = new Map((Array.isArray(localData) ? localData : []).map(item => [item.id, item]));
                    newOrUpdatedData.forEach(newItem => {
                        if (newItem && newItem.id) {
                            dataMap.set(newItem.id, newItem);
                        }
                    });
                    finalMergedData = Array.from(dataMap.values());
                } else if (!Array.isArray(newOrUpdatedData)) {
                    finalMergedData = newOrUpdatedData;
                } else if (newOrUpdatedData && newOrUpdatedData.length === 0) {
                     finalMergedData = localData;
                }
                
                localStorage.setItem(timeKey, Date.now().toString());

                setCache(prev => ({ ...prev, [key]: finalMergedData })); 
                return finalMergedData;
            } catch (error) {
                console.error(`Failed to fetch ${key}:`, error);
                return localData || (key.includes('Settings') ? { isActive: false, openCount: 0 } : []);
            } finally {
                setIsLoading(prev => ({ ...prev, [key]: false }));
                fetchingRef.current[key] = false;
            }
        };
    }, []); 

    const fetchers = useMemo(() => ({
        fetchCourses: createFetcher('courses', (opts, lastSync) => listAllCourses(opts, lastSync)),
        fetchParticipants: createFetcher('participants', (opts, lastSync) => listAllParticipants(opts, lastSync)),
        fetchFacilitators: createFetcher('facilitators', (opts, lastSync) => listFacilitators(opts, lastSync)),
        fetchFunders: createFetcher('funders', (opts, lastSync) => listFunders(opts, lastSync)),
        fetchFederalCoordinators: createFetcher('federalCoordinators', (opts, lastSync) => listFederalCoordinators(opts, lastSync)),
        fetchStateCoordinators: createFetcher('stateCoordinators', (opts, lastSync) => listStateCoordinators(opts, lastSync)),
        fetchLocalityCoordinators: createFetcher('localityCoordinators', (opts, lastSync) => listLocalityCoordinators(opts, lastSync)),
        
        fetchHealthFacilities: createFetcher('healthFacilities', listHealthFacilities), 
        
        fetchSkillMentorshipSubmissions: createFetcher('skillMentorshipSubmissions', (opts, lastSync) => listMentorshipSessions(opts, lastSync)),
        fetchIMNCIVisitReports: createFetcher('imnciVisitReports', (opts, lastSync) => listIMNCIVisitReports(opts, lastSync)),
        fetchEENCVisitReports: createFetcher('eencVisitReports', (opts, lastSync) => listEENCVisitReports(opts, lastSync)), 
        
        // <--- ADDED FETCHER --->
        fetchIMNCIPatientRecords: createFetcher('imnciPatientRecords', (opts, lastSync) => listIMNCIPatientRecords(opts, lastSync)), 

        fetchParticipantTests: createFetcher('participantTests', (opts) => listParticipantTestsForCourse(null, opts)),
        fetchPendingFacilitatorSubmissions: createFetcher('pendingFacilitatorSubmissions', (opts) => listPendingFacilitatorSubmissions(opts)),
        fetchFacilitatorApplicationSettings: createFetcher('facilitatorApplicationSettings', (opts) => getFacilitatorApplicationSettings(opts)),
        fetchPendingFederalSubmissions: createFetcher('pendingFederalSubmissions', (opts) => listPendingFederalSubmissions(opts)),
        fetchPendingStateSubmissions: createFetcher('pendingStateSubmissions', (opts) => listPendingCoordinatorSubmissions(opts)),
        fetchPendingLocalitySubmissions: createFetcher('pendingLocalitySubmissions', (opts) => listPendingLocalitySubmissions(opts)),
        fetchCoordinatorApplicationSettings: createFetcher('coordinatorApplicationSettings', (opts) => getCoordinatorApplicationSettings(opts)),
        
        fetchProjects: createFetcher('projects', (opts, lastSync) => listProjects(opts, lastSync)),
        fetchMasterPlans: createFetcher('masterPlans', (opts, lastSync) => listMasterPlans(opts, lastSync)),
        fetchOperationalPlans: createFetcher('operationalPlans', (opts, lastSync) => listOperationalPlans(opts, lastSync)),
        fetchUnitMeetings: createFetcher('unitMeetings', (opts, lastSync) => listUnitMeetings(opts, lastSync)),
    }), [createFetcher]);

    useEffect(() => {
        if (!user) {
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