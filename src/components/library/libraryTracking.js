// Child Health Library usage: recording what people do in the library, and
// reading it back for the dashboard.
//
// Each visit, item view, download (open) and share is one document in
// `libraryEvents`. Anyone may add an event (the library is public); only
// federal managers and super users may read them (firestore.rules), so the
// names and e-mails of signed-in users never reach the public.
//
// "Where" comes from the signed-in user's own state and locality, and for
// everyone from the device's time zone (no location permission is asked for).
// "Who" is the signed-in account, or else an anonymous id kept on the device
// so repeat downloads by one person are counted once as a downloader.
import { db } from '../../firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

export const LIBRARY_EVENTS = 'libraryEvents';
const DEVICE_KEY = 'chLibraryDeviceId';

function deviceId() {
    try {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = (crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).slice(0, 40);
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return 'no-storage';
    }
}

function platform() {
    try {
        const p = Capacitor.getPlatform();
        if (p === 'android') return 'Android app';
        if (p === 'ios') return 'iPhone app';
    } catch { /* web */ }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    if (/Android/i.test(ua)) return 'Android browser';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone browser';
    return 'Computer browser';
}

function referrerHost() {
    try {
        if (!document.referrer) return '';
        const host = new URL(document.referrer).hostname;
        return host === window.location.hostname ? '' : host.slice(0, 100);
    } catch {
        return '';
    }
}

const str = (v, n = 200) => String(v ?? '').slice(0, n);

/**
 * Records one event; never throws and never waits on the network (an offline
 * phone queues it). `viewer` is the signed-in user ({ uid, email, name, role,
 * state, locality }) or null; `entry` is 'app' (inside the app) or 'link'
 * (opened from a shared /public/library address).
 */
export function recordLibraryEvent(type, { item = null, viewer = null, entry = 'app' } = {}) {
    try {
        let tz = '';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* old browser */ }
        const signedIn = !!viewer?.uid;
        const event = {
            type,
            itemId: str(item?.id, 128),
            itemName: str(item?.name),
            service: str(item?.service, 100),
            category: str(item?.category, 40),
            at: serverTimestamp(),
            deviceId: deviceId(),
            signedIn,
            uid: signedIn ? str(viewer.uid, 128) : '',
            email: signedIn ? str(viewer.email) : '',
            name: signedIn ? str(viewer.name) : '',
            role: signedIn ? str(viewer.role, 60) : '',
            state: signedIn ? str(viewer.state, 100) : '',
            locality: signedIn ? str(viewer.locality, 100) : '',
            entry: entry === 'link' ? 'link' : 'app',
            platform: platform(),
            tz: str(tz, 60),
            lang: str(typeof navigator !== 'undefined' ? navigator.language : '', 20),
            ref: referrerHost(),
        };
        addDoc(collection(db, LIBRARY_EVENTS), event).catch((e) => console.warn('[library] event not saved:', e?.message));
    } catch (e) {
        console.warn('[library] event not recorded:', e?.message);
    }
}

/** Events since `fromMs` (0 for all), oldest first. Federal managers and super users only. */
export async function listLibraryEvents(fromMs = 0) {
    const col = collection(db, LIBRARY_EVENTS);
    const q = fromMs > 0
        ? query(col, where('at', '>=', Timestamp.fromMillis(fromMs)), orderBy('at'))
        : query(col, orderBy('at'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
