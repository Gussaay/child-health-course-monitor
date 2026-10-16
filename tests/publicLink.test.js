import { describe, expect, it } from 'vitest';
import { LIVE_SITE, publicBaseUrl, publicCurrentUrl } from '../src/utils/publicLink';

describe('public links', () => {
    it('keeps the live address when already on it', () => {
        expect(publicBaseUrl({ hostname: 'imnci-courses-monitor.firebaseapp.com', origin: 'https://imnci-courses-monitor.firebaseapp.com' })).toBe('https://imnci-courses-monitor.firebaseapp.com');
    });
    it('uses the live site inside the Android app and on a test computer', () => {
        expect(publicBaseUrl({ hostname: 'com.nchp.monitoring.app', origin: 'https://com.nchp.monitoring.app' })).toBe(LIVE_SITE);
        expect(publicBaseUrl({ hostname: 'localhost', origin: 'http://localhost:5173' })).toBe(LIVE_SITE);
    });
    it('rebuilds the open page on the live site', () => {
        expect(publicCurrentUrl({ hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/public/profile/team/state/x', search: '?a=1' }))
            .toBe(`${LIVE_SITE}/public/profile/team/state/x?a=1`);
    });
});
