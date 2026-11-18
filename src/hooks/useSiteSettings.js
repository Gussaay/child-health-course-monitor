// What this site shows, from meta/siteSettings (set in Admin > Sites on the
// main site). One listener is shared by every component that asks. The last
// copy is kept in localStorage so the menu is right before the listener
// answers, offline, and before sign-in (meta/ needs a signed-in user).
import { useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { CURRENT_SITE, hiddenViewsFor } from '../siteMode';

const CACHE_KEY = 'siteSettings:v1';

function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

let settings = readCache();
let hidden = hiddenViewsFor(CURRENT_SITE, settings);
const subscribers = new Set();
let started = false;

function setSettings(next) {
    settings = next;
    hidden = hiddenViewsFor(CURRENT_SITE, settings);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    subscribers.forEach(fn => fn());
}

function start() {
    // The main site always shows everything, so it needs no listener.
    if (started || CURRENT_SITE === 'main') return;
    started = true;
    let stopDoc = null;
    onAuthStateChanged(auth, (user) => {
        stopDoc?.();
        stopDoc = null;
        if (!user) return;
        stopDoc = onSnapshot(
            doc(db, 'meta', 'siteSettings'),
            (snap) => setSettings(snap.exists() ? snap.data() : null),
            (err) => console.warn('[Site settings] listener error:', err?.code)
        );
    });
}

function subscribe(fn) {
    start();
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}

// The set of page names this site hides (empty on the main site).
export function useSiteHiddenViews() {
    return useSyncExternalStore(subscribe, () => hidden, () => hidden);
}
