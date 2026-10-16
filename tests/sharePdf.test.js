import { describe, it, expect, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
import { certificateFileName } from '../src/utils/sharePdf';

describe('certificateFileName', () => {
    it('makes a safe file name from the participant name', () => {
        expect(certificateFileName('Ali Ahmed / X')).toBe('Certificate_Ali_Ahmed_X.pdf');
        expect(certificateFileName('علي أحمد')).toBe('Certificate_علي_أحمد.pdf');
        expect(certificateFileName('')).toBe('Certificate_participant.pdf');
    });
});
