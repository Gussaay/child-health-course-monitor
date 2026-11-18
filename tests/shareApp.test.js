import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, isPluginAvailable: () => false }, registerPlugin: () => ({}) }));

const { shareAppMessage, shareAppFileName } = await import('../src/utils/shareApp.js');
const { SITE_APPS, SITE_APP_TEXT } = await import('../src/siteMode.js');

describe('share the app', () => {
    it('names the APK after its own app', () => {
        expect(shareAppFileName('3.2', SITE_APPS.ch)).toBe('CH-Sudan-v3.2.apk');
        expect(shareAppFileName('', SITE_APPS.emonc)).toBe('EmONC.apk');
    });
    it('gives the ch-sudan app its subtitle', () => {
        expect(SITE_APP_TEXT.ch.subtitle).toBe('Online Course and Guidelines');
        const msg = shareAppMessage({ apkUrl: 'https://x/CH_Sudan_APP_v3.2.apk', siteUrl: 'https://ch-sudan.web.app', text: SITE_APP_TEXT.ch });
        expect(msg).toContain('Child Health Sudan – Online Course and Guidelines app');
        expect(msg).toContain('https://x/CH_Sudan_APP_v3.2.apk');
        expect(msg).toContain('https://ch-sudan.web.app');
        expect(shareAppMessage({ ar: true, text: SITE_APP_TEXT.ch })).toContain('الدورة الإلكترونية والموجهات');
    });
    it('every app has its own text', () => {
        Object.keys(SITE_APPS).forEach((id) => expect(SITE_APP_TEXT[id]?.title).toBeTruthy());
    });
});
