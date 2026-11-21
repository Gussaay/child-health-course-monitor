// Live enrolment (src/components/imnci/onlineCourses/enrolment.js): the
// short re-check cycle that lets a join request reach the manager's list,
// and an approval open the course for the learner, without a reload.
// These tests pin the two decisions the polling stands on: how often it
// runs, and when the learner's side keeps polling at all.
import { describe, it, expect } from 'vitest';
import { ENROL_LIVE_MS, enrolmentWaiting } from '../src/components/imnci/onlineCourses/enrolment';

describe('enrolmentWaiting', () => {
    it('is true while any enrolment is still waiting on a manager', () => {
        expect(enrolmentWaiting([{ status: 'approved' }, { status: 'requested' }])).toBe(true);
        expect(enrolmentWaiting([{ status: 'requested' }])).toBe(true);
    });

    it('is false once nothing is waiting, so the polling stops', () => {
        expect(enrolmentWaiting([{ status: 'approved' }])).toBe(false);
        expect(enrolmentWaiting([{ status: 'declined' }])).toBe(false);
        expect(enrolmentWaiting([])).toBe(false);
    });

    it('tolerates a missing list', () => {
        expect(enrolmentWaiting(undefined)).toBe(false);
        expect(enrolmentWaiting(null)).toBe(false);
    });
});

describe('ENROL_LIVE_MS', () => {
    it('is a short cycle — seconds, not minutes — so changes feel live', () => {
        expect(ENROL_LIVE_MS).toBeGreaterThanOrEqual(5000);
        expect(ENROL_LIVE_MS).toBeLessThan(60000);
    });
});
