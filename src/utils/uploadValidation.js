// src/utils/uploadValidation.js
//
// Pure upload rules, with no Firebase dependency, so they can be tested and
// reused by any form that takes a file.
//
// These limits are enforced again in storage.rules. Keep the two in step: the
// client check exists to give the user a clear message, the rule is what
// actually stops the upload.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf',
];

/**
 * Strips directory separators, control characters and anything that is not a
 * plain filename character, so a crafted name cannot escape the uploads/ prefix
 * or confuse the download URL. Keeps Arabic letters, which real filenames use.
 * @param {string} name
 * @returns {string}
 */
export function safeFileName(name) {
    const cleaned = String(name || 'file')
        .replace(/[\\/\u0000-\u001f\u007f]/g, '')
        .replace(/[^\p{L}\p{N}._-]+/gu, '_')
        .replace(/^\.+/, '')
        .slice(-100);
    return cleaned || 'file';
}

/**
 * @param {{name?: string, type?: string, size?: number}|null} file
 * @returns {string|null} a message to show the user, or null when the file is fine
 */
export function validateUpload(file) {
    if (!file) return 'No file selected.';
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        return 'Only PNG, JPEG, WebP, GIF images and PDF files can be uploaded.';
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        return `This file is ${mb} MB. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`;
    }
    return null;
}
