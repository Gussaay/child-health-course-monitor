import { describe, it, expect } from 'vitest';
import { explainError, devLoadFailureReason } from '../src/utils/explainError.js';

describe('explainError', () => {
    it('names the missing package and the file that imports it', () => {
        const e = new Error('[plugin:vite:import-analysis] Failed to resolve import "@capacitor/share" from "src/utils/sharePdf.js". Does the file exist?');
        expect(explainError(e)).toEqual({ kind: 'missing_package', detail: '@capacitor/share', file: 'src/utils/sharePdf.js' });
    });
    it('spots a part of the app that could not be downloaded', () => {
        const r = explainError(new TypeError('Failed to fetch dynamically imported module: http://localhost:5173/src/components/CertificateGenerator.jsx?t=1'));
        expect(r.kind).toBe('module_load');
        expect(r.url).toBe('http://localhost:5173/src/components/CertificateGenerator.jsx?t=1');
        expect(explainError(new Error('Loading chunk 42 failed.')).kind).toBe('module_load');
    });
    it('spots permission and network problems', () => {
        expect(explainError(new Error('Missing or insufficient permissions.')).kind).toBe('permission');
        expect(explainError(new Error('Failed to fetch')).kind).toBe('network');
        expect(explainError(new Error('Firestore is unavailable')).kind).toBe('network');
    });
    it('treats anything else as a bug in the screen', () => {
        expect(explainError(new TypeError("Cannot read properties of undefined (reading 'map')")).kind).toBe('bug');
        expect(explainError(null).kind).toBe('bug');
    });
});

describe('devLoadFailureReason', () => {
    const fakeFetch = (status, body) => async () => ({ ok: status < 400, text: async () => body });
    it('returns the dev server message for a failed module', async () => {
        const body = JSON.stringify({ message: 'Failed to resolve import "@capacitor/share" from "src/utils/sharePdf.js".' });
        expect(await devLoadFailureReason('http://x/a.js', fakeFetch(500, body))).toContain('@capacitor/share');
    });
    it('reads the message out of the Vite error page', async () => {
        const page = '<html><script type="module">\n              const error = {"message":"Failed to resolve import \\"@capacitor/share\\" from \\"src/utils/sharePdf.js\\". Does the file exist?","stack":"x"}\n</script></html>';
        const reason = await devLoadFailureReason('http://x/a.js', fakeFetch(500, page));
        expect(reason).toBe('Failed to resolve import "@capacitor/share" from "src/utils/sharePdf.js". Does the file exist?');
        expect(explainError(new Error(reason)).kind).toBe('missing_package');
    });
    it('returns null when the module loads or nothing can be fetched', async () => {
        expect(await devLoadFailureReason('http://x/a.js', fakeFetch(200, 'ok'))).toBeNull();
        expect(await devLoadFailureReason(null, fakeFetch(500, 'x'))).toBeNull();
        expect(await devLoadFailureReason('http://x/a.js', async () => { throw new Error('offline'); })).toBeNull();
    });
});
