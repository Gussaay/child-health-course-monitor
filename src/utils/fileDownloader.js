import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

export const downloadAndOpenFile = async (url, customFileName = null, options = {}) => {
    const { 
        onStart, onSuccess, onError, onFinally, onOpenError, onProgress, 
        isSystemFile = false 
    } = options;

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

        // SAFETY FIX: Wrap listener in try/catch so it doesn't crash the whole download
        if (onProgress) {
            try {
                progressListener = await CapacitorHttp.addListener('progress', (progressData) => {
                    if (progressData && progressData.contentLength > 0) {
                        const percent = (progressData.bytes / progressData.contentLength) * 100;
                        onProgress(percent);
                    }
                });
            } catch (listenerError) {
                console.warn("Native progress listener not supported or failed:", listenerError);
            }
        }

        await CapacitorHttp.downloadFile({
            url: url,
            filePath: filePath,
            fileDirectory: targetDirectory,
            progress: !!onProgress 
        });

        const { uri } = await Filesystem.getUri({
            path: filePath,
            directory: targetDirectory
        });

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