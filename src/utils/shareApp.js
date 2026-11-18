// "Share the app": sends this site's own Android app to another phone.
//
// Inside the Android app the installed APK itself goes to the share sheet
// (AppSharePlugin.java), so it can be sent by Bluetooth, WhatsApp, Nearby
// Share ... even without internet. Each app shares itself: the NCHP app the
// NCHP APK, the EmONC app the EmONC APK, the ch-sudan app the ch-sudan APK.
// An APK installed before this button existed has no plugin, and a browser
// cannot send a file it does not have, so both share the download link of
// this site's app instead.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { NATIVE_APP, NATIVE_APP_TEXT } from '../siteMode';
import { publicBaseUrl, LIVE_SITE } from './publicLink';
import { shareText } from './sharePdf';

const AppShare = registerPlugin('AppShare');

const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');

/**
 * The download link of this site's latest APK, from the site's
 * native-version file (deploy.yml writes one per app). '' when unknown.
 */
export async function fetchSiteApkUrl(app = NATIVE_APP) {
    const read = (base) => fetch(`${base}/${app.versionFile}?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    const own = publicBaseUrl();
    try {
        const info = await read(own).catch((e) => (own !== LIVE_SITE ? read(LIVE_SITE) : Promise.reject(e)));
        return info?.apkUrl || info?.downloadUrl || '';
    } catch {
        return '';
    }
}

/** The message that goes with the app, in Arabic or English. */
export function shareAppMessage({ ar = false, apkUrl = '', siteUrl = '', text = NATIVE_APP_TEXT } = {}) {
    const name = ar ? `${text.titleAr} – ${text.subtitleAr}` : `${text.title} – ${text.subtitle}`;
    const lines = [ar ? `تطبيق ${name}` : `${name} app`];
    if (apkUrl) lines.push(ar ? `تنزيل التطبيق (أندرويد): ${apkUrl}` : `Download the app (Android): ${apkUrl}`);
    if (siteUrl) lines.push(ar ? `أو افتحه في المتصفح: ${siteUrl}` : `Or open it in a browser: ${siteUrl}`);
    return lines.join('\n');
}

// "CH-Sudan-v3.2.apk": the name the other phone sees.
export const shareAppFileName = (version, app = NATIVE_APP) =>
    `${app.downloadName}${version ? `-v${String(version).replace(/[^\w.-]/g, '')}` : ''}.apk`;

/**
 * Returns 'shared' (the share sheet opened), 'cancelled', or 'copied' (the
 * link was copied where nothing can share).
 */
export async function shareApp({ ar = false, version = '' } = {}) {
    const title = ar ? `مشاركة تطبيق ${NATIVE_APP_TEXT.titleAr}` : `Share the ${NATIVE_APP_TEXT.title} app`;
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AppShare')) {
        try {
            await AppShare.shareApk({
                fileName: shareAppFileName(version),
                title,
                text: shareAppMessage({ ar }),
            });
            return 'shared';
        } catch (e) {
            if (isCancel(e)) return 'cancelled';
            // Fall through to the link: better than nothing.
            console.warn('Sharing the APK failed, sharing the link instead', e);
        }
    }
    const apkUrl = await fetchSiteApkUrl();
    return shareText(shareAppMessage({ ar, apkUrl, siteUrl: publicBaseUrl() }), { title });
}
