import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

/**
 * Generic In-App Download & Open Manager
 * @param {string} url - The URL of the file to download
 * @param {string} customFileName - Optional custom name for the downloaded file
 * @param {object} options - Contains callbacks AND configuration (like isSystemFile)
 */
export const downloadAndOpenFile = async (url, customFileName = null, options = {}) => {
    const { 
        onStart, onSuccess, onError, onFinally, onOpenError, onProgress, // <-- Added onProgress support
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
        
        // 1. Determine Mime Type
        let mimeType = '*/*';
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.apk')) mimeType = 'application/vnd.android.package-archive';
        else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        // 2. Determine Target Directory based on Intent
        const targetDirectory = isSystemFile ? Directory.Cache : Directory.Documents;

        if (!isSystemFile) {
            try {
                await Filesystem.mkdir({ path: 'NCHP_Downloads', directory: targetDirectory, recursive: true });
            } catch (e) { /* Ignore if exists */ }
        }

        const filePath = isSystemFile ? fileName : `NCHP_Downloads/${fileName}`;

        // 3. Attach Progress Listener
        if (onProgress) {
            progressListener = await CapacitorHttp.addListener('progress', (progressData) => {
                // Ensure we have a valid contentLength to avoid dividing by 0
                if (progressData && progressData.contentLength > 0) {
                    const percent = (progressData.bytes / progressData.contentLength) * 100;
                    onProgress(percent);
                }
            });
        }

        // 4. Download the file
        await CapacitorHttp.downloadFile({
            url: url,
            filePath: filePath,
            fileDirectory: targetDirectory,
            progress: !!onProgress // <-- Enable native progress tracking if a callback is provided
        });

        // 5. Get the native URI
        const { uri } = await Filesystem.getUri({
            path: filePath,
            directory: targetDirectory
        });

        if (onSuccess) onSuccess();

        // 6. Open the file
        try {
            await FileOpener.open({
                filePath: uri,
                contentType: mimeType
            });
        } catch (openError) {
            console.error("FileOpener Error:", openError);
            if (onOpenError) onOpenError(openError);
            else if (onError) onError(new Error("File downloaded, but no app found to open it."));
        }

    } catch (error) {
        console.error("Download Error:", error);
        if (onError) onError(error);
    } finally {
        // Clean up the event listener to prevent memory leaks
        if (progressListener) {
            progressListener.remove();
        }
        if (onFinally) onFinally();
    }
};