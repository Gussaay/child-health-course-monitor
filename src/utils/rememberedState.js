import { useEffect, useState } from 'react';

// Like useState, but the value is kept for the rest of the app session
// (sessionStorage), so a page's filters are still set when you come back to it.
const PREFIX = 'filters:';

export function readRemembered(key, initial) {
    try {
        const raw = window.sessionStorage.getItem(PREFIX + key);
        if (raw !== null) return JSON.parse(raw);
    } catch { /* storage blocked or bad JSON: fall back */ }
    return typeof initial === 'function' ? initial() : initial;
}

export function writeRemembered(key, value) {
    try {
        if (value === undefined) window.sessionStorage.removeItem(PREFIX + key);
        else window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* storage full or blocked: nothing to do */ }
}

export function useRememberedState(key, initial) {
    const [value, setValue] = useState(() => readRemembered(key, initial));
    useEffect(() => { writeRemembered(key, value); }, [key, value]);
    return [value, setValue];
}

// Called on log out so the next person starts with clean filters.
export function clearRememberedFilters() {
    try {
        const store = window.sessionStorage;
        for (let i = store.length - 1; i >= 0; i -= 1) {
            const k = store.key(i);
            if (k && k.startsWith(PREFIX)) store.removeItem(k);
        }
    } catch { /* storage blocked: nothing to clear */ }
}
