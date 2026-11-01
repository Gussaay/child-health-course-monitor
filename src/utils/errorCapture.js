// src/utils/errorCapture.js
//
// Puts errors the app handled itself into Admin → Problems.
//
// The error boundary records crashes, but most failures never crash: a save
// that the database refuses ("Missing or insufficient permissions") is caught,
// shown as a toast, and gone. The team only heard about those when somebody
// sent a screenshot. Every catch block in the app already logs with
// console.error, so watching console.error (and unhandled promise rejections)
// catches them all without touching each screen.
//
// Recorded: permission refusals from Firestore and Storage. Each one carries
// the screen, the address, what the app was doing (the console message) and the
// account's role, which is the first question every time.
//
// Kept quiet on purpose: the same error on the same screen is recorded once per
// ten minutes, at most 15 a session, and nothing is sent when nobody is signed
// in (the rules only accept a report from a signed-in account).

const SAME_ERROR_GAP_MS = 10 * 60 * 1000;
const MAX_PER_SESSION = 15;

const recent = new Map();
let sentThisSession = 0;
let installed = false;

/** True for a Firestore/Storage refusal, whatever shape it arrives in. */
export function isPermissionError(err) {
    if (!err) return false;
    const code = String(err.code || '');
    if (code === 'permission-denied' || code === 'firestore/permission-denied' || code === 'storage/unauthorized') return true;
    const text = String(err.message || (typeof err === 'string' ? err : ''));
    return /Missing or insufficient permissions|PERMISSION_DENIED|User does not have permission/i.test(text);
}

/** What the app was doing, from the words logged next to the error. */
function contextFrom(args) {
    return args
        .filter((a) => typeof a === 'string')
        .join(' ')
        .replace(/%[sdoOc]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
}

function currentScreen() {
    if (typeof window === 'undefined') return null;
    return window.__CURRENT_VIEW__ || null;
}

async function record(err, context, source) {
    const screen = currentScreen();
    const path = `${window.location.pathname}${window.location.search}`.slice(0, 200);
    const key = `${context}|${screen}|${window.location.pathname}`;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < SAME_ERROR_GAP_MS) return;
    if (sentThisSession >= MAX_PER_SESSION) return;
    recent.set(key, now);
    sentThisSession += 1;

    try {
        // Loaded when needed: this file runs before the app, and the data layer
        // must not be pulled into the first script for it.
        const { recordHandledError } = await import('../data');
        await recordHandledError({
            kind: 'permission',
            what: `Permission denied${context ? `: ${context}` : ''}`.slice(0, 300),
            errorCode: String(err?.code || 'permission-denied'),
            context: context || null,
            source,
            screen,
            path,
            stack: `${err?.message || err}\n${err?.stack || ''}`.slice(0, 4000),
        });
    } catch {
        // Reporting must never add a second failure to the first.
    }
}

/** Starts watching. Safe to call more than once. */
export function installErrorCapture() {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    const original = console.error.bind(console);
    console.error = (...args) => {
        original(...args);
        try {
            const err = args.find((a) => a && typeof a === 'object' && isPermissionError(a))
                || (args.some((a) => typeof a === 'string' && isPermissionError(a)) ? new Error(contextFrom(args)) : null);
            if (err) record(err, contextFrom(args), 'handled');
        } catch { /* never break logging */ }
    };

    window.addEventListener('unhandledrejection', (event) => {
        try {
            if (isPermissionError(event.reason)) record(event.reason, '', 'unhandled');
        } catch { /* ignore */ }
    });
}
