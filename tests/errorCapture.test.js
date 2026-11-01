import { describe, it, expect, vi, beforeAll } from 'vitest';

// The data layer is replaced: these tests are about what gets recorded, not
// about Firestore.
const recordHandledError = vi.fn(async () => {});
vi.mock('../src/data', () => ({ recordHandledError }));

import { isPermissionError, installErrorCapture } from '../src/utils/errorCapture';
import { isChunkLoadError } from '../src/utils/staleBuild';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('isPermissionError', () => {
    it('knows a Firestore refusal by code or by message', () => {
        expect(isPermissionError({ code: 'permission-denied', message: 'x' })).toBe(true);
        expect(isPermissionError(new Error('Missing or insufficient permissions.'))).toBe(true);
        expect(isPermissionError({ code: 'storage/unauthorized' })).toBe(true);
        expect(isPermissionError('FirebaseError: Missing or insufficient permissions.')).toBe(true);
    });

    it('ignores everything else', () => {
        expect(isPermissionError(new Error('Network error'))).toBe(false);
        expect(isPermissionError({ code: 'unavailable' })).toBe(false);
        expect(isPermissionError(null)).toBe(false);
    });
});

describe('installErrorCapture', () => {
    beforeAll(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        installErrorCapture();
    });

    it('records a refused save that a screen caught and logged, once per screen', async () => {
        window.__CURRENT_VIEW__ = 'courses';
        const err = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
        console.error('ERROR saving to Firestore:', err);
        console.error('ERROR saving to Firestore:', err);
        await flush(); await flush();
        expect(recordHandledError).toHaveBeenCalledTimes(1);
        const sent = recordHandledError.mock.calls[0][0];
        expect(sent.kind).toBe('permission');
        expect(sent.screen).toBe('courses');
        expect(sent.context).toBe('ERROR saving to Firestore:');
        expect(sent.what).toContain('Permission denied');
    });

    it('does not record ordinary errors', async () => {
        recordHandledError.mockClear();
        console.error('Something else broke', new Error('boom'));
        await flush();
        expect(recordHandledError).not.toHaveBeenCalled();
    });
});

describe('isChunkLoadError', () => {
    it('recognises a screen file that did not load', () => {
        expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/assets/Course-abc.js'))).toBe(true);
        expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/app.css'))).toBe(true);
        expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
        expect(isChunkLoadError(new Error('x is not a function'))).toBe(false);
    });
});
