import { describe, expect, it } from 'vitest';
import { EMONC_LIVE_SITE, LIVE_SITE, publicBaseUrl, publicCurrentUrl } from '../src/utils/publicLink';

const at = (origin) => ({ hostname: new URL(origin).hostname, origin });

describe('public links', () => {
    it('keeps the live address when already on it', () => {
        expect(publicBaseUrl(at('https://imnci-courses-monitor.firebaseapp.com'))).toBe('https://imnci-courses-monitor.firebaseapp.com');
    });
    it('keeps the address of the site the link was made on', () => {
        expect(publicBaseUrl(at('https://emonc-sudan.web.app'))).toBe('https://emonc-sudan.web.app');
        expect(publicBaseUrl(at('https://ch-sudan.web.app'))).toBe('https://ch-sudan.web.app');
        expect(publicBaseUrl(at('https://imnci-courses-monitor.web.app'))).toBe(LIVE_SITE);
    });
    it('uses the live site inside the Android app and on a test computer', () => {
        expect(publicBaseUrl(at('https://com.nchp.monitoring.app'))).toBe(LIVE_SITE);
        expect(publicBaseUrl(at('http://localhost:5173'))).toBe(LIVE_SITE);
    });
    it('uses the EmONC site when testing the EmONC site locally', () => {
        expect(publicBaseUrl(at('http://localhost:5173'), { emonc: true })).toBe(EMONC_LIVE_SITE);
        expect(publicBaseUrl(at('https://emonc-sudan.firebaseapp.com'), { emonc: true })).toBe('https://emonc-sudan.firebaseapp.com');
    });
    it('rebuilds the open page on the live site', () => {
        expect(publicCurrentUrl({ hostname: 'localhost', origin: 'http://localhost:5173', pathname: '/public/profile/team/state/x', search: '?a=1' }))
            .toBe(`${LIVE_SITE}/public/profile/team/state/x?a=1`);
    });
});

describe('links opened in the app', async () => {
    const { parseScannedCode } = await import('../src/utils/appLinks');
    it('opens a shared link of any site by its path', () => {
        for (const host of ['imnci-courses-monitor.web.app', 'ch-sudan.web.app', 'emonc-sudan.web.app']) {
            expect(parseScannedCode(`https://${host}/public/survey/s1?state=Kassala`)).toMatchObject({ type: 'app', path: '/public/survey/s1?state=Kassala', public: true });
        }
    });
});
