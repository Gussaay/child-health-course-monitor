import { describe, it, expect } from 'vitest';
import {
    validateUpload,
    safeFileName,
    MAX_UPLOAD_BYTES,
} from '../src/utils/uploadValidation.js';

const fakeFile = (name, type, size) => ({ name, type, size });

describe('validateUpload', () => {
    it('accepts an image within the size limit', () => {
        expect(validateUpload(fakeFile('signature.png', 'image/png', 1024))).toBeNull();
    });

    it('accepts a PDF', () => {
        expect(validateUpload(fakeFile('report.pdf', 'application/pdf', 2048))).toBeNull();
    });

    it('rejects a type that is not an image or a PDF', () => {
        expect(validateUpload(fakeFile('photo.png.exe', 'application/x-msdownload', 1024)))
            .toMatch(/Only PNG/);
    });

    it('rejects a file over the size limit', () => {
        expect(validateUpload(fakeFile('huge.png', 'image/png', MAX_UPLOAD_BYTES + 1)))
            .toMatch(/limit is 5 MB/);
    });

    it('accepts a file exactly at the limit', () => {
        expect(validateUpload(fakeFile('edge.png', 'image/png', MAX_UPLOAD_BYTES))).toBeNull();
    });

    it('rejects nothing being selected', () => {
        expect(validateUpload(null)).toMatch(/No file/);
    });
});

describe('safeFileName', () => {
    it('strips path separators so a name cannot escape the uploads prefix', () => {
        expect(safeFileName('../../etc/passwd')).not.toContain('/');
        expect(safeFileName('..\\..\\windows')).not.toContain('\\');
    });

    it('keeps Arabic letters, which real filenames use', () => {
        expect(safeFileName('تقرير.pdf')).toBe('تقرير.pdf');
    });

    it('keeps a normal name unchanged', () => {
        expect(safeFileName('signature-2026.png')).toBe('signature-2026.png');
    });

    it('never returns an empty string', () => {
        expect(safeFileName('')).toBe('file');
        expect(safeFileName('///')).toBe('file');
        expect(safeFileName(null)).toBe('file');
    });

    it('does not produce a leading dot', () => {
        expect(safeFileName('...hidden')).toBe('hidden');
    });

    it('caps the length', () => {
        expect(safeFileName('a'.repeat(500)).length).toBeLessThanOrEqual(100);
    });
});
