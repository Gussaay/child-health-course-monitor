import { describe, expect, it } from 'vitest';
import { computeCoverage, computeHomeStats, levelFromPermissions } from '../src/utils/homeStats';

const courses = [
    { id: 'c1', course_type: 'IMNCI', state: 'Gezira', locality: 'Wad Madani', start_date: '2026-03-01' },
    { id: 'c2', course_type: 'ETAT', state: 'Gezira', locality: 'Hasahisa', start_date: '2026-05-01' },
    { id: 'c3', course_type: 'IMNCI', state: 'Khartoum', locality: 'Bahri', start_date: '2026-02-01' },
    { id: 'c4', course_type: 'IMNCI', state: 'Gezira', locality: 'Wad Madani', start_date: '2025-02-01' },
    { id: 'c5', course_type: 'IMNCI', state: 'Gezira', locality: 'Wad Madani', start_date: '2026-02-01', isDeleted: true },
];
const participants = [
    { id: 'p1', courseId: 'c1', post_test_score: 80 },
    { id: 'p2', courseId: 'c1', post_test_score: 90 },
    { id: 'p3', courseId: 'c2', post_test_score: '' },
    { id: 'p4', courseId: 'c3', post_test_score: 70 },
    { id: 'p5', courseId: 'c4', post_test_score: 50 },
];
const sessions = [
    { service: 'IMNCI', state: 'Gezira', locality: 'Wad Madani', sessionDate: '2026-04-01', status: 'complete' },
    { service: 'IMNCI', state: 'Gezira', locality: 'Wad Madani', sessionDate: '2026-04-02', status: 'draft' },
    { service: 'EENC', state: 'Gezira', locality: 'Hasahisa', sessionDate: '2026-04-03', status: 'complete' },
    { service: 'IMNCI', state: 'Khartoum', locality: 'Bahri', sessionDate: '2026-04-03' },
];
const facilitators = [{ currentState: 'Gezira' }, { currentState: 'Khartoum' }];
const base = { courses, participants, sessions, facilitators, year: 2026 };

describe('home stats', () => {
    it('reads the level from the location permission', () => {
        expect(levelFromPermissions({ manageLocation: 'user_state' })).toBe('state');
        expect(levelFromPermissions({ manageLocation: 'user_locality' })).toBe('locality');
        expect(levelFromPermissions({ manageLocation: 'federal_level' })).toBe('federal');
        expect(levelFromPermissions({})).toBe('federal');
    });

    it('counts everything this year at federal level', () => {
        const s = computeHomeStats({ ...base, level: 'federal' });
        expect(s).toMatchObject({ courses: 3, participants: 4, averageScore: 80, visits: 3, facilitators: 2, focus: null });
    });

    it('limits to the state, and to IMNCI for the IMNCI unit', () => {
        const s = computeHomeStats({ ...base, level: 'state', states: ['Gezira'], unit: 'العلاج المتكامل للاطفال اقل من 5 سنوات' });
        expect(s).toMatchObject({ courses: 1, participants: 2, averageScore: 85, visits: 1, facilitators: 1, focus: 'IMNCI' });
    });

    it('limits to the locality and has no facilitator count there', () => {
        const s = computeHomeStats({ ...base, level: 'locality', localities: ['Hasahisa'] });
        expect(s).toMatchObject({ courses: 1, participants: 1, averageScore: null, visits: 1, facilitators: null });
    });

    it('leaves numbers empty while their data is loading', () => {
        const s = computeHomeStats({ level: 'federal', courses: null, participants: null, sessions: null, facilitators: null });
        expect(s).toMatchObject({ courses: null, participants: null, visits: null, facilitators: null, scoresLoaded: false });
    });

    it('counts each facility reached once', () => {
        const visits = [
            { facilityId: 'f1', state: 'Gezira', locality: 'A', sessionDate: '2026-04-01', service: 'IMNCI' },
            { facilityId: 'f1', state: 'Gezira', locality: 'A', sessionDate: '2026-05-01', service: 'IMNCI' },
            { facilityName: 'Clinic', state: 'Gezira', locality: 'A', sessionDate: '2026-05-01', service: 'IMNCI' },
            { facilityId: 'f2', state: 'Gezira', locality: 'A', sessionDate: '2026-05-01', service: 'IMNCI', status: 'draft' },
        ];
        expect(computeHomeStats({ ...base, level: 'federal', sessions: visits }).facilitiesReached).toBe(2);
    });
});

describe('home coverage', () => {
    const phc = { 'نوع_المؤسسةالصحية': 'مركز صحة الاسرة', 'هل_المؤسسة_تعمل': 'Yes', 'الولاية': 'Gezira', 'المحلية': 'A' };
    const facilities = [
        { ...phc, 'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes' },
        { ...phc, 'وجود_العلاج_المتكامل_لامراض_الطفولة': 'No' },
        { ...phc, 'الولاية': 'Khartoum', 'المحلية': 'B', 'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes' },
        { 'نوع_المؤسسةالصحية': 'مستشفى', 'هل_المؤسسة_تعمل': 'Yes', 'الولاية': 'Gezira', 'المحلية': 'A', etat_has_service: 'Yes', eenc_service_type: 'CEmONC', eenc_provides_essential_care: 'Yes', neonatal_level_secondary: 'Yes' },
        { ...phc, 'وجود_العلاج_المتكامل_لامراض_الطفولة': 'Yes', isDeleted: true },
    ];

    it('waits for the facilities', () => {
        expect(computeCoverage({ level: 'federal', facilities: null })).toBeNull();
    });

    it('works out each service and the overall average', () => {
        const c = computeCoverage({ level: 'federal', facilities });
        expect(c.services.imnci).toEqual({ n: 2, d: 3, perc: 66.7 });
        expect(c.services.etat.perc).toBe(100);
        expect(c.services.eenc.perc).toBe(100);
        expect(c.services.scnu.perc).toBe(100);
        expect(c.overall).toBe(91.7);
    });

    it('keeps to the person\'s state', () => {
        const c = computeCoverage({ level: 'state', states: ['Khartoum'], facilities });
        expect(c.services.imnci).toEqual({ n: 1, d: 1, perc: 100 });
        expect(c.services.etat.d).toBe(0);
    });
});
