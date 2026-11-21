// facilitatorOptions (src/utils/facilitatorOptions.js): the course form's
// director / clinical instructor / facilitator pickers must offer the whole
// facilitator list — a package with nobody tagged for it yet (a new Small &
// Sick Newborn course) used to get an empty search, so no director could be
// chosen and the course could not be created.
import { describe, it, expect } from 'vitest';
import { facilitatorOptionsFor } from '../src/utils/facilitatorOptions';

const LIST = [
    { id: '1', name: 'Zeinab Ahmed', courses: ['IMNCI'] },
    { id: '2', name: 'Ahmed Ali', courses: ['SSNC'] },
    { id: '3', name: 'Mona Said', courses: ['Small & Sick Newborn'] },
    { id: '4', name: 'Deleted Person', courses: ['SSNC'], isDeleted: true },
    { id: '5', name: 'Khalid Noor', courses: [] },
];
const isSsnc = (f) => (f.courses || []).includes('SSNC') || (f.courses || []).includes('Small & Sick Newborn');

describe('facilitatorOptionsFor', () => {
    it('keeps everyone on the list, with the package-tagged people first, each group by name', () => {
        const out = facilitatorOptionsFor(LIST, isSsnc);
        expect(out.map((f) => f.id)).toEqual(['2', '3', '5', '1']);
    });

    it('with nobody tagged for the package, still offers the whole list by name', () => {
        const out = facilitatorOptionsFor(LIST, () => false);
        expect(out.map((f) => f.id)).toEqual(['2', '5', '3', '1']);
    });

    it('excludes deleted facilitators and tolerates a missing list', () => {
        expect(facilitatorOptionsFor(LIST, isSsnc).some((f) => f.isDeleted)).toBe(false);
        expect(facilitatorOptionsFor(null, isSsnc)).toEqual([]);
        expect(facilitatorOptionsFor(undefined, isSsnc)).toEqual([]);
    });

    it('does not mutate the input list', () => {
        const before = LIST.map((f) => f.id);
        facilitatorOptionsFor(LIST, isSsnc);
        expect(LIST.map((f) => f.id)).toEqual(before);
    });
});
