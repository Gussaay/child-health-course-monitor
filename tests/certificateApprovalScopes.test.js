import { describe, it, expect } from 'vitest';
import {
    certificateApprovedFor,
    certificateApprovedLanguages,
    certificateFullyApproved,
    certificateApprovalState,
    mergeCertificateApprovalScopes,
} from '../src/components/constants.js';
import { layerCourseWithTemplates } from '../src/components/CertificateGenerator.jsx';

// Approval can be given per language, and per sub-course when a course has
// several. A course approved before this existed has no scope map and stays
// approved for everything.

const base = {
    id: 'c1',
    isCertificateApproved: true,
    director_imci_sub_type: 'Doctors',
    facilitatorAssignments: [{ group: 'B', imci_sub_type: 'Medical Assistants' }],
};

describe('certificate approval scopes', () => {
    it('treats a course approved before scopes existed as approved for everything', () => {
        expect(certificateApprovedLanguages(base, 'Doctors')).toEqual(['en', 'ar']);
        expect(certificateFullyApproved(base)).toBe(true);
    });

    it('approves one language for every sub-course', () => {
        const scopes = mergeCertificateApprovalScopes({ isCertificateApproved: false }, ['*'], ['ar']);
        const c = { ...base, certificateApprovalScopes: scopes };
        expect(certificateApprovedFor(c, 'Doctors', 'ar')).toBe(true);
        expect(certificateApprovedFor(c, 'Doctors', 'en')).toBe(false);
        expect(certificateFullyApproved(c)).toBe(false);
    });

    it('approves one sub-course only, and adds another later', () => {
        let scopes = mergeCertificateApprovalScopes({ isCertificateApproved: false }, ['Doctors'], ['en', 'ar']);
        let c = { ...base, certificateApprovalScopes: scopes };
        expect(certificateApprovedFor(c, 'doctors ', 'en')).toBe(true);
        expect(certificateApprovedFor(c, 'Medical Assistants')).toBe(false);

        scopes = mergeCertificateApprovalScopes(c, ['Medical Assistants'], ['en']);
        c = { ...c, certificateApprovalScopes: scopes };
        expect(certificateApprovedLanguages(c, 'Medical Assistants')).toEqual(['en']);
        expect(certificateApprovedLanguages(c, 'Doctors')).toEqual(['en', 'ar']);
    });

    it('collapses to all sub-courses once everything is approved', () => {
        const partial = { ...base, certificateApprovalScopes: { Doctors: ['en'] } };
        const scopes = mergeCertificateApprovalScopes(partial, ['*'], ['en', 'ar']);
        expect(scopes).toEqual({ '*': ['en', 'ar'] });
    });

    it('keeps a participant in an unapproved sub-course or language pending', () => {
        const c = { ...base, certificateApprovalScopes: { Doctors: ['en'] } };
        const doctor = { id: 1, name: 'A', imci_sub_type: 'Doctors' };
        const ma = { id: 2, name: 'B', group: 'B' };
        expect(certificateApprovalState(doctor, c, 'en').state).toBe('approved');
        expect(certificateApprovalState(doctor, c, 'ar').state).toBe('pending');
        expect(certificateApprovalState(ma, c).state).toBe('pending');
    });
});


describe('per sub-course drafts', () => {
    it('layers the sub-course draft on top of the course draft', () => {
        const course = {
            ...base,
            customCertificate: { titleFontSize: 30, courseTitleEn: 'All' },
            customCertificateBySub: { 'Medical Assistants': { courseTitleEn: 'MA only' } },
        };
        expect(layerCourseWithTemplates(course, {}, 'Medical Assistants').customCertificate)
            .toMatchObject({ titleFontSize: 30, courseTitleEn: 'MA only' });
        expect(layerCourseWithTemplates(course, {}, 'Doctors').customCertificate)
            .toMatchObject({ titleFontSize: 30, courseTitleEn: 'All' });
    });
});
