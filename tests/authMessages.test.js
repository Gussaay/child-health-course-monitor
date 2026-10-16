import { describe, expect, it } from 'vitest';
import { authErrorCode, authErrorKey } from '../src/utils/authMessages';

describe('sign-in error messages', () => {
    it('maps Firebase codes to friendly message keys', () => {
        expect(authErrorKey({ code: 'auth/popup-closed-by-user' })).toBe('google_closed');
        expect(authErrorKey({ code: 'auth/invalid-credential' })).toBe('wrong_password');
        expect(authErrorKey({ code: 'auth/network-request-failed' })).toBe('network');
    });

    it('reads the code from a raw Firebase message', () => {
        const err = new Error('Firebase: Error (auth/too-many-requests).');
        expect(authErrorKey(err)).toBe('too_many');
        expect(authErrorCode(err)).toBe('auth/too-many-requests');
    });

    it('falls back to a generic message', () => {
        expect(authErrorKey(new Error('Something odd'))).toBe('generic');
        expect(authErrorKey(null)).toBe('generic');
    });
});
