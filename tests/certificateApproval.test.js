import { describe, it, expect } from 'vitest';
import {
    certificateApprovalState,
    certificateApprovalSnapshot,
    certificateSubCourseOf,
    staleCertificateParticipants,
    isWithinCoursePeriod,
} from '../src/components/constants.js';

// =============================================================================
// Approval used to be a single flag on the course, which left a hole: a
// participant's name could be corrected, or their sub-course changed, after the
// course was signed off, and the certificate quietly started printing the new
// details under an approval given for the old ones. Nobody had signed the
// certificate that came out.
//
// So approval records what it approved, and a certificate that no longer
// matches is held until somebody signs it again.
// =============================================================================

const approvedCourse = {
    id: 'c1',
    isCertificateApproved: true,
    director_imci_sub_type: 'Standard 7 days course',
    facilitatorAssignments: [{ group: 'Group A', imci_sub_type: 'Emergency Maternal Care' }],
};

const signed = (participant, course = approvedCourse) => ({
    ...participant,
    certificateApproval: certificateApprovalSnapshot(participant, course, 'manager'),
});

describe('certificateApprovalState', () => {
    it('refuses everything until the course is approved', () => {
        const p = signed({ id: 1, name: 'Ahmed' });
        expect(certificateApprovalState(p, { isCertificateApproved: false }).state).toBe('pending');
        expect(certificateApprovalState(p, null).state).toBe('pending');
    });

    it('passes a participant whose details have not moved', () => {
        const p = signed({ id: 1, name: 'Ahmed Mohamed', imci_sub_type: 'EENC Orientation' });
        expect(certificateApprovalState(p, approvedCourse).state).toBe('approved');
    });

    it('holds a certificate whose name changed after signing', () => {
        const p = signed({ id: 1, name: 'Ahmed Mohamed' });
        const renamed = { ...p, name: 'Ahmed Mohamed Ali' };

        const result = certificateApprovalState(renamed, approvedCourse);
        expect(result.state).toBe('stale');
        expect(result.changed).toEqual(['name']);
        // The approver is shown what they signed last time, not just what it is now.
        expect(result.signedName).toBe('Ahmed Mohamed');
    });

    it('holds a certificate whose sub-course changed after signing', () => {
        const p = signed({ id: 1, name: 'Ahmed', imci_sub_type: 'Emergency Maternal Care' });
        const moved = { ...p, imci_sub_type: 'Emergency Newborn Care' };

        const result = certificateApprovalState(moved, approvedCourse);
        expect(result.state).toBe('stale');
        expect(result.changed).toEqual(['subCourse']);
        expect(result.signedSubCourse).toBe('Emergency Maternal Care');
    });

    it('reports both when both moved', () => {
        const p = signed({ id: 1, name: 'A', imci_sub_type: 'Emergency Maternal Care' });
        const result = certificateApprovalState(
            { ...p, name: 'B', imci_sub_type: 'Emergency Newborn Care' }, approvedCourse);
        expect(result.changed).toEqual(['name', 'subCourse']);
    });

    it('catches a sub-course changed by moving group, not by editing the record', () => {
        // Their own field is blank, so the group answers — and the group moved.
        const p = signed({ id: 1, name: 'A', group: 'Group A' });
        expect(certificateApprovalState(p, approvedCourse).state).toBe('approved');

        const regrouped = { ...p, group: 'Group B' };
        const result = certificateApprovalState(regrouped, approvedCourse);
        expect(result.state).toBe('stale');
        expect(result.changed).toEqual(['subCourse']);
    });

    it('ignores changes that would print identically', () => {
        // Spacing and case are not worth withdrawing a signature over.
        const p = signed({ id: 1, name: 'Ahmed  Mohamed' });
        expect(certificateApprovalState({ ...p, name: ' ahmed mohamed ' }, approvedCourse).state)
            .toBe('approved');
    });

    it('does not freeze certificates approved before any of this existed', () => {
        // No snapshot means no record of what was signed, so there is nothing to
        // compare against. Calling that an alteration would hold back every
        // certificate already issued, for a change nobody made.
        const legacy = { id: 1, name: 'Ahmed' };
        const result = certificateApprovalState(legacy, approvedCourse);
        expect(result.state).toBe('approved');
        expect(result.unrecorded).toBe(true);
    });

    it('survives missing inputs', () => {
        expect(certificateApprovalState(null, null).state).toBe('pending');
        expect(certificateApprovalState(undefined, approvedCourse).state).toBe('approved');
    });
});

describe('certificateSubCourseOf', () => {
    it('prefers the participant record, then the group, then the director', () => {
        expect(certificateSubCourseOf(approvedCourse, { imci_sub_type: 'EENC ToT', group: 'Group A' }))
            .toBe('EENC ToT');
        expect(certificateSubCourseOf(approvedCourse, { group: 'Group A' }))
            .toBe('Emergency Maternal Care');
        expect(certificateSubCourseOf(approvedCourse, { group: 'Group Z' }))
            .toBe('Standard 7 days course');
        expect(certificateSubCourseOf(null, null)).toBeNull();
    });
});

