// Share a PDF (given as base64), another file or text through the phone's
// share sheet, so the user can pick WhatsApp and a chat. Inside the Android
// app a file is written to the app cache first, because the app's web view
// cannot share files itself. Where nothing can share files (most desktop
// browsers) the file is downloaded so it can be attached by hand. Returns
// 'shared', 'downloaded' or 'cancelled'.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');

const base64ToFile = (base64, fileName, type) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new File([bytes], fileName, { type });
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

/** Any file (a Blob) through the share sheet, the same way as a PDF below. */
export async function shareFile(blob, fileName, { title = '', text = '' } = {}) {
    if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
        try {
            await Share.share({ title, text, files: [uri], dialogTitle: title });
            return 'shared';
        } catch (e) {
            if (isCancel(e)) return 'cancelled';
            throw e;
        }
    }

    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title, text });
            return 'shared';
        } catch (e) {
            if (isCancel(e)) return 'cancelled';
            throw e;
        }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
}

export const sharePdf = (base64, fileName, options) => shareFile(base64ToFile(base64, fileName, 'application/pdf'), fileName, options);

/**
 * Text through the share sheet (WhatsApp takes it as a message). Where
 * nothing can share, it is copied. Returns 'shared', 'copied' or 'cancelled'.
 */
export async function shareText(text, { title = '' } = {}) {
    try {
        if (Capacitor.isNativePlatform()) {
            await Share.share({ title, text, dialogTitle: title });
            return 'shared';
        }
        if (navigator.share) {
            await navigator.share({ title, text });
            return 'shared';
        }
    } catch (e) {
        if (isCancel(e)) return 'cancelled';
        throw e;
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
}

export const certificateFileName = (name) =>
    `Certificate_${String(name || 'participant').trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'participant'}.pdf`;
