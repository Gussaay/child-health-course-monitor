// src/utils/otaPreflight.js
//
// Is the update file the manifest points at actually there, and is it
// really the zip?
//
// Admin → Problems, 20/11/2026: an over-the-air download failed with
// "ID1ID2: actual 0x000027bd != expected …" — the phone had downloaded
// something that was not a zip at all and the updater only found out when
// it tried to open it. When the zip is missing, the hosting rewrite
// answers with the app's index.html and a 200, so the download "succeeds"
// and the failure surfaces later as a corrupt bundle, a rollback, and a
// frightening error report.
//
// A HEAD request settles it before the download starts: the file must
// exist and must not come back as HTML. The deploy workflow makes the
// same check from the server side after each release; this is the phone
// protecting itself against a bad or half-finished upload either way.

/**
 * @param {string} url  the bundle URL from the update manifest
 * @param {Function} [fetchFn]  injectable for tests
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
 */
export async function checkBundleReachable(url, fetchFn = fetch) {
    if (!url) return { ok: false, reason: 'no-url' };
    let res;
    try {
        res = await fetchFn(url, { method: 'HEAD' });
    } catch {
        return { ok: false, reason: 'network' };
    }
    if (!res || !res.ok) return { ok: false, reason: `http-${res?.status ?? 'error'}` };
    const type = String(res.headers?.get?.('content-type') || '').toLowerCase();
    if (type.includes('text/html')) return { ok: false, reason: 'html-instead-of-zip' };
    return { ok: true };
}
