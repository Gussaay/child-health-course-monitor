// Links the app hands out (WhatsApp, email, QR codes, copy boxes) are opened
// by people outside the app, so they must always point at the live site.
// Inside the Android app the page address is the app's own internal one
// (https://com.nchp.monitoring.app), and on a test computer it is
// http://localhost; neither opens for anyone else.
export const LIVE_SITE = 'https://imnci-courses-monitor.web.app';
const LIVE_HOSTS = ['imnci-courses-monitor.web.app', 'imnci-courses-monitor.firebaseapp.com'];

export function publicBaseUrl(location = typeof window !== 'undefined' ? window.location : null) {
    if (location && LIVE_HOSTS.includes(location.hostname)) return location.origin;
    return LIVE_SITE;
}

// The live-site version of the page currently open.
export function publicCurrentUrl(location = typeof window !== 'undefined' ? window.location : null) {
    if (!location) return LIVE_SITE;
    return `${publicBaseUrl(location)}${location.pathname}${location.search}`;
}
