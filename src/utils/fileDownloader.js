import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

/**
 * Generic In-App Download & Open Manager
 * Bypasses webview memory limits completely, fixing Base64/Fetch crashes.
 * @param {string} url - The URL of the file to download
 * @param {string} customFileName - Optional custom name for the downloaded file
 * @param {object} callbacks - UI callbacks for loading states, success, and errors
 */
export const downloadAndOpenFile = async (url, customFileName = null, callbacks = {}) => {
    const { onStart, onSuccess, onError, onFinally, onOpenError } = callbacks;

    // If on web, just open the link in a new tab
    if (!Capacitor.isNativePlatform()) {
        window.open(url, '_blank');
        return;
    }

    if (onStart) onStart();

    try {
        const fileName = customFileName || url.substring(url.lastIndexOf('/') + 1) || 'downloaded_file.apk';
        
        // Determine mime type
        let mimeType = 'application/vnd.android.package-archive';
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';

        try {
            // 🟢 CHANGED: Ensure downloads directory exists in the accessible Documents folder
            await Filesystem.mkdir({ path: 'downloads', directory: Directory.Documents, recursive: true });
        } catch (e) {
            // Ignore if it already exists
        }

        const filePath = `downloads/${fileName}`;

        // 🟢 CHANGED: Use Directory.Documents
        await CapacitorHttp.downloadFile({
            url: url,
            filePath: filePath,
            fileDirectory: Directory.Documents 
        });

        // 🟢 CHANGED: Use Directory.Documents
        const { uri } = await Filesystem.getUri({
            path: filePath,
            directory: Directory.Documents
        });

        // Trigger success callback because the file is safely on the device now
        if (onSuccess) onSuccess();

        // 🟢 ROBUST FILE OPENER LOGIC
        try {
            await FileOpener.open({
                filePath: uri,
                contentType: mimeType
                // Removed: openWithDefault: true (forces the OS app chooser instead of failing silently)
            });
        } catch (openError) {
            console.error("FileOpener Error:", openError);
            if (onOpenError) {
                // If you want to handle this specifically in the UI (e.g., a yellow toast warning)
                onOpenError(openError);
            } else if (onError) {
                // Fallback error message if onOpenError isn't provided
                onError(new Error("File downloaded successfully, but no app was found to open it. Check your device's Documents/downloads folder."));
            }
        }

    } catch (error) {
        console.error("Full Download Error:", error);
        if (onError) onError(error);
    } finally {
        if (onFinally) onFinally();
    }
};