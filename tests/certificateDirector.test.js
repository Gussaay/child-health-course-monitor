import { describe, it, expect } from 'vitest';
import { certificateDirectorName, certificateDirectorSignature } from '../src/components/constants.js';

// A course's director was changed after its certificates were approved, and the
// certificates kept printing the old director, because the name recorded at
// approval beat the course's current director.
describe('certificate course director', () => {
    const approvedWithHera = {
        director: 'Murtada Abdalazim Mohamed', directorId: 'murtada',
        approvedDirectorName: 'Hera', approvedDirectorSignatureUrl: 'data:hera-sig',
    };

    it('prints the current course director, not the one recorded at approval', () => {
        expect(certificateDirectorName(approvedWithHera)).toBe('Murtada Abdalazim Mohamed');
    });

    it('falls back to the recorded name when the course has no director', () => {
        expect(certificateDirectorName({ approvedDirectorName: 'Hera' })).toBe('Hera');
    });

    it("leaves out the previous director's signature", () => {
        expect(certificateDirectorSignature(approvedWithHera)).toBeNull();
        expect(certificateDirectorSignature({ ...approvedWithHera, approvedDirectorId: 'hera' })).toBeNull();
    });

    it('keeps the signature for the same director, ignoring Dr. and spacing', () => {
        expect(certificateDirectorSignature({ ...approvedWithHera, director: 'Dr.  hera' })).toBe('data:hera-sig');
        expect(certificateDirectorSignature({ ...approvedWithHera, approvedDirectorId: 'murtada' })).toBe('data:hera-sig');
        expect(certificateDirectorSignature({ approvedDirectorSignatureUrl: 'x', director: 'A' })).toBe('x');
    });

    it('keeps the signature when the designer sets the printed name', () => {
        expect(certificateDirectorSignature({ ...approvedWithHera, customCertificate: { directorTitleEn: 'Hera' } })).toBe('data:hera-sig');
    });
});
