// Sharing a library link (the whole library, a service, a section or one
// item) through the phone's share sheet, or copying it where nothing can share.
import { publicBaseUrl } from '../../utils/publicLink';
import { libraryPath } from './libraryModel';

export function libraryShareUrl(target) {
    return `${publicBaseUrl()}${libraryPath(target)}`;
}

/** Returns 'shared', 'copied', 'cancelled' or 'failed'. */
export async function shareLibraryLink(target, { title = '', text = '' } = {}) {
    const url = libraryShareUrl(target);
    const message = text || title;
    const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');
    try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
            const { Share } = await import('@capacitor/share');
            await Share.share({ title, text: message, url, dialogTitle: title });
            return 'shared';
        }
        if (navigator.share) {
            await navigator.share({ title, text: message, url });
            return 'shared';
        }
    } catch (e) {
        if (isCancel(e)) return 'cancelled';
    }
    try {
        await navigator.clipboard.writeText(message ? `${message}\n${url}` : url);
        return 'copied';
    } catch {
        return 'failed';
    }
}
