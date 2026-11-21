// practiceParticipants (src/utils/practiceParticipants.js): a course's
// director, clinical instructor and facilitators get practice participant
// entries so they can try every form, and nothing recorded for them may reach
// a score, count, report or certificate.
import { describe, it, expect } from 'vitest';
import {
    isPracticeParticipant, isPracticeRecord, withoutPractice, courseDetailsWithoutPractice,
    wantsPractice, practiceParticipantId, practiceRosterFor, practiceParticipantDoc, missingPracticeParticipants,
} from '../src/utils/practiceParticipants';

const course = {
    id: 'c1', state: 'Khartoum', locality: 'Bahri',
    director: 'Dr Amna', directorId: 'f1',
    clinical_instructor: 'Dr Omar', clinical_instructorId: 'f2',
    facilitatorAssignments: [
        { name: 'Sara', facilitatorId: 'f3', group: 'Group B', imci_sub_type: 'Module 1' },
        { name: 'Sara', facilitatorId: 'f3', group: 'Group C', imci_sub_type: 'Module 2' },
        { name: 'Dr Amna', facilitatorId: 'f1', group: 'Group A' },
        { name: 'Typed Name', facilitatorId: null, group: 'Group A' },
    ],
};

describe('practice roster', () => {
    it('lists each person once: facilitators, then director and clinical instructor', () => {
        const roster = practiceRosterFor(course);
        expect(roster.map((p) => p.name)).toEqual(['Sara', 'Dr Amna', 'Typed Name', 'Dr Omar']);
        expect(roster.find((p) => p.name === 'Sara')).toMatchObject({ group: 'Group B', imci_sub_type: 'Module 1', role: 'facilitator' });
        expect(roster.find((p) => p.name === 'Dr Omar')).toMatchObject({ role: 'clinical_instructor', group: 'Group B' });
    });

    it('gives each person a fixed id starting practice_ that has no slash', () => {
        const a = practiceParticipantId('c1', 'f3');
        expect(a).toBe(practiceParticipantId('c1', 'f3'));
        expect(a.startsWith('practice_c1_')).toBe(true);
        expect(practiceParticipantId('c1', 'أحمد/محمد')).not.toContain('/');
        expect(practiceParticipantId('c1', 'a b')).not.toBe(practiceParticipantId('c1', 'a-b'));
    });

    it('builds a practice document with no facility and no phone', () => {
        const d = practiceParticipantDoc(course, practiceRosterFor(course)[0]);
        expect(d).toMatchObject({ courseId: 'c1', name: 'Sara', isPractice: true, facilityId: null, phone: '', state: 'Khartoum', locality: 'Bahri' });
        expect(isPracticeParticipant(d)).toBe(true);
    });

    it('only creates entries that do not exist yet, deleted ones included', () => {
        const all = missingPracticeParticipants(course, []);
        expect(all).toHaveLength(4);
        const some = missingPracticeParticipants(course, [all[0].id, all[1].id]);
        expect(some.map((d) => d.name)).toEqual(['Typed Name', 'Dr Omar']);
        expect(missingPracticeParticipants({ id: 'c2' }, [])).toEqual([]);
    });
});

describe('leaving practice out', () => {
    const real = { id: 'p1', name: 'Real' };
    const practice = { id: practiceParticipantId('c1', 'f3'), name: 'Sara', isPractice: true };

    it('recognizes practice participants and everything saved for them', () => {
        expect(isPracticeRecord(practice)).toBe(true);
        expect(isPracticeRecord(real)).toBe(false);
        expect(isPracticeRecord({ id: 't1', participantId: practice.id })).toBe(true);
        expect(isPracticeRecord({ id: 'o1', participant_id: practice.id })).toBe(true);
        expect(isPracticeRecord({ id: 'r1', isPractice: true })).toBe(true);
        expect(isPracticeRecord({ id: 't2', participantId: 'p1' })).toBe(false);
        expect(isPracticeRecord(null)).toBe(false);
    });

    it('filters lists and whole course bundles', () => {
        expect(withoutPractice([real, practice])).toEqual([real]);
        expect(withoutPractice(null)).toBe(null);
        const bundle = courseDetailsWithoutPractice({
            participants: [real, practice],
            participantTests: [{ id: 'a', participantId: 'p1' }, { id: 'b', participantId: practice.id }],
            allObs: [{ id: 'o', participant_id: practice.id }],
            allCases: [{ id: 'c', participant_id: 'p1' }],
            finalReport: { id: 'fr' },
        });
        expect(bundle.participants).toEqual([real]);
        expect(bundle.participantTests.map((t) => t.id)).toEqual(['a']);
        expect(bundle.allObs).toEqual([]);
        expect(bundle.allCases).toHaveLength(1);
        expect(bundle.finalReport).toEqual({ id: 'fr' });
    });

    it('only an explicit includePractice asks for practice entries', () => {
        expect(wantsPractice({ includePractice: true })).toBe(true);
        expect(wantsPractice({ source: 'server' })).toBe(false);
        expect(wantsPractice('server')).toBe(false);
        expect(wantsPractice(undefined)).toBe(false);
    });
});