describe('staleCertificateParticipants', () => {
    it('lists only the held ones, and never a deleted record', () => {
        const ok = signed({ id: 1, name: 'Fine' });
        const moved = { ...signed({ id: 2, name: 'Was' }), name: 'Now' };
        const deleted = { ...signed({ id: 3, name: 'Gone' }), name: 'Changed', isDeleted: true };

        const held = staleCertificateParticipants([ok, moved, deleted], approvedCourse);
        expect(held.map((p) => p.id)).toEqual([2]);
    });

    it('is empty when the course is not approved at all', () => {
        const p = signed({ id: 1, name: 'A' });
        expect(staleCertificateParticipants([{ ...p, name: 'B' }], { isCertificateApproved: false }))
            .toEqual([]);
        expect(staleCertificateParticipants(null, approvedCourse)).toEqual([]);
    });
});

describe('certificateApprovalSnapshot', () => {
    it('records the name and sub-course as they stand, with who signed', () => {
        const snap = certificateApprovalSnapshot(
            { name: 'Ahmed', group: 'Group A' }, approvedCourse, 'manager@example.com');
        expect(snap.name).toBe('Ahmed');
        expect(snap.subCourse).toBe('Emergency Maternal Care');
        expect(snap.by).toBe('manager@example.com');
        expect(Number.isNaN(Date.parse(snap.at))).toBe(false);
    });

    it('writes strings, never undefined, so Firestore accepts it', () => {
        const snap = certificateApprovalSnapshot({}, {}, undefined);
        expect(snap).toEqual({ name: '', subCourse: '', at: snap.at, by: '' });
    });
});

// =============================================================================
// A NAME CORRECTED WHILE THE COURSE IS STILL RUNNING IS NOT AN ALTERATION.
//
// Certificates get approved on the first day or two, and names go on being
// fixed all week. Holding those back and asking for a fresh signature on each
// one is make-work: nothing has been handed out yet and the correction is the
// register being completed, not the record being changed after the fact.
// =============================================================================

const dayOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

describe('isWithinCoursePeriod', () => {
    it('counts the start day and the last day, but not the day after', () => {
        expect(isWithinCoursePeriod({ start_date: dayOffset(0), course_duration: 5 })).toBe(true);
        expect(isWithinCoursePeriod({ start_date: dayOffset(-4), course_duration: 5 })).toBe(true);
        expect(isWithinCoursePeriod({ start_date: dayOffset(-5), course_duration: 5 })).toBe(false);
        expect(isWithinCoursePeriod({ start_date: dayOffset(1), course_duration: 5 })).toBe(false);
    });

    it('says no when the course does not say when it runs', () => {
        expect(isWithinCoursePeriod({ start_date: dayOffset(0) })).toBe(false);
        expect(isWithinCoursePeriod({ course_duration: 5 })).toBe(false);
        expect(isWithinCoursePeriod({ start_date: 'not a date', course_duration: 5 })).toBe(false);
        expect(isWithinCoursePeriod(null)).toBe(false);
    });
});

describe('a name corrected during the course', () => {
    const running = {
        id: 'c2',
        isCertificateApproved: true,
        start_date: dayOffset(-1),
        course_duration: 6,
        facilitatorAssignments: [{ group: 'Group A', imci_sub_type: 'Emergency Maternal Care' }],
    };
    const finished = { ...running, start_date: dayOffset(-30), course_duration: 6 };

    it('does not hold the certificate while the course is still on', () => {
        const p = { ...signed({ id: 1, name: 'Ahmd' }, running), name: 'Ahmed Mohamed' };
        expect(certificateApprovalState(p, running).state).toBe('approved');
    });

    it('holds the same edit once the course is over', () => {
        const p = { ...signed({ id: 1, name: 'Ahmd' }, finished), name: 'Ahmed Mohamed' };
        const result = certificateApprovalState(p, finished);
        expect(result.state).toBe('stale');
        expect(result.changed).toEqual(['name']);
    });

    it('still holds a sub-course change made during the course', () => {
        // Moving somebody between the maternal and newborn parts changes what
        // the certificate says they were trained in. That is worth a signature
        // whenever it happens.
        const p = signed({ id: 1, name: 'A', imci_sub_type: 'Emergency Maternal Care' }, running);
        const moved = { ...p, imci_sub_type: 'Emergency Newborn Care' };
        const result = certificateApprovalState(moved, running);
        expect(result.state).toBe('stale');
        expect(result.changed).toEqual(['subCourse']);
    });

    it('reports only the sub-course when both moved during the course', () => {
        const p = signed({ id: 1, name: 'A', imci_sub_type: 'Emergency Maternal Care' }, running);
        const both = { ...p, name: 'B', imci_sub_type: 'Emergency Newborn Care' };
        expect(certificateApprovalState(both, running).changed).toEqual(['subCourse']);
    });
});
