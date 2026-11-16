import { describe, it, expect } from 'vitest';
import {
    GENERAL_TEMPLATE_ID,
    courseTypeTemplateId,
    subCourseTemplateId,
    cleanCertificateConfig,
    mergeCertificateConfigs,
    layerCourseWithTemplates,
    resolveCertificateSignatories,
    buildTemplateSampleCourse,
} from '../src/components/CertificateGenerator.jsx';

describe('Certificate Template Scope & IDs', () => {
    it('generates consistent template IDs for general, course type, and specific sub-course', () => {
        expect(GENERAL_TEMPLATE_ID).toBe('general');
        expect(courseTypeTemplateId('IMNCI')).toBe('type_IMNCI');
        expect(courseTypeTemplateId('ICCM')).toBe('type_ICCM');
        expect(subCourseTemplateId('IMNCI', 'Community Case Management')).toBe('sub_IMNCI__Community%20Case%20Management');
        expect(subCourseTemplateId('IMNCI', 'Standard 7 days course')).toBe('sub_IMNCI__Standard%207%20days%20course');
    });

    it('cleans config according to scope while preserving default director title', () => {
        const raw = {
            directorTitleEn: 'Dr. Default Director',
            directorRoleEn: 'Course Director',
            dateStart: '2026-01-01',
            placeEn: 'Khartoum',
            extraLogoIds: ['logo1']
        };

        const courseTypeCleaned = cleanCertificateConfig(raw, 'courseType');
        expect(courseTypeCleaned.directorTitleEn).toBe('Dr. Default Director');
        expect(courseTypeCleaned.directorRoleEn).toBe('Course Director');
        expect(courseTypeCleaned.dateStart).toBeUndefined(); // excluded from template
        expect(courseTypeCleaned.placeEn).toBeUndefined(); // excluded from template

        const subCourseCleaned = cleanCertificateConfig(raw, 'subCourse');
        expect(subCourseCleaned.directorTitleEn).toBe('Dr. Default Director');
        expect(subCourseCleaned.dateStart).toBeUndefined();
    });
});

describe('Certificate Template Layering', () => {
    const generalDoc = {
        config: {
            headerEn: 'Republic of Sudan',
            titleEn: 'General Certificate',
            directorRoleEn: 'General Director Role'
        }
    };

    const imnciTypeDoc = {
        config: {
            titleEn: 'IMNCI Certificate (All Sub-courses)',
            directorRoleEn: 'IMNCI Director',
            directorTitleEn: 'Default IMNCI Director'
        }
    };

    const imnciCommunitySubDoc = {
        config: {
            titleEn: 'Community IMNCI Certificate',
            subCourseEn: 'Community Case Management Custom Line'
        }
    };

    const templateDocs = {
        [GENERAL_TEMPLATE_ID]: generalDoc,
        [courseTypeTemplateId('IMNCI')]: imnciTypeDoc,
        [subCourseTemplateId('IMNCI', 'Community')]: imnciCommunitySubDoc
    };

    it('applies course-type template to all sub-courses of that course type', () => {
        const courseA = {
            id: 'c-1',
            course_type: 'IMNCI',
            director_imci_sub_type: 'Standard 7 days',
            director: 'Dr. Sarah'
        };

        const layered = layerCourseWithTemplates(courseA, templateDocs);
        // Inherits headerEn from general
        expect(layered.customCertificate.headerEn).toBe('Republic of Sudan');
        // Overrides titleEn and directorRoleEn from IMNCI course-type template
        expect(layered.customCertificate.titleEn).toBe('IMNCI Certificate (All Sub-courses)');
        expect(layered.customCertificate.directorRoleEn).toBe('IMNCI Director');
        // Doesn't have Community sub-course template applied
        expect(layered.customCertificate.subCourseEn).toBeUndefined();
    });

    it('applies specific sub-course template when sub-course matches', () => {
        const courseCommunity = {
            id: 'c-2',
            course_type: 'IMNCI',
            director_imci_sub_type: 'Community',
            director: 'Dr. Sarah'
        };

        const layered = layerCourseWithTemplates(courseCommunity, templateDocs);
        // Inherits headerEn from general
        expect(layered.customCertificate.headerEn).toBe('Republic of Sudan');
        // Sub-course template overrides titleEn
        expect(layered.customCertificate.titleEn).toBe('Community IMNCI Certificate');
        expect(layered.customCertificate.subCourseEn).toBe('Community Case Management Custom Line');
        // Still gets IMNCI directorRole from course-type layer
        expect(layered.customCertificate.directorRoleEn).toBe('IMNCI Director');
    });

    it('course-level customCertificate overrides all template layers', () => {
        const courseWithCustom = {
            id: 'c-3',
            course_type: 'IMNCI',
            director_imci_sub_type: 'Community',
            customCertificate: {
                titleEn: 'Unique Course Certificate Override'
            }
        };

        const layered = layerCourseWithTemplates(courseWithCustom, templateDocs);
        expect(layered.customCertificate.titleEn).toBe('Unique Course Certificate Override');
        expect(layered.customCertificate.subCourseEn).toBe('Community Case Management Custom Line');
        expect(layered.customCertificate.headerEn).toBe('Republic of Sudan');
    });
});

