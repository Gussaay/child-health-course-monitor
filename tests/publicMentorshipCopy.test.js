// The public mentorship dashboard link is served an anonymous copy of the
// visits and visit reports (functions/publicMentorshipCopyCore.js). Nothing
// that names or reaches a person may be in it.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { slimPublic, anonCode, COLLECTIONS } = require('../functions/publicMentorshipCopyCore.js');

const ts = (ms) => ({ toMillis: () => ms });

const visit = {
    healthWorkerName: 'Amna Ali', facilityId: 'f1', facilityName: 'Bahri PHC', state: 'Khartoum', locality: 'Bahri',
    mentorEmail: 'mentor@example.org', mentorName: 'Dr Mentor', motherName: 'Fatima', mother_name: 'Fatima', mentorDisplay: 'Dr M',
    phone: '0912', healthWorkerPhone: '0913', notes: 'free text', general_notes: 'x', comments: 'y', signatureUrl: 'sig',
    createdByUid: 'u1', createdByEmail: 'a@b', edited_by_name: 'E', updatedBy: 'U', supervisorName: 'S',
    workerType: 'Nurse', visitNumber: 2, scores: { overall: 80 }, skill_iv_fluid: 'yes', serviceType: 'IMNCI',
    effectiveDate: ts(1700000000500), lastUpdatedAt: ts(1700000001000),
    challenges_table: [
        { id: 1, problem: 'نقص الأدوية', solution: 'طلب من المخزن', responsible_person: 'Mr X', status: 'In Progress' },
        { id: 2, problem: '   ', status: 'Pending' },
    ],
    cases: [{ age: 3, notes: 'case note', classification: 'pneumonia' }],
};

describe('public mentorship copy', () => {
    const out = slimPublic('v1', visit);
    const text = JSON.stringify(out);

    it('keeps no names, emails, phones, notes, signatures or problem text', () => {
        ['Amna Ali', 'mentor@example.org', 'Dr Mentor', 'Fatima', '0912', '0913', 'free text', 'sig', 'u1', 'a@b', 'Mr X', 'طلب من المخزن', 'نقص الأدوية', 'case note', 'Dr M', 'Supervisor'].forEach((s) => {
            expect(text).not.toContain(s);
        });
        expect(out.supervisorName).toBeUndefined();
        expect(out.cases[0]).toEqual({ age: 3, classification: 'pneumonia' });
    });

    it('keeps what the dashboard counts', () => {
        expect(out).toMatchObject({ id: 'v1', facilityId: 'f1', facilityName: 'Bahri PHC', workerType: 'Nurse', visitNumber: 2, scores: { overall: 80 }, skill_iv_fluid: 'yes', serviceType: 'IMNCI' });
        expect(out.effectiveDate).toEqual({ seconds: 1700000000, nanoseconds: 500000000 });
        expect(out.lastUpdatedAt).toBe(1700000001000);
    });

    it('turns the health worker into a stable anonymous code', () => {
        expect(out.healthWorkerName).toBe(anonCode('f1', 'Amna Ali'));
        expect(out.healthWorkerName).toMatch(/^HW-[0-9a-f]{10}$/);
        expect(anonCode('f1', ' amna ali ')).toBe(anonCode('f1', 'Amna Ali'));
        expect(anonCode('f2', 'Amna Ali')).not.toBe(anonCode('f1', 'Amna Ali'));
    });

    it('sends each problem as category and status only', () => {
        expect(out.challenges_table).toEqual([{ id: 1, category: 'medicines_supplies', status: 'In Progress' }]);
    });

    it('covers the visits and both kinds of visit report', () => {
        expect(Object.values(COLLECTIONS).sort()).toEqual(['eencVisitReports', 'imnciVisitReports', 'skillMentorship']);
    });
});
