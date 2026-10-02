import { describe, it, expect } from 'vitest';
import { participantsForModule, subCourseOfGroup } from '../src/components/constants.js';

// =============================================================================
// Reported from the screen: the newborn participant dropdown was empty, with no
// way to record anything at all.
//
// The filter was correct — every participant on that course really did resolve
// to the maternal stream. Being right is not the same as being useful: an
// observer stood at a bedside with a baby in front of them had nothing to pick.
//
// imci_sub_type is registration data and we already know it is unreliable; it
// is what put EENC-orientation participants under Emergency Newborn Care in the
// reports. So it orders the list now instead of hiding anybody.
// =============================================================================

const course = { facilitatorAssignments: [] };

describe('participantsForModule', () => {
    it('never hides anyone, however the streams fall', () => {
        // The exact case that emptied the picker.
        const allMaternal = [
            { id: 1, name: 'A', imci_sub_type: 'Emergency Maternal Care' },
            { id: 2, name: 'B', imci_sub_type: 'Emergency Maternal Care' },
        ];
        const { own, others } = participantsForModule(allMaternal, course, 'neonatal');
        expect(own.length + others.length).toBe(2);
        expect(others).toHaveLength(2);
    });

    it('puts the module\'s own people first', () => {
        const mixed = [
            { id: 1, name: 'Maternal', imci_sub_type: 'Emergency Maternal Care' },
            { id: 2, name: 'Newborn', imci_sub_type: 'Emergency Newborn Care' },
        ];
        const { own, others } = participantsForModule(mixed, course, 'neonatal');
        expect(own.map((p) => p.name)).toEqual(['Newborn']);
        expect(others.map((p) => p.name)).toEqual(['Maternal']);
    });

    it('counts an EENC sub-course as newborn', () => {
        const { own } = participantsForModule(
            [{ id: 1, name: 'O', imci_sub_type: 'EENC Orientation' }], course, 'neonatal');
        expect(own).toHaveLength(1);
    });

    it('treats somebody unassigned as this module\'s', () => {
        // Nothing says otherwise, and the observer in front of them is the
        // better judge than a blank field.
        const { own } = participantsForModule([{ id: 1, name: 'U' }], course, 'neonatal');
        expect(own).toHaveLength(1);
    });

    it('reads the group when the person has no sub-course', () => {
        const withGroups = { facilitatorAssignments: [{ group: 'A', imci_sub_type: 'Emergency Maternal Care' }] };
        const { own, others } = participantsForModule(
            [{ id: 1, name: 'G', group: 'A' }], withGroups, 'neonatal');
        expect(own).toHaveLength(0);
        expect(others).toHaveLength(1);
    });

    // =========================================================================
    // Reported from a real course: Group A was set up as Emergency Maternal
    // Care and Group B as Emergency Newborn Care, and the newborn link still
    // listed nobody as its own. Every participant had been registered with the
    // maternal sub-course, and that field was being read first.
    //
    // The course setup is the authority. A group assigned to the newborn part
    // IS the newborn part, whatever got typed into a registration form.
    // =========================================================================
    const twoStreamCourse = {
        facilitatorAssignments: [
            { group: 'Group A', imci_sub_type: 'Emergency Maternal Care' },
            { group: 'Group B', imci_sub_type: 'Emergency Newborn Care' },
        ],
    };

    it('lets the group override a wrongly registered sub-course', () => {
        const people = [
            { id: 1, name: 'A1', group: 'Group A', imci_sub_type: 'Emergency Maternal Care' },
            // Registered maternal, but sitting the newborn part.
            { id: 2, name: 'B1', group: 'Group B', imci_sub_type: 'Emergency Maternal Care' },
        ];

        const newborn = participantsForModule(people, twoStreamCourse, 'neonatal');
        expect(newborn.own.map((p) => p.name)).toEqual(['B1']);

        const maternal = participantsForModule(people, twoStreamCourse, 'maternal');
        expect(maternal.own.map((p) => p.name)).toEqual(['A1']);
    });

    it('still asks the record when the group is assigned both parts', () => {
        // Two facilitators, two sub-courses, one group: the course is not
        // saying which part this person sits, so the record gets its say.
        const bothCourse = {
            facilitatorAssignments: [
                { group: 'Group A', imci_sub_type: 'Emergency Maternal Care' },
                { group: 'Group A', imci_sub_type: 'Emergency Newborn Care' },
            ],
        };
        const { own } = participantsForModule(
            [{ id: 1, name: 'N', group: 'Group A', imci_sub_type: 'Emergency Newborn Care' }],
            bothCourse, 'neonatal');
        expect(own).toHaveLength(1);
    });

    it('names the part a group is sitting, for the registration form', () => {
        expect(subCourseOfGroup(twoStreamCourse, 'Group A')).toBe('Emergency Maternal Care');
        expect(subCourseOfGroup(twoStreamCourse, 'Group B')).toBe('Emergency Newborn Care');
        // Nothing to say, rather than a guess.
        expect(subCourseOfGroup(twoStreamCourse, 'Group C')).toBeNull();
        expect(subCourseOfGroup(null, 'Group A')).toBeNull();
        expect(subCourseOfGroup(twoStreamCourse, '')).toBeNull();
    });

    it('survives missing inputs rather than throwing mid-observation', () => {
        expect(participantsForModule(null, null, 'neonatal')).toEqual({ own: [], others: [] });
        expect(participantsForModule([], undefined, 'maternal')).toEqual({ own: [], others: [] });
    });
});
