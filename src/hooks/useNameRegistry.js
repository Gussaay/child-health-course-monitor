// useNameRegistry.js
//
// The standard project and organization names, shared by every screen.
// Loaded once per session and kept in this module, so a dashboard and a form
// open at the same time agree on the same list.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getNameRegistry, saveNameRegistry } from '../data.js';
import { useDataCache } from '../DataContext';
import { useAuth } from './useAuth';
import { buildCanonicalizer, canonicalOptions, mergeRegistryEntries, tidyName, normalizeKey, activeEntries } from '../utils/nameRegistry';

let store = { registry: { projects: [], organizations: [] }, loaded: false };
let loading = null;
const listeners = new Set();
const emit = (next) => { store = { ...store, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => store;

export async function loadNameRegistry(force = false) {
    if (loading && !force) return loading;
    loading = (async () => {
        let registry;
        try {
            registry = await getNameRegistry();
        } catch {
            try { registry = await getNameRegistry({ source: 'cache' }); } catch { registry = null; }
        }
        if (registry) emit({ registry, loaded: true });
        else emit({ loaded: true });
        return store.registry;
    })();
    return loading;
}

/** Replaces one list and saves it. Throws when the user may not change it. */
export async function updateNameRegistry(kind, entries, userIdentifier) {
    const clean = mergeRegistryEntries(entries);
    await saveNameRegistry(kind, clean, userIdentifier);
    emit({ registry: { ...store.registry, [kind]: clean } });
    return clean;
}

export function useNameRegistry() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    useEffect(() => { if (!snapshot.loaded) loadNameRegistry(); }, [snapshot.loaded]);
    return snapshot;
}

/**
 * Standard names of one kind ('projects' or 'organizations').
 *
 * @param {string} kind
 * @param {string[]} [observedValues]  spellings found in the data on this screen,
 *        so variants not yet standardized still group together
 * @returns {{
 *   entries: {name: string, aliases: string[]}[],
 *   names: string[],                        official names (registry + Partners page)
 *   canonicalize: (value: string) => string,
 *   options: string[],                      official names plus standardized observed values
 *   addName: (name: string) => string,
 * }}
 */
export function useStandardNames(kind, observedValues = []) {
    const { registry } = useNameRegistry();
    const { user } = useAuth();
    const dataCache = useDataCache();
    const funders = dataCache?.funders;
    const fetchFunders = dataCache?.fetchFunders;

    // The Partners page is where organizations and their projects are set up,
    // so its names are official too. Only signed-in users can read it.
    useEffect(() => { if (user && !funders && fetchFunders) fetchFunders().catch?.(() => {}); }, [user, funders, fetchFunders]);

    const partnerNames = useMemo(() => {
        const list = (funders || []).filter((f) => f && f.isDeleted !== true && f.isDeleted !== 'true');
        return kind === 'organizations'
            ? list.map((f) => f.orgName).filter(Boolean)
            : list.flatMap((f) => f.projects || []).filter(Boolean);
    }, [funders, kind]);

    // Every name, including deleted ones (kept so they are not re-offered).
    const allEntries = useMemo(
        () => mergeRegistryEntries(registry[kind] || [], partnerNames),
        [registry, kind, partnerNames],
    );
    const entries = useMemo(() => activeEntries(allEntries), [allEntries]);
    const deletedKeys = useMemo(() => new Set(
        allEntries.filter((e) => e.deleted).flatMap((e) => [e.name, ...(e.aliases || [])]).map(normalizeKey),
    ), [allEntries]);
    const observedKey = observedValues.join('\u0001');
    const canonicalize = useMemo(
        () => buildCanonicalizer(allEntries, observedValues),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allEntries, observedKey],
    );
    const names = useMemo(() => entries.map((e) => e.name), [entries]);
    const options = useMemo(
        () => canonicalOptions(canonicalize, observedValues, names).filter((o) => !deletedKeys.has(normalizeKey(o))),
        [canonicalize, names, observedKey, deletedKeys], // eslint-disable-line react-hooks/exhaustive-deps
    );

    const addName = (name) => {
        const clean = tidyName(name);
        if (!clean) return '';
        const existing = entries.find((e) => normalizeKey(e.name) === normalizeKey(clean)
            || (e.aliases || []).some((a) => normalizeKey(a) === normalizeKey(clean)));
        if (existing) return existing.name;
        // A name deleted earlier and typed again is brought back rather than
        // staying hidden behind its deleted entry.
        const current = (store.registry[kind] || []).map((e) => (
            e.deleted && [e.name, ...(e.aliases || [])].some((n) => normalizeKey(n) === normalizeKey(clean))
                ? { name: e.name, aliases: e.aliases || [] }
                : e
        ));
        const next = mergeRegistryEntries([...current, { name: clean, aliases: [] }]);
        // Shown at once on this device; saved for everyone when the user may
        // (staff). A public submitter's new name still reaches the record, and
        // a manager can standardize it later.
        emit({ registry: { ...store.registry, [kind]: next } });
        // Not awaited: offline, a Firestore write only settles when the device
        // reconnects, and the form must not wait for that.
        saveNameRegistry(kind, next, user?.email || user?.displayName || 'Unknown')
            .catch((e) => console.warn(`[names] "${clean}" was not added to the shared list:`, e?.message || e));
        return clean;
    };

    return { entries, allEntries, names, canonicalize, options, addName };
}
