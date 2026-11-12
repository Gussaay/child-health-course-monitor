// Reading the app's own links out of a scanned QR code.
//
// The app hands out links from several addresses, and a QR code printed last
// year may carry any of them:
//   imnci-courses-monitor.web.app / .firebaseapp.com   the main site
//   ch-sudan.web.app / .firebaseapp.com                 the same app, second site
//   emonc-sudan.web.app / .firebaseapp.com              the EmONC site
//   com.nchp.monitoring.app                             the Android app's own address
//   localhost                                           a test computer
// Every one of them serves the same pages at the same paths, so a scanned link
// is recognised by its address, then opened in the app by its path alone.

export const APP_LINK_HOSTS = [
    'imnci-courses-monitor.web.app', 'imnci-courses-monitor.firebaseapp.com',
    'ch-sudan.web.app', 'ch-sudan.firebaseapp.com',
    'emonc-sudan.web.app', 'emonc-sudan.firebaseapp.com',
    'com.nchp.monitoring.app',
    'localhost', '127.0.0.1',
];

// Public pages: each one is opened by App.jsx straight from its path, signed in
// or not. `kind` names it for the scanner's "Opening ..." line.
const PUBLIC_ROUTES = [
    [/^\/public\/test\/course\/[\w-]+\/?$/, 'test'],
    [/^\/public\/evaluation\/[\w-]+\/?$/, 'evaluation'],
    [/^\/attendance\/course\/[\w-]+\/?$/, 'attendance'],
    [/^\/public\/register\/course\/[\w-]+\/?$/, 'registration'],
    [/^\/public\/exercises\/course\/[\w-]+\/?$/, 'exercises'],
    [/^\/monitor\/course\/[\w-]+\/?$/, 'monitoring'],
    [/^\/verify\/certificate\/[\w-]+\/?$/, 'certificate'],
    [/^\/public\/certificate\/download\/[\w-]+\/?$/, 'certificate'],
    [/^\/public\/course\/certificates\/[\w-]+\/?$/, 'certificate'],
    [/^\/mentorship\/submit\/\w+\/?$/, 'mentorship'],
    [/^\/public\/mentorship\/(dashboard|record)\//, 'mentorship'],
    [/^\/public\/supervision\/\w+\/?$/, 'supervision'],
    [/^\/public\/meeting\/[\w-]+\/?$/, 'meeting'],
    [/^\/facilities\/data-entry\/[\w-]+\/?$/, 'facility'],
    [/^\/public\/bulk-update\/?$/, 'facility'],
    [/^\/public\/report\/(course|facilitator)\/[\w-]+\/?$/, 'report'],
    [/^\/public\/profile\/team\//, 'profile'],
    [/^\/public\/projects\/?$/, 'projects'],
    [/^\/public\/(facilitator|team-member)-application\/?$/, 'application'],
];

// Paths App.jsx treats as public pages rather than the signed-in app's own.
export function isPublicAppPath(pathname) {
    const path = String(pathname || '');
    return ['/submit/', '/public/', '/facilities/', '/monitor/', '/verify/', '/mentorship/', '/attendance/']
        .some((prefix) => path.startsWith(prefix));
}

function toUrl(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return new URL(raw);
        // "imnci-courses-monitor.web.app/public/..." printed without https://
        if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(raw)) return new URL(`https://${raw}`);
    } catch {
        return null;
    }
    return null;
}

/**
 * What a scanned code holds.
 *   { type: 'app', path, kind, testType }   one of the app's pages; open `path` in the app
 *   { type: 'web', url }                    any other web address
 *   { type: 'text', text }                  anything else
 */
export function parseScannedCode(text) {
    const raw = String(text || '').trim();
    const url = toUrl(raw);
    if (!url || !/^https?:$/.test(url.protocol)) {
        return url ? { type: 'web', url: url.href } : { type: 'text', text: raw };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!APP_LINK_HOSTS.includes(host)) return { type: 'web', url: url.href };

    const pathname = url.pathname.replace(/\/{2,}/g, '/') || '/';
    const path = `${pathname}${url.search}`;
    // A shared Project Tracker link is the home address with ?view=dashboard,
    // ?tab=active|completed or ?project=... (see handlePathChange in App.jsx).
    const q = url.searchParams;
    if (pathname === '/' && (q.get('view') === 'dashboard' || ['active', 'completed'].includes(q.get('tab')) || q.has('project'))) {
        return { type: 'app', path, kind: 'projects', public: true, testType: '' };
    }
    const route = PUBLIC_ROUTES.find(([re]) => re.test(pathname));
    if (route) {
        return { type: 'app', path, kind: route[1], public: true, testType: route[1] === 'test' ? url.searchParams.get('type') || '' : '' };
    }
    // Any other page of the app (/courses/..., /dashboard, ?view=planning ...):
    // the signed-in app opens it from the address.
    return { type: 'app', path, kind: 'page', public: isPublicAppPath(pathname) };
}
