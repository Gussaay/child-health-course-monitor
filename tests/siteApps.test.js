import { describe, it, expect } from 'vitest';
import { siteApkUrl, NATIVE_APP, SITE_APPS } from '../src/siteMode';
import { publicBaseUrl } from '../src/utils/publicLink';

// Each site has its own Android app; both are built in every release with the
// same version, and the EmONC APK is found from the NCHP APK's address.
const NCHP_URL = 'https://firebasestorage.googleapis.com/v0/b/imnci-courses-monitor.firebasestorage.app/o/apks%2FNational_Child_Health_Program_APP_v37.6.0.apk?alt=media';
const EMONC_APP = { package: 'com.nchp.monitoring.emonc', apkFilePrefix: 'EmONC_APP_v' };

describe('site apps', () => {
    it('the main site keeps the NCHP app and its APK address', () => {
        expect(NATIVE_APP.package).toBe('com.nchp.monitoring.app');
        expect(NATIVE_APP.updateManifest).toBe('latest/update.json');
        expect(siteApkUrl(NCHP_URL)).toBe(NCHP_URL);
    });

    it('the EmONC app downloads the EmONC APK of the same release', () => {
        expect(siteApkUrl(NCHP_URL, EMONC_APP)).toBe(NCHP_URL.replace('National_Child_Health_Program_APP_v', 'EmONC_APP_v'));
    });

    it('the ch-sudan app downloads its own APK and shares ch-sudan links', () => {
        expect(siteApkUrl(NCHP_URL, SITE_APPS.ch)).toContain('apks%2FCH_Sudan_APP_v37.6.0.apk');
        const appPage = { hostname: 'com.nchp.monitoring.app', origin: 'https://com.nchp.monitoring.app' };
        expect(publicBaseUrl(appPage, { ch: true })).toBe('https://ch-sudan.web.app');
        expect(publicBaseUrl(appPage, { emonc: true })).toBe('https://emonc-sudan.web.app');
        expect(publicBaseUrl(appPage)).toBe('https://imnci-courses-monitor.web.app');
    });

    it('no address gives no address', () => {
        expect(siteApkUrl('', EMONC_APP)).toBe('');
        expect(siteApkUrl(undefined)).toBe('');
    });
});
