// src/utils/lazyWithRetry.js
//
// Screens load lazily: opening one downloads its code file at that moment.
// On the connections this app is used on, that download fails transiently
// all the time — a dropped packet, a tunnel, a moment of no signal — and a
// plain React.lazy turns one dropped download into a crashed screen and a
// crash report in Admin → Problems. "Failed to fetch dynamically imported
// module" and its variants are the largest single family in those reports.
//
// This wrapper retries a failed screen download before giving up: three
// attempts in total, with a short wait between them. Only load failures are
// retried — a real bug in the screen's code (a name that does not exist, a
// value of the wrong type) throws on the first attempt, unchanged.
//
// What this does NOT do, on purpose:
//   - A file that is genuinely gone (the running release was replaced and
//     its files are no longer served) fails every attempt. The error is
//     then thrown as before, and the error boundary's stale-build recovery
//     (utils/staleBuild.js) reloads the app onto the current release. The
//     deploy also keeps the previous 7 days of files on the server
//     (.github/workflows/deploy.yml), so this should now be rare.
//   - A download that "succeeds" with no module in it (the old preload
//     failure behind the "can't access property …, t is undefined" and
//     React error #130 reports) is treated as a load failure, retried, and
//     finally thrown as a load error the recovery understands — instead of
//     an undefined component crashing the screen.

import { lazy } from 'react';
import { isChunkLoadError } from './staleBuild';

const RETRY_DELAYS_MS = [800, 2500];

/** True when an import failure is worth trying again: the file did not arrive. */
export function isRetriableLoadError(err) {
    if (isChunkLoadError(err)) return true;
    const text = String(err?.message || err || '');
    return /failed to fetch|network ?error|load failed|fetch.*abort/i.test(text);
}

function emptyModuleError() {
    // Worded so isChunkLoadError() recognises it and the error boundary
    // offers the stale-build reload rather than a plain bug screen.
    return new Error('Failed to fetch dynamically imported module: module was empty');
}

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `factory` (a dynamic import) until it yields a module, retrying load
 * failures. `wait` is injectable so tests do not sit through the delays.
 */
export async function loadWithRetry(factory, { retries = RETRY_DELAYS_MS.length, delays = RETRY_DELAYS_MS, wait = defaultWait } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const mod = await factory();
            if (mod == null) throw emptyModuleError();
            return mod;
        } catch (err) {
            lastError = err;
            if (attempt >= retries || !isRetriableLoadError(err)) throw err;
            await wait(delays[Math.min(attempt, delays.length - 1)] ?? 1000);
        }
    }
    throw lastError;
}

/** React.lazy, with loadWithRetry around the import. Same call shape. */
export function lazyWithRetry(factory, options) {
    return lazy(() => loadWithRetry(factory, options));
}
