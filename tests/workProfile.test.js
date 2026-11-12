import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/firebase', () => ({ db: {} }));

const {
    missingWorkFields, isWorkProfileComplete, cleanWorkProfile, describeWorkplace, describeJob,
    suggestedGroup, registrationKind, summarizeRegistrations, hrRecordFor,
} = await import('../src/utils/workProfile.js');

const facilityWorker = { jobTitle: 'nurse', state: 'Gezira', locality: 'Madani', workplaceType: 'facility', facilityId: 'f1', facilityName: 'Madani Hospital' };
const mohWorker = { jobTitle: 'public_health', state: 'Federal', locality: 'Federal', workplaceType: 'moh', program: 'nutrition' };

describe('work profile checks', () => {
    it('asks for the fields each workplace needs', () => {
        expect(missingWorkFields({})).toEqual(['jobTitle', 'state', 'locality', 'workplaceType']);
        expect(missingWorkFields({ ...facilityWorker, facilityName: ' ' })).toEqual(['facilityName']);
        expect(missingWorkFields({ ...mohWorker, program: '' })).toEqual(['program']);
        expect(missingWorkFields({ ...mohWorker, program: 'other' })).toEqual(['programOther']);
        expect(missingWorkFields({ ...mohWorker, workplaceType: 'organization' })).toEqual(['organizationName']);
        expect(missingWorkFields({ ...facilityWorker, jobTitle: 'other' })).toEqual(['jobTitleOther']);
        expect(isWorkProfileComplete(facilityWorker)).toBe(true);
        expect(isWorkProfileComplete(mohWorker)).toBe(true);
        expect(isWorkProfileComplete(null)).toBe(false);
    });

    it('keeps only the fields of the chosen workplace', () => {
        const clean = cleanWorkProfile({ ...facilityWorker, program: 'epi', organizationName: 'X', jobTitleOther: 'left over' });
        expect(clean.program).toBe('');
        expect(clean.organizationName).toBe('');
        expect(clean.jobTitleOther).toBe('');
        expect(clean.facilityName).toBe('Madani Hospital');
    });

    it('describes job and workplace in both languages', () => {
        expect(describeWorkplace(facilityWorker)).toBe('Health facility: Madani Hospital');
        expect(describeWorkplace(mohWorker, 'ar')).toBe('وزارة الصحة: برنامج التغذية');
        expect(describeJob({ jobTitle: 'other', jobTitleOther: 'Midwife' })).toBe('Midwife');
        expect(describeJob({ jobTitle: 'pharmacist' }, 'ar')).toBe('صيدلي');
    });

    it('suggests the team level from the workplace', () => {
        expect(suggestedGroup(mohWorker)).toBe('program_team_federal');
        expect(suggestedGroup({ ...facilityWorker, workplaceType: 'locality' })).toBe('program_team_locality');
        expect(suggestedGroup(facilityWorker)).toBe('program_team_state');
        expect(suggestedGroup({ workplaceType: 'organization' })).toBe('partner');
    });
});

describe('registrations dashboard', () => {
    const now = Date.UTC(2026, 10, 12);
    const day = 86400000;
    const users = [
        { id: 'a', createdAt: { seconds: (now - 3 * day) / 1000 }, workProfile: facilityWorker, hrRequest: { group: 'facilitator', status: 'pending' } },
        { id: 'b', createdAt: { seconds: (now - 60 * day) / 1000 }, workProfile: mohWorker },
        { id: 'c' },
    ];

    it('counts accounts without a creation date as existing', () => {
        expect(registrationKind(users[0], now, 30)).toBe('new');
        expect(registrationKind(users[1], now, 30)).toBe('existing');
        expect(registrationKind(users[1], now, 90)).toBe('new');
        expect(registrationKind(users[2], now, 30)).toBe('existing');
    });

    it('summarizes totals and breakdowns', () => {
        const s = summarizeRegistrations(users, now, 30);
        expect(s).toMatchObject({ total: 3, newUsers: 1, existing: 2, completed: 2, missing: 1, pending: 1 });
        expect(s.byJob).toEqual({ nurse: 1, public_health: 1 });
        expect(s.byState).toEqual({ Gezira: 1, Federal: 1 });
    });

    it('builds the HR record for each group', () => {
        const u = { id: 'a', displayName: 'Sara', email: 's@x.org', workProfile: { ...facilityWorker, phone: '0912' } };
        expect(hrRecordFor(u, 'facilitator')).toMatchObject({ name: 'Sara', currentState: 'Gezira', currentLocality: 'Madani', backgroundQualification: 'Nurse' });
        expect(hrRecordFor(u, 'program_team_locality')).toMatchObject({ state: 'Gezira', locality: 'Madani', unit: 'Madani Hospital', jobTitle: 'Nurse' });
        expect(hrRecordFor(u, 'program_team_state').locality).toBe('');
        expect(hrRecordFor({ ...u, workProfile: { ...u.workProfile, organizationName: 'UNICEF' } }, 'partner')).toMatchObject({ orgName: 'UNICEF', focalPerson: 'Sara', phoneNumber: '0912' });
    });
});
