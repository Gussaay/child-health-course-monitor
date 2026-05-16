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
        onStart, onSuccess, onError, onFinally, onOpenError,
        isSystemFile = false // Default to false (User file)
    } = options;

    if (!Capacitor.isNativePlatform()) {
        window.open(url, '_blank');
        return;
    }

    if (onStart) onStart();

    try {
        const fileName = customFileName || url.substring(url.lastIndexOf('/') + 1) || 'download.file';
        
        // 1. Determine Mime Type
        let mimeType = '*/*';
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.apk')) mimeType = 'application/vnd.android.package-archive';
        else if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        // 2. Determine Target Directory based on Intent
        // If it's an APK, use Cache. If it's a PDF/Excel, use Documents.
        const targetDirectory = isSystemFile ? Directory.Cache : Directory.Documents;

        // Note: If using Directory.Documents, ensure your app requests storage permissions first!
        if (!isSystemFile) {
            try {
                await Filesystem.mkdir({ path: 'NCHP_Downloads', directory: targetDirectory, recursive: true });
            } catch (e) { /* Ignore if exists */ }
        }

        const filePath = isSystemFile ? fileName : `NCHP_Downloads/${fileName}`;

        // 3. Download the file
        await CapacitorHttp.downloadFile({
            url: url,
            filePath: filePath,
            fileDirectory: targetDirectory 
        });

        // 4. Get the native URI
        const { uri } = await Filesystem.getUri({
            path: filePath,
            directory: targetDirectory
        });

        if (onSuccess) onSuccess();

        // 5. Open the file
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
        if (onFinally) onFinally();
    }
};