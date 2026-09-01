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
    listIMNCIPatientRecords,
    fetchFacilitiesHistoryMultiDate, 
    listSnapshotsForFacility,
    getAboutTeamImages 
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

// --- DELTA-SYNC SAFETY OVERLAP ---
// The sync watermark is written from the CLIENT clock (Date.now()), but the
// documents are stamped with serverTimestamp() from the SERVER clock. If the
// device clock runs even slightly ahead of the server, a freshly written doc
// gets a lastUpdatedAt that is BELOW the stored watermark and is therefore
// excluded from every future "> watermark" query — the edit never reaches the
// cache, permanently. Re-querying a small overlap window absorbs that skew and
// also re-catches anything written while a previous sync was in flight.
const SYNC_OVERLAP_MS = 10 * 60 * 1000; // 10 minutes

const rewindWatermark = (ms) => (ms > 0 ? Math.max(0, ms - SYNC_OVERLAP_MS) : 0);

// --- SIGNATURE STRIPPING BEFORE DISK CACHE ---
// Signature and stamp images are stored inline (base64) on the course document
// so they are covered by Firestore rules instead of living behind a permanent
// public Storage URL. The side effect is that a naive cache would write those
// images to IndexedDB on EVERY device that merely loads the course list — a
// durable copy of an official signature sitting on disk on machines that have
// no business holding one.
//
// So they are stripped before anything is persisted locally. The in-memory copy
// keeps them, so the UI still works for the current session, and the certificate
// generator re-reads the course from Firestore before rendering anyway, so a
// stripped cache can never produce an unsigned PDF.
const SIGNATURE_CACHE_KEYS = [
    'approvedByManagerSignatureUrl',
    'approvedDirectorSignatureUrl',
    'approvedProgramStampUrl',
    'approvedThirdPartySignatureUrl',
    'approvedFourthPartySignatureUrl'
];
const CUSTOM_SIGNATURE_CACHE_KEYS = ['thirdPartySignatureUrl', 'fourthPartySignatureUrl'];

const stripSignaturesForDisk = (data) => {
    if (!Array.isArray(data)) return data;
    return data.map(item => {
        if (!item || typeof item !== 'object') return item;

        let changed = false;
        const copy = { ...item };

        SIGNATURE_CACHE_KEYS.forEach(k => {
            if (copy[k]) {
                // Keep a boolean so any "signature uploaded?" UI still reads true
                // without the bytes being on disk.
                copy[`${k}__present`] = true;
                copy[k] = null;
                changed = true;
            }
        });

        if (copy.customCertificate && typeof copy.customCertificate === 'object') {
            const cc = { ...copy.customCertificate };
            let ccChanged = false;
            CUSTOM_SIGNATURE_CACHE_KEYS.forEach(k => {
                if (cc[k]) { cc[`${k}__present`] = true; cc[k] = null; ccChanged = true; }
            });
            if (ccChanged) { copy.customCertificate = cc; changed = true; }
        }

        return changed ? copy : item;
    });
};

// --- STRICT TIMEOUT HELPER ---
const fetchWithTimeout = async (promise, timeoutMs = 60000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out after " + timeoutMs + "ms")), timeoutMs))
    ]);
};

// ============================================================================
// --- NATIVE INDEXED-DB CACHE FOR STRICT INCREMENTAL UPDATES ---
// ============================================================================
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AppDataCache', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('apiData')) {
                db.createObjectStore('apiData');
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
};

const setLocalData = async (key, data) => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('apiData', 'readwrite');
            tx.objectStore('apiData').put(data, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.warn('IDB put error', e); return false; }
};

