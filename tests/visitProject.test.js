import { describe, it, expect } from 'vitest';
import { projectAtTime, projectOfVisit, projectOfFacility, visitTimeOf, isRealProject, hasRecordedProject } from '../src/utils/visitProject.js';

const ts = (iso) => ({ seconds: Date.parse(iso) / 1000 });

// A facility under SHARE until June 2025, then moved to Model of Care.
const snapshots = [
    { effectiveDate: ts('2025-01-10T00:00:00Z'), project_participation: 'Yes', project_name: 'SHARE' },
    { effectiveDate: ts('2025-06-01T00:00:00Z'), project_participation: 'Yes', project_name: 'Model of Care' },
];
const facilityNow = { project_participation: 'Yes', project_name: 'Model of Care' };

describe('projectAtTime', () => {
    it('gives a visit the project that covered the facility on the day', () => {
        expect(projectAtTime(snapshots, facilityNow, Date.parse('2025-03-15'))).toBe('SHARE');
        expect(projectAtTime(snapshots, facilityNow, Date.parse('2025-06-01T12:00:00Z'))).toBe('Model of Care');
        expect(projectAtTime(snapshots, facilityNow, Date.parse('2026-01-01'))).toBe('Model of Care');
    });

    it('uses the earliest record for a visit older than the facility history', () => {
        expect(projectAtTime(snapshots, facilityNow, Date.parse('2024-12-01'))).toBe('SHARE');
    });

    it('uses the current record when there is no history', () => {
        expect(projectAtTime([], facilityNow, Date.parse('2024-12-01'))).toBe('Model of Care');
    });

    it('treats a facility outside any project as having none', () => {
        const left = [...snapshots, { effectiveDate: ts('2025-09-01T00:00:00Z'), project_participation: 'No', project_name: 'Model of Care' }];
        expect(projectAtTime(left, facilityNow, Date.parse('2025-10-01'))).toBe('');
    });
});

describe('projectOfVisit', () => {
    it('keeps the project a visit recorded, whatever the facility says now', () => {
        expect(projectOfVisit({ project: 'SHARE' }, facilityNow)).toBe('SHARE');
        expect(projectOfVisit({ fullData: { project: 'SHARE' } }, facilityNow)).toBe('SHARE');
    });

    it('keeps "no project" when that is what the visit recorded', () => {
        expect(projectOfVisit({ project: 'N/A' }, facilityNow)).toBe('');
    });

    it('falls back to the facility only for a visit that recorded nothing', () => {
        expect(projectOfVisit({}, facilityNow)).toBe('Model of Care');
    });
});

describe('visit dates and values', () => {
    it('reads the date from sessions and visit reports', () => {
        expect(visitTimeOf({ sessionDate: '2025-03-15' })).toBe(Date.parse('2025-03-15T23:59:59'));
        expect(visitTimeOf({ visitDate: '2025-03-15' })).toBe(Date.parse('2025-03-15T23:59:59'));
        expect(visitTimeOf({ effectiveDate: ts('2025-03-15T08:00:00Z') })).toBe(Date.parse('2025-03-15T08:00:00Z'));
        expect(visitTimeOf({})).toBeNull();
    });

    it('knows whether a visit recorded a project', () => {
        expect(hasRecordedProject({ project: 'N/A' })).toBe(true);
        expect(hasRecordedProject({ fullData: { project: '' } })).toBe(true);
        expect(hasRecordedProject({ facilityId: 'x' })).toBe(false);
    });

    it('recognises placeholders that are not projects', () => {
        expect(isRealProject('N/A')).toBe(false);
        expect(isRealProject(' ')).toBe(false);
        expect(isRealProject('SHARE')).toBe(true);
        expect(projectOfFacility({ project_participation: 'No', project_name: 'SHARE' })).toBe('');
        expect(projectOfFacility({ 'المشروع': 'SHARE' })).toBe('SHARE');
    });
});
