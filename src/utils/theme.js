// Light / dark / system appearance, remembered on this device.
// index.html applies the saved choice before the first paint (no white flash);
// this module keeps it in sync afterwards.
import { useEffect, useState, useCallback } from 'react';

const KEY = 'themePref';
const MODES = ['light', 'dark', 'system'];
const listeners = new Set();

export function getThemePref() {
    try {
        const v = localStorage.getItem(KEY);
        return MODES.includes(v) ? v : 'system';
    } catch { return 'system'; }
}

const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
export const isDarkNow = () => document.documentElement.classList.contains('dark');

export function applyTheme(pref = getThemePref()) {
    const dark = pref === 'dark' || (pref === 'system' && systemDark());
    const root = document.documentElement;
    const changed = root.classList.contains('dark') !== dark;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#1e293b');
    if (changed) listeners.forEach((fn) => fn(dark));
    return dark;
}

export function setThemePref(pref) {
    try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
    applyTheme(pref);
    listeners.forEach((fn) => fn(isDarkNow()));
}

export function onThemeChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** [pref, setPref, isDark] */
export function useTheme() {
    const [pref, setPref] = useState(getThemePref);
    const [dark, setDark] = useState(isDarkNow);
    useEffect(() => onThemeChange((d) => { setDark(d); setPref(getThemePref()); }), []);
    const set = useCallback((p) => setThemePref(p), []);
    return [pref, set, dark];
}

if (typeof window !== 'undefined') {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (getThemePref() === 'system') applyTheme('system');
    });
}
