// src/components/survey/gps.js
//
// Precise location for survey forms, on the web and in the Android app.
//
// Android 12+ lets a person grant only "approximate" location, which is a
// circle of a kilometre or more: no use for mapping a village. In the app the
// Capacitor Geolocation plugin tells precise ('location') from approximate
// ('coarseLocation'), and asking again shows the system prompt again, so the
// form keeps asking until precise location is granted. In a browser the page
// can only ask; a refused permission must be turned back on in the browser.

import { Capacitor } from '@capacitor/core';

// A reading wider than this is treated as approximate.
export const APPROXIMATE_M = 500;

const isNative = () => Capacitor.isNativePlatform();
const plugin = async () => (await import('@capacitor/geolocation')).Geolocation;

/**
 * Asks for precise location where the platform lets us.
 * Returns 'granted' | 'coarse' (approximate only) | 'denied' | 'prompt' | 'unsupported'.
 */
export async function ensurePreciseLocation() {
    if (isNative()) {
        try {
            const Geolocation = await plugin();
            let status = await Geolocation.checkPermissions();
            if (status.location !== 'granted') {
                status = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
            }
            if (status.location === 'granted') return 'granted';
            return status.coarseLocation === 'granted' ? 'coarse' : 'denied';
        } catch {
            return 'denied';
        }
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
    try {
        const p = await navigator.permissions?.query?.({ name: 'geolocation' });
        return p?.state || 'prompt';
    } catch {
        return 'prompt';
    }
}

/**
 * Starts high-accuracy readings. onFix(position-like) for each reading,
 * onError({ code }) on failure (1 = permission refused). Returns stop().
 */
export function watchPrecise(onFix, onError, timeoutMs) {
    const options = { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 };
    if (isNative()) {
        let id = null;
        let stopped = false;
        plugin().then((Geolocation) => Geolocation.watchPosition(options, (pos, err) => {
            if (err) onError({ code: /denied|permission/i.test(String(err?.message || err)) ? 1 : 2 });
            else if (pos) onFix(pos);
        })).then((watchId) => {
            id = watchId;
            if (stopped) plugin().then((G) => G.clearWatch({ id }));
        }).catch((err) => onError({ code: /denied|permission/i.test(String(err?.message || err)) ? 1 : 2 }));
        return () => {
            stopped = true;
            if (id !== null) plugin().then((G) => G.clearWatch({ id }));
        };
    }
    const id = navigator.geolocation.watchPosition(onFix, onError, options);
    return () => navigator.geolocation.clearWatch(id);
}

export const isPrecise = (loc) => !!loc && loc.accuracy != null && loc.accuracy <= APPROXIMATE_M;
