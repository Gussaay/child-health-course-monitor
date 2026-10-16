// Share a PDF (given as base64) through the phone's share sheet, so the user
// can pick WhatsApp and a chat. Inside the Android app the file is written to
// the app cache first, because the app's web view cannot share files itself.
// Where nothing can share files (most desktop browsers) the PDF is downloaded
// so it can be attached by hand. Returns 'shared', 'downloaded' or 'cancelled'.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');

const base64ToFile = (base64, fileName) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new File([bytes], fileName, { type: 'application/pdf' });
};

export async function sharePdf(base64, fileName, { title = '', text = '' } = {}) {
    if (Capacitor.isNativePlatform()) {
        const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        try {
            await Share.share({ title, text, files: [uri], dialogTitle: title });
            return 'shared';
        } catch (e) {
            if (isCancel(e)) return 'cancelled';
            throw e;
        }
    }

    const file = base64ToFile(base64, fileName);
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

export const certificateFileName = (name) =>
    `Certificate_${String(name || 'participant').trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'participant'}.pdf`;
