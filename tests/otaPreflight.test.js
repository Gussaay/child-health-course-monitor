// otaPreflight (src/utils/otaPreflight.js): the phone must not start
// downloading an "update" that is actually the app's index.html — that
// was the 20/11/2026 "ID1ID2" corrupt-bundle failure in Admin → Problems.
import { describe, it, expect } from 'vitest';
import { checkBundleReachable } from '../src/utils/otaPreflight';

const head = (status, type) => async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => (n === 'content-type' ? type : null) },
});

describe('checkBundleReachable', () => {
    it('accepts a real zip', async () => {
        expect(await checkBundleReachable('https://x/latest/update.zip', head(200, 'application/zip'))).toEqual({ ok: true });
    });

    it('rejects the HTML the hosting rewrite serves for a missing zip', async () => {
        const res = await checkBundleReachable('https://x/latest/update.zip', head(200, 'text/html; charset=utf-8'));
        expect(res.ok).toBe(false);
        expect(res.reason).toBe('html-instead-of-zip');
    });

    it('rejects a missing file and a network failure', async () => {
        expect((await checkBundleReachable('https://x/u.zip', head(404, 'text/plain'))).ok).toBe(false);
        expect(await checkBundleReachable('https://x/u.zip', async () => { throw new Error('offline'); }))
            .toEqual({ ok: false, reason: 'network' });
        expect(await checkBundleReachable('')).toEqual({ ok: false, reason: 'no-url' });
    });

    it('asks with HEAD, so the check itself downloads nothing', async () => {
        let method = null;
        await checkBundleReachable('https://x/u.zip', async (url, opts) => {
            method = opts.method;
            return { ok: true, status: 200, headers: { get: () => 'application/zip' } };
        });
        expect(method).toBe('HEAD');
    });
});
