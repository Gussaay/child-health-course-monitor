// Links the app hands out (WhatsApp, email, QR codes, copy boxes) are opened
// by people outside the app, so they must always point at a live site.
//
// On a live site the link keeps that site's own address: a link made on the
// EmONC site opens the EmONC site, one made on ch-sudan opens ch-sudan.
// Inside the Android app the page address is the app's own internal one
// (https://com.nchp.monitoring.app), and on a test computer it is
// http://localhost; neither opens for anyone else, so those use the site the
// app is: the main site (or the EmONC site for `VITE_SITE=emonc`).
// Every site serves the same pages at the same paths, and the Android app
// opens links of all of them (see AndroidManifest.xml).
import { IS_EMONC_SITE } from '../siteMode';

export const LIVE_SITE = 'https://imnci-courses-monitor.web.app';
export const EMONC_LIVE_SITE = 'https://emonc-sudan.web.app';
export const LIVE_HOSTS = [
    'imnci-courses-monitor.web.app', 'imnci-courses-monitor.firebaseapp.com',
    'ch-sudan.web.app', 'ch-sudan.firebaseapp.com',
    'emonc-sudan.web.app', 'emonc-sudan.firebaseapp.com',
];

export function publicBaseUrl(location = typeof window !== 'undefined' ? window.location : null, { emonc = IS_EMONC_SITE } = {}) {
    if (location && LIVE_HOSTS.includes(location.hostname)) return location.origin;
    return emonc ? EMONC_LIVE_SITE : LIVE_SITE;
}

// The live-site version of the page currently open.
export function publicCurrentUrl(location = typeof window !== 'undefined' ? window.location : null, options) {
    if (!location) return publicBaseUrl(null, options);
    return `${publicBaseUrl(location, options)}${location.pathname}${location.search}`;
}
