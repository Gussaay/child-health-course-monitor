// src/components/GetAppBanner.jsx
//
// Every site has its own Android app (main: NCHP, emonc-sudan: EmONC,
// ch-sudan: Child Health Sudan). A phone that opens a site in its browser
// most likely does not have that site's app, so this bar offers it:
//   Open in the app   (shared links only) opens this same page in the app if
//                     it is installed, otherwise downloads it (intent:// link).
//                     Android opens these links in the app by itself (App
//                     Links, see AndroidManifest.xml), so landing here
//                     usually means the app is missing.
//   Get the app       downloads the latest APK of THIS site's app (also for
//                     phones with an older APK, which does not open links yet)
//   ×                 hides the bar on this browser for a week
// Shown only in Android browsers (the apps are Android only), never inside
// the app, and never on a training link (that one stays in the browser on
// purpose).

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Smartphone, X } from 'lucide-react';
import { isPublicAppPath } from '../utils/appLinks';
import { LIVE_HOSTS } from '../utils/publicLink';
import { fetchSiteApkUrl } from '../utils/shareApp';
import { NATIVE_APP, NATIVE_APP_TEXT } from '../siteMode';

// Each site offers its own app.
export const APP_PACKAGE = NATIVE_APP.package;
const DISMISS_KEY = 'chm.getAppBanner.dismissedAt';
const DISMISS_DAYS = 7;

export function shouldShowGetAppBanner({ native, userAgent, pathname, dismissedAt, now = Date.now() }) {
    if (native) return false;
    if (!/Android/i.test(userAgent || '')) return false;
    if (/^\/training(\/|$)/.test(String(pathname || ''))) return false;
    const at = Number(dismissedAt) || 0;
    if (at && now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) return false;
    return true;
}

/**
 * Chrome on Android opens an intent:// link in the named app when it is
 * installed, and goes to the fallback address when it is not. Only the live
 * sites are claimed by the app, so anything else gets no link.
 */
export function appIntentUrl(href, fallbackUrl, appPackage = APP_PACKAGE) {
    let url;
    try { url = new URL(href); } catch { return ''; }
    if (!LIVE_HOSTS.includes(url.hostname)) return '';
    const fallback = fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : '';
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=${appPackage};${fallback}end`;
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
        // This site's app's file; no download button if it cannot be read.
        fetchSiteApkUrl().then((url) => { if (!cancelled) setApkUrl(url); });
        return () => { cancelled = true; };
    }, [visible]);

    if (!visible) return null;

    const dismiss = () => {
        try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* hidden for now only */ }
        setVisible(false);
    };
    // Only shared links are claimed by the app; other pages just get the download.
    const sharedLink = isPublicAppPath(window.location.pathname);
    const openUrl = sharedLink ? appIntentUrl(window.location.href, apkUrl) : '';
    const name = ar ? NATIVE_APP_TEXT.titleAr : NATIVE_APP_TEXT.title;
    const subtitle = ar ? NATIVE_APP_TEXT.subtitleAr : NATIVE_APP_TEXT.subtitle;

    return (
        <div dir={ar ? 'rtl' : 'ltr'} role="region" aria-label={L('تطبيق الهاتف', 'Phone app')}
            className="bg-sky-50 dark:bg-slate-900 border-b border-sky-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm">
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-[14rem]">
                    <Smartphone className="w-5 h-5 text-sky-700 dark:text-sky-300 shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0 leading-snug">
                        <span className="block font-semibold">
                            {sharedLink
                                ? L(`افتح هذا الرابط في تطبيق ${name}`, `Open this link in the ${name} app`)
                                : L(`ثبّت تطبيق ${name} على هاتفك`, `Get the ${name} app on your phone`)}
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-300">{subtitle}</span>
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
                            {L('تنزيل التطبيق', 'Get the app')}
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