describe('Signatories Resolution: Course Priority & Template Default Director', () => {
    it('always gets the name of course director from the course when present, ignoring template default', () => {
        const course = {
            director: 'Dr. Real Course Director',
            customCertificate: {
                directorTitleEn: 'Template Default Director'
            }
        };

        const signatories = resolveCertificateSignatories(course);
        expect(signatories.directorEn).toBe('Dr. Real Course Director');
        expect(signatories.overrides.directorEn).toBe(false); // not considered a template override
    });

    it('uses approvedDirectorName when director is not explicitly set on course', () => {
        const course = {
            approvedDirectorName: 'Dr. Approved Director',
            customCertificate: {
                directorTitleEn: 'Template Default Director'
            }
        };

        const signatories = resolveCertificateSignatories(course);
        expect(signatories.directorEn).toBe('Dr. Approved Director');
    });

    it('uses template director as default fallback when course has no director', () => {
        const courseWithoutDirector = {
            customCertificate: {
                directorTitleEn: 'Default Template Director'
            }
        };

        const signatories = resolveCertificateSignatories(courseWithoutDirector);
        expect(signatories.directorEn).toBe('Default Template Director');
        expect(signatories.overrides.directorEn).toBe(true);
    });

    it('always gets program manager from the course when present', () => {
        const courseWithManager = {
            program_manager: 'Eng. Course Program Manager',
            customCertificate: {
                managerTitleEn: 'Template Manager'
            }
        };

        const signatories = resolveCertificateSignatories(courseWithManager, 'Federal Fallback Manager');
        expect(signatories.managerEn).toBe('Eng. Course Program Manager');
    });

    it('prioritizes approvedByManagerName over program_manager from course', () => {
        const course = {
            program_manager: 'Old Manager',
            approvedByManagerName: 'Approved Manager',
            customCertificate: {
                managerTitleEn: 'Template Manager'
            }
        };

        const signatories = resolveCertificateSignatories(course, 'Federal Fallback');
        expect(signatories.managerEn).toBe('Approved Manager');
    });

    it('falls back to coordinator or template manager when course has none', () => {
        const courseWithoutManager = {
            customCertificate: {
                managerTitleEn: 'Template Manager Default'
            }
        };

        const withFallback = resolveCertificateSignatories(courseWithoutManager, 'Coordinator Manager');
        expect(withFallback.managerEn).toBe('Coordinator Manager');

        const withTemplateOnly = resolveCertificateSignatories(courseWithoutManager, '');
        expect(withTemplateOnly.managerEn).toBe('Template Manager Default');
    });
});

describe('buildTemplateSampleCourse', () => {
    it('attaches subCourse when designing sub-course template', () => {
        const sample = buildTemplateSampleCourse('IMNCI', [], 'Community Case Management');
        expect(sample.course_type).toBe('IMNCI');
        expect(sample.director_imci_sub_type).toBe('Community Case Management');
        expect(sample.__templateSample).toBe(true);
    });

    it('picks candidates matching course type and cleans course-specific fields', () => {
        const courses = [
            { id: 'c-old', course_type: 'IMNCI', start_date: '2025-01-01', director: 'Dr. Old' },
            { id: 'c-new', course_type: 'IMNCI', start_date: '2026-05-01', director: 'Dr. New', approvedDirectorSignatureUrl: 'https://sig.test' }
        ];

        const sample = buildTemplateSampleCourse('IMNCI', courses);
        expect(sample.course_type).toBe('IMNCI');
        expect(sample.approvedDirectorSignatureUrl).toBeUndefined(); // signatures cleared
        expect(sample.director).toBe('Dr. New'); // uses most recent course data
    });
});
