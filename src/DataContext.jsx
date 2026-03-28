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
    
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    useEffect(() => {
        lastFacilitiesFetchTimeRef.current = lastFacilitiesFetchTime;
    }, [lastFacilitiesFetchTime]);
    

    const createFetcher = useCallback((key, fetchFn) => {
        if (key === 'healthFacilities') {
             return async (filters = {}, force = false) => { 
                const filterKey = getFilterKey(filters);
                const internalCache = facilitiesFilterCacheRef.current;
                
                // 1. Memory Cache validation
                if (internalCache[filterKey] && !force) {
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

                // 2. Try fetching from Firebase IndexedDB Cache first
                if (!force) {
                    try {
                        const cachedData = await listHealthFacilities(filters, { source: 'cache' });
                        if (cachedData && cachedData.length > 0) {
                            facilitiesFilterCacheRef.current[filterKey] = cachedData;
                            if (filterKey === currentFacilitiesFilterKeyRef.current || currentFacilitiesFilterKeyRef.current === 'all') {
                                setCache(prev => ({ ...prev, healthFacilities: cachedData }));
                                currentFacilitiesFilterKeyRef.current = filterKey;
                            }
                            setIsLoading(prev => prev.healthFacilities === false ? prev : { ...prev, healthFacilities: false });
                        } else {
                            setIsLoading(prev => prev.healthFacilities === true ? prev : { ...prev, healthFacilities: true });
                        }
                    } catch (e) {
                        setIsLoading(prev => prev.healthFacilities === true ? prev : { ...prev, healthFacilities: true });
                    }
                } else {
                    setIsLoading(prev => prev.healthFacilities === true ? prev : { ...prev, healthFacilities: true });
                }

                // 3. Revalidate from Server silently
                try {
                    const newData = await listHealthFacilities(filters, {}); 
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

            if (hasData === false || force || isDefaultSettings) {
                if (fetchingRef.current[key]) return currentCache;
                fetchingRef.current[key] = true;
                
                // 1. Try Firebase Cache first to ensure zero delay
                if (!force) {
                    try {
                        const cachedData = await fetchFn({ source: 'cache' });
                        if (cachedData && (Array.isArray(cachedData) ? cachedData.length > 0 : Object.keys(cachedData).length > 0)) {
                            setCache(prev => ({ ...prev, [key]: cachedData }));
                            setIsLoading(prev => prev[key] === false ? prev : { ...prev, [key]: false });
                        } else {
                            setIsLoading(prev => prev[key] === true ? prev : { ...prev, [key]: true });
                        }
                    } catch (e) {
                        setIsLoading(prev => prev[key] === true ? prev : { ...prev, [key]: true });
                    }
                } else {
                    setIsLoading(prev => prev[key] === true ? prev : { ...prev, [key]: true });
                }
                
                // 2. Fetch fresh data from Server in background
                try {
                    const data = await fetchFn({}); 
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
            }

            setIsLoading(prev => prev[key] === false ? prev : { ...prev, [key]: false });
            return currentCache;
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