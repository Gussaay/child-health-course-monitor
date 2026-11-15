import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

const { appIntentUrl, shouldShowGetAppBanner } = await import('../src/components/GetAppBanner.jsx');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

describe('get-the-app banner', () => {
    const base = { native: false, userAgent: ANDROID, pathname: '/public/survey/abc', dismissedAt: null, now: 1_000_000_000_000 };
    it('shows on a shared link in an Android browser', () => {
        expect(shouldShowGetAppBanner(base)).toBe(true);
        expect(shouldShowGetAppBanner({ ...base, pathname: '/monitor/course/c1' })).toBe(true);
    });
    it('stays hidden inside the app, on other phones and on non-shared pages', () => {
        expect(shouldShowGetAppBanner({ ...base, native: true })).toBe(false);
        expect(shouldShowGetAppBanner({ ...base, userAgent: IPHONE })).toBe(false);
        expect(shouldShowGetAppBanner({ ...base, pathname: '/' })).toBe(false);
        expect(shouldShowGetAppBanner({ ...base, pathname: '/training/c1' })).toBe(false);
    });
    it('stays hidden for a week after it is closed', () => {
        const day = 24 * 60 * 60 * 1000;
        expect(shouldShowGetAppBanner({ ...base, dismissedAt: String(base.now - day) })).toBe(false);
        expect(shouldShowGetAppBanner({ ...base, dismissedAt: String(base.now - 8 * day) })).toBe(true);
    });
});

describe('open-in-app link', () => {
    it('opens the same page of the same site in the app, else downloads it', () => {
        expect(appIntentUrl('https://emonc-sudan.web.app/public/survey/abc?state=Kassala', 'https://x/app.apk?alt=media'))
            .toBe('intent://emonc-sudan.web.app/public/survey/abc?state=Kassala#Intent;scheme=https;package=com.nchp.monitoring.app;S.browser_fallback_url=https%3A%2F%2Fx%2Fapp.apk%3Falt%3Dmedia;end');
    });
    it('gives no link off the live sites', () => {
        expect(appIntentUrl('http://localhost:5173/public/survey/abc', '')).toBe('');
    });
});