const getLocalData = async (key) => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('apiData', 'readonly');
            const req = tx.objectStore('apiData').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.warn('IDB get error', e); return null; }
};
// ============================================================================

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
        imnciPatientRecords: null, 
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
        aboutTeamImages: null, 
    });

    const [isLoading, setIsLoading] = useState({
        courses: true,
        participants: true,
        facilitators: true,
        healthFacilities: true, 
        skillMentorshipSubmissions: true,
        imnciVisitReports: true,
        eencVisitReports: true, 
        imnciPatientRecords: true, 
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
        aboutTeamImages: true, 
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
                
                const timeKey = `lastServerFetch_${key}_${filterKey}`;
                const lastFetchTime = parseInt(localStorage.getItem(timeKey) || '0', 10);
                const isStale = (Date.now() - lastFetchTime) > CACHE_TTL_MS;
                const shouldForceServer = force || isStale;
                
                // 1. Memory Cache
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
                
                if (!internalCache[filterKey]) {
                    setIsLoading(prev => ({ ...prev, healthFacilities: true }));
                }

                // 2. Strict IndexedDB Base Cache
                let localData = [];
                if (!internalCache[filterKey]) {
                    try {
                        const cachedData = await getLocalData(`cache_${key}_${filterKey}`);
                        if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
                            localData = cachedData;
                            facilitiesFilterCacheRef.current[filterKey] = localData;
                            
                            if (filterKey === currentFacilitiesFilterKeyRef.current || currentFacilitiesFilterKeyRef.current === 'all') {
                                setCache(prev => ({ ...prev, healthFacilities: localData }));
                                currentFacilitiesFilterKeyRef.current = filterKey;
                            }
                            
                            setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                            
                            if (!shouldForceServer && navigator.onLine) {
                                fetchingRef.current[filterKey] = false;
                                return localData; 
                            }
                        }
                    } catch (e) {
                        console.warn("Local IDB cache fetch failed:", e.message);
                    }
                } else {
                    localData = internalCache[filterKey];
                    if (localData.length > 0) {
                        setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    }
                }

                if (!navigator.onLine) {
                    setIsLoading(prev => ({ ...prev, healthFacilities: false }));
                    fetchingRef.current[filterKey] = false;
                    return localData;
                }

                // 3. Server Delta Fetch
                try {
                    const fetchStartedAt = Date.now();

                    let effectiveLastFetchTime = rewindWatermark(lastFetchTime);
                    if (!localData || localData.length === 0) {
                        effectiveLastFetchTime = 0; // First time, full load needed
                    }
                    if (force) {
                        effectiveLastFetchTime = 0; // Explicit refresh = get the truth
                    }

                    const activeFilters = { ...filters };
                    if (effectiveLastFetchTime > 0) {
                        activeFilters.lastUpdatedAfter = new Date(effectiveLastFetchTime);
                    }
                    
                    // High timeout (60s) to allow first-time full downloads to succeed
                    const newOrUpdatedData = await fetchWithTimeout(listHealthFacilities(activeFilters, { source: 'server' }), 60000); 
                    
                    let finalMergedData = localData;

                    if (newOrUpdatedData && newOrUpdatedData.length > 0) {
                        const dataMap = new Map((localData || []).map(item => [item.id, item]));
                        
                        newOrUpdatedData.forEach(newItem => {
                            if (newItem && newItem.id) {
                                dataMap.set(newItem.id, newItem);
                            }
                        });
                        
                        finalMergedData = Array.from(dataMap.values());
                        
                        // Save merged data securely back to IndexedDB
                        await setLocalData(`cache_${key}_${filterKey}`, stripSignaturesForDisk(finalMergedData));
                    }
                    
                    // Log success time (captured before the request, not after)
                    localStorage.setItem(timeKey, fetchStartedAt.toString());

                    facilitiesFilterCacheRef.current[filterKey] = finalMergedData;
                    setCache(prev => ({ ...prev, healthFacilities: finalMergedData }));
                    setLastFacilitiesFetchTime(prev => ({ ...prev, [filterKey]: fetchStartedAt })); 
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
        
        // General Data Fetchers
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
            
            if (!hasData) {
                setIsLoading(prev => ({ ...prev, [key]: true }));
            }
            
            let localData = hasData ? currentCache : [];
            if (!hasData) {
                try {
                    const cachedData = await getLocalData(`cache_${key}`);
                    if (cachedData !== undefined && cachedData !== null) {
                        localData = cachedData;
                        
                        setCache(prev => ({ ...prev, [key]: localData }));
                        
                        if ((Array.isArray(localData) && localData.length > 0) || (!Array.isArray(localData) && localData && Object.keys(localData).length > 0)) {
                            setIsLoading(prev => ({ ...prev, [key]: false }));
                        }
                        
                        if (!shouldForceServer && navigator.onLine) {
                            fetchingRef.current[key] = false;
                            return localData;
                        }
                    }
                } catch (e) {
                    console.warn("IDB cache fetch failed for:", key);
                }
            } else {
                setIsLoading(prev => ({ ...prev, [key]: false }));
            }
            
            if (!navigator.onLine) {
                setIsLoading(prev => ({ ...prev, [key]: false }));
                fetchingRef.current[key] = false;
                return localData;
            }

            try {
                // Recorded BEFORE the request. Using Date.now() after the fetch
                // resolves would silently skip any document written while the
                // request was in flight.
                const fetchStartedAt = Date.now();

                let effectiveLastFetchTime = rewindWatermark(lastFetchTime);

                // If localDB is empty, we must do a full download to reconstruct it.
                if ((!localData || (Array.isArray(localData) && localData.length === 0)) && !key.includes('Settings')) {
                    effectiveLastFetchTime = 0;
                }

                // An explicit force means "I just wrote something, get the truth".
                // Previously force still applied the incremental window, so a fresh
                // edit that fell outside it could never be pulled in no matter how
                // many times the caller refreshed.
                if (force && !key.includes('Settings')) {
                    effectiveLastFetchTime = 0;
                }

                const newOrUpdatedData = await fetchWithTimeout(fetchFn({ source: 'server' }, effectiveLastFetchTime), 60000); 
                
                let finalMergedData = localData;

                if (Array.isArray(newOrUpdatedData) && newOrUpdatedData.length > 0) {
                    const dataMap = new Map((Array.isArray(localData) ? localData : []).map(item => [item.id, item]));
                    newOrUpdatedData.forEach(newItem => {
                        if (newItem && newItem.id) {
                            dataMap.set(newItem.id, newItem);
                        }
                    });
                    finalMergedData = Array.from(dataMap.values());
                    await setLocalData(`cache_${key}`, stripSignaturesForDisk(finalMergedData));
                } else if (!Array.isArray(newOrUpdatedData)) {
                    finalMergedData = newOrUpdatedData;
                    await setLocalData(`cache_${key}`, stripSignaturesForDisk(finalMergedData));
                } else if (newOrUpdatedData && newOrUpdatedData.length === 0) {
                     finalMergedData = localData;
                }
                
                localStorage.setItem(timeKey, fetchStartedAt.toString());

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
        
        fetchAboutTeamImages: createFetcher('aboutTeamImages', (opts) => getAboutTeamImages(opts)),
    }), [createFetcher]);

    useEffect(() => {
        if (!user) {
            setLastFacilitiesFetchTime({});
            facilitiesFilterCacheRef.current = {};
            currentFacilitiesFilterKeyRef.current = 'all';
            fetchingRef.current = {};
        }
    }, [user]); 

    // Clears every sync watermark and the IndexedDB mirror, so the next fetch is a
    // full re-download. Recovery hatch for caches poisoned before the watermark fix.
    const clearLocalCache = useCallback(async () => {
        try {
            Object.keys(localStorage)
                .filter(k => k.startsWith('lastServerFetch_'))
                .forEach(k => localStorage.removeItem(k));
            const db = await initDB();
            await new Promise((resolve, reject) => {
                const tx = db.transaction('apiData', 'readwrite');
                tx.objectStore('apiData').clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
            facilitiesFilterCacheRef.current = {};
            fetchingRef.current = {};
            return true;
        } catch (e) {
            console.warn('Failed to clear local cache', e);
            return false;
        }
    }, []);

    const value = { 
        ...cache, 
        ...fetchers, 
        isLoading,
        clearLocalCache,
        fetchFacilitiesHistoryMultiDate, 
        listSnapshotsForFacility
    };

    return (
        <DataCacheContext.Provider value={value}>
            {children}
        </DataCacheContext.Provider>
    );
};