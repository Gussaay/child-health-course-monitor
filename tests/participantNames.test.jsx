import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    hasArabicScript, participantNameOnly, participantNameIn, participantNames,
    certificateApprovalSnapshot, certificateApprovalState,
} from '../src/components/constants';
import { phoneConfirms, certificateNamesLink, namesLinkLanguage } from '../src/components/PublicCertificateNames';
import { NameLanguageFields } from '../src/components/NameLanguageFields';

describe('participant names in English and Arabic', () => {
    it('takes an old record\'s only name as the language it is written in', () => {
        expect(hasArabicScript('أحمد محمد')).toBe(true);
        expect(hasArabicScript('Ahmed Mohamed')).toBe(false);
        expect(participantNames({ name: 'أحمد محمد' })).toEqual({ nameEn: '', nameAr: 'أحمد محمد' });
        expect(participantNames({ name: 'Ahmed Mohamed' })).toEqual({ nameEn: 'Ahmed Mohamed', nameAr: '' });
    });

    it('prints the name in the certificate\'s language, else the other one', () => {
        const both = { name: 'Ahmed Mohamed', nameAr: 'أحمد محمد' };
        expect(participantNameIn(both, 'en')).toBe('Ahmed Mohamed');
        expect(participantNameIn(both, 'ar')).toBe('أحمد محمد');
        expect(participantNameIn({ name: 'Ahmed Mohamed' }, 'ar')).toBe('Ahmed Mohamed');
        expect(participantNameIn({ name: 'أحمد', nameEn: 'Ahmed' }, 'en')).toBe('Ahmed');
        expect(participantNameOnly({ name: 'أحمد', nameEn: ' ' }, 'en')).toBe('');
    });

    it('withdraws an approval when the printed name in a language changes after the course', () => {
        const course = { isCertificateApproved: true, certificateApprovalScopes: { '*': ['en', 'ar'] }, start_date: '2020-01-01', course_duration: 3 };
        const p = { name: 'Ahmed Mohamed', nameAr: 'أحمد محمد' };
        const snap = certificateApprovalSnapshot(p, course);
        expect(snap).toMatchObject({ nameEn: 'Ahmed Mohamed', nameAr: 'أحمد محمد' });
        const signed = { ...p, certificateApproval: snap };
        expect(certificateApprovalState(signed, course, 'ar').state).toBe('approved');
        const changedAr = { ...signed, nameAr: 'أحمد محمد علي' };
        expect(certificateApprovalState(changedAr, course, 'ar').state).toBe('stale');
        expect(certificateApprovalState(changedAr, course, 'en').state).toBe('approved');
        // an approval made before the two names existed still compares the record's name
        const old = { name: 'Ahmed Mohamed', nameAr: 'أحمد', certificateApproval: { name: 'Ahmed Mohamed', subCourse: '' } };
        expect(certificateApprovalState(old, course, 'en').changed).not.toContain('name');
    });
});

describe('the public "your name for the certificate" link', () => {
    it('can ask for both names or one language only', () => {
        expect(certificateNamesLink('https://x.app', 'C1')).toBe('https://x.app/public/course/names/C1');
        expect(certificateNamesLink('https://x.app', 'C1', 'ar')).toBe('https://x.app/public/course/names/C1?lang=ar');
        expect(namesLinkLanguage('?lang=en')).toBe('en');
        expect(namesLinkLanguage('?lang=fr')).toBe(null);
    });

    it('asks for the last 4 digits of the phone on record', () => {
        expect(phoneConfirms({ phone: '0912 345 678' }, '5678')).toBe(true);
        expect(phoneConfirms({ phone: '0912345678' }, '1234')).toBe(false);
        expect(phoneConfirms({ phone: '' }, '')).toBe(true);
    });

    it('shows only the box for the language asked', () => {
        const L = (a, e) => e;
        const html = (only) => renderToStaticMarkup(<NameLanguageFields name="Ahmed" nameEn="" nameAr="" setNameEn={() => {}} setNameAr={() => {}} L={L} only={only} />);
        expect(html(null)).toContain('name-en'); expect(html(null)).toContain('name-ar');
        expect(html('ar')).not.toContain('name-en'); expect(html('ar')).toContain('name-ar');
        expect(html('en')).toContain('placeholder="Ahmed"');
    });
});
