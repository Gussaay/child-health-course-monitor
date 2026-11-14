// src/components/GetAppBanner.jsx
//
// A shared link (survey, evaluation, test, attendance, monitoring ...) opened
// in a phone's browser. When the Android app is installed, Android opens these
// links in the app itself (App Links, see AndroidManifest.xml), so a link that
// lands in the browser usually means the app is not on this phone. This bar
// offers the app and leaves the form usable underneath:
//   Open in the app   opens this same page in the app if it is installed,
//                     otherwise downloads it (Chrome's intent:// link)
//   Get or update     downloads the latest APK (also for phones with an older APK,
//                     which does not open links yet)
//   ×                 hides the bar on this browser for a week
// Shown only in Android browsers, never inside the app, and never on a
// training link (that one stays in the browser on purpose).

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Smartphone, X } from 'lucide-react';
import { isPublicAppPath } from '../utils/appLinks';
import { LIVE_HOSTS, LIVE_SITE } from '../utils/publicLink';

export const APP_PACKAGE = 'com.nchp.monitoring.app';
const DISMISS_KEY = 'chm.getAppBanner.dismissedAt';
const DISMISS_DAYS = 7;

export function shouldShowGetAppBanner({ native, userAgent, pathname, dismissedAt, now = Date.now() }) {
    if (native) return false;
    if (!/Android/i.test(userAgent || '')) return false;
    if (!isPublicAppPath(pathname)) return false;
    const at = Number(dismissedAt) || 0;
    if (at && now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) return false;
    return true;
}

/**
 * Chrome on Android opens an intent:// link in the named app when it is
 * installed, and goes to the fallback address when it is not. Only the live
 * sites are claimed by the app, so anything else gets no link.
 */
export function appIntentUrl(href, fallbackUrl) {
    let url;
    try { url = new URL(href); } catch { return ''; }
    if (!LIVE_HOSTS.includes(url.hostname)) return '';
    const fallback = fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : '';
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${APP_PACKAGE};${fallback}end`;
}

function readDismissedAt() {
    try { return window.localStorage.getItem(DISMISS_KEY); } catch { return null; }
}

export default function GetAppBanner() {
    const { i18n } = useTranslation();
    const ar = (i18n.language || '').toLowerCase().startsWith('ar');
    const L = (a, e) => (ar ? a : e);
    const [visible, setVisible] = useState(() => typeof window !== 'undefined' && shouldShowGetAppBanner({
        native: Capacitor.isNativePlatform(),
        userAgent: navigator.userAgent,
        pathname: window.location.pathname,
        dismissedAt: readDismissedAt(),
    }));
    const [apkUrl, setApkUrl] = useState('');

    useEffect(() => {
        if (!visible) return undefined;
        let cancelled = false;
        // Every site serves this file; the main site is asked if this one cannot be.
        const read = (base) => fetch(`${base}/native-version.json?t=${Date.now()}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
        read('').catch(() => read(LIVE_SITE))
            .then((info) => { if (!cancelled) setApkUrl(info?.apkUrl || info?.downloadUrl || ''); })
            .catch(() => { /* no download button then */ });
        return () => { cancelled = true; };
    }, [visible]);

    if (!visible) return null;

    const dismiss = () => {
        try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* hidden for now only */ }
        setVisible(false);
    };
    const openUrl = appIntentUrl(window.location.href, apkUrl);

    return (
        <div dir={ar ? 'rtl' : 'ltr'} role="region" aria-label={L('تطبيق الهاتف', 'Phone app')}
            className="bg-sky-50 dark:bg-slate-900 border-b border-sky-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm">
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-[14rem]">
                    <Smartphone className="w-5 h-5 text-sky-700 dark:text-sky-300 shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 leading-snug">
                        {L('افتح هذا الرابط في تطبيق البرنامج القومي لصحة الطفل على هاتفك.', 'Open this link in the Child Health app on your phone.')}
                    </span>
                </div>
                <div className="flex items-center gap-2 ms-auto">
                    {openUrl && (
                        <a href={openUrl} className="px-3 py-1.5 rounded-lg border border-sky-700 text-sky-800 dark:text-sky-200 dark:border-sky-400 font-semibold whitespace-nowrap">
                            {L('فتح في التطبيق', 'Open in app')}
                        </a>
                    )}
                    {apkUrl && (
                        <a href={apkUrl} rel="noopener" className="px-3 py-1.5 rounded-lg bg-sky-700 text-white font-semibold whitespace-nowrap">
                            {L('تنزيل أو تحديث التطبيق', 'Get or update the app')}
                        </a>
                    )}
                    <button type="button" onClick={dismiss} aria-label={L('إخفاء', 'Hide')} title={L('إخفاء', 'Hide')}
                        className="p-1.5 rounded-full hover:bg-sky-100 dark:hover:bg-slate-800 shrink-0">
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
