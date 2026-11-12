// src/utils/fileDownloader.js
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

const STALL_MS = 90 * 1000;

export const downloadAndOpenFile = async (url, customFileName = null, options = {}) => {
    const { 
        onStart, onSuccess, onError, onFinally, onOpenError, onProgress, 
        isSystemFile = false 
    } = options;

    if (!url) {
        if (onError) onError(new Error('No download link'));
        return;
    }

    if (!Capacitor.isNativePlatform()) {
        window.open(url, '_blank');
        return;
    }

    if (onStart) onStart();

    let progressListener = null;

    try {
        const fileName = customFileName || url.substring(url.lastIndexOf('/') + 1) || 'download.file';
        
        let mimeType = '*/*';
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.apk')) mimeType = 'application/vnd.android.package-archive';
        else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        const targetDirectory = isSystemFile ? Directory.Cache : Directory.Documents;

        if (!isSystemFile) {
            try {
                await Filesystem.mkdir({ path: 'NCHP_Downloads', directory: targetDirectory, recursive: true });
            } catch (e) { /* Ignore if exists */ }
        }

        const filePath = isSystemFile ? fileName : `NCHP_Downloads/${fileName}`;

        // SAFETY FIX: Attach progress listener to the Filesystem plugin
        if (onProgress) {
            try {
                progressListener = await Filesystem.addListener('progress', (progressData) => {
                    if (progressData && progressData.contentLength > 0) {
                        const percent = (progressData.bytes / progressData.contentLength) * 100;
                        onProgress(percent);
                    }
                });
            } catch (listenerError) {
                console.warn("Native progress listener not supported or failed:", listenerError);
            }
        }

        // A download that gets no progress for this long is reported as
        // stalled (same as Easy Pedia), so the screen never sits on
        // "Downloading…" for ever on a dead connection.
        let stallTimer = null;
        let rejectStall = null;
        const stall = new Promise((_, reject) => { rejectStall = reject; });
        stall.catch(() => {});
        const kick = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => rejectStall(new Error('The download stopped (slow or broken connection).')), STALL_MS);
        };
        let stallListener = null;
        try {
            stallListener = await Filesystem.addListener('progress', kick);
        } catch { /* progress events not available */ }

        let result;
        try {
            kick();
            // Execute download using Filesystem instead of CapacitorHttp
            result = await Promise.race([
                Filesystem.downloadFile({
                    url: url,
                    path: filePath,
                    directory: targetDirectory,
                    progress: true,
                    recursive: true,
                }),
                stall,
            ]);
        } finally {
            clearTimeout(stallTimer);
            stallListener?.remove?.();
        }

        // Some servers answer an error page with 200; an installer of a few
        // KB is never right.
        if (lowerName.endsWith('.apk')) {
            const st = await Filesystem.stat({ path: filePath, directory: targetDirectory }).catch(() => null);
            if (!st || !(Number(st.size) > 50 * 1024)) {
                throw new Error('The server sent an incomplete file.');
            }
        }

        const uri = result?.path?.startsWith?.('file:')
            ? result.path
            : (await Filesystem.getUri({ path: filePath, directory: targetDirectory })).uri;

        if (onSuccess) onSuccess();

        try {
            await FileOpener.open({
                filePath: uri,
                contentType: mimeType
            });
        } catch (openError) {
            if (onOpenError) onOpenError(openError);
            else if (onError) onError(new Error("تم تحميل الملف ولكن لم يتم العثور على تطبيق لفتحه."));
        }

    } catch (error) {
        if (onError) onError(error);
    } finally {
        if (progressListener && typeof progressListener.remove === 'function') {
            progressListener.remove();
        }
        if (onFinally) onFinally();
    }
};