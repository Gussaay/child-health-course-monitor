import { describe, it, expect } from 'vitest';
import {
    ALL, buildFilterOptions, filterCourses, filterParticipants, buildCourseTypeReport,
    aggregateCoverage, mergeEmoncModuleSummaries, getImprovementCategory,
} from '../src/components/courseTypeReport.js';

const courses = [
    {
        id: 'c1', course_type: 'IMNCI', state: 'Khartoum', locality: 'Bahri', start_date: '2025-02-10',
        course_project: 'P1', funded_by: 'UNICEF', course_budget: 1000,
        facilitatorAssignments: [{ group: 'Group A', imci_sub_type: 'Standard' }, { group: 'Group B', imci_sub_type: 'Refresher' }],
        coverageSnapshot: {
            stateCoverage: [{ name: 'Khartoum', totalPhc: 100, phcWithImnciBefore: 40, newPhc: 2 }],
            localityCoverage: [{ name: 'Bahri', totalPhc: 20, phcWithImnciBefore: 5, newPhc: 2 }],
        },
    },
    {
        id: 'c2', course_type: 'IMNCI', states: ['Khartoum'], localities: ['Omdurman'], start_date: '2025-06-01',
        course_project: 'P2', funded_by: 'WHO', course_budget: 3000,
        facilitatorAssignments: [{ group: 'Group A', imci_sub_type: 'Standard' }],
        coverageSnapshot: {
            stateCoverage: [{ name: 'Khartoum', totalPhc: 100, phcWithImnciBefore: 42, newPhc: 3 }],
            localityCoverage: [{ name: 'Omdurman', totalPhc: 30, phcWithImnciBefore: 10, newPhc: 3 }],
        },
    },
    { id: 'c3', course_type: 'IMNCI', state: 'Gezira', locality: 'Medani', start_date: '2024-11-01', course_project: 'P1', funded_by: 'UNICEF' },
    { id: 'c4', course_type: 'IMNCI', state: 'Gezira', locality: 'Medani', start_date: '2025-01-01', inRecycleBin: true },
];

const participants = [
    { id: 'p1', courseId: 'c1', name: 'A', group: 'Group A', pre_test_score: 50, post_test_score: 80, state: 'Khartoum', locality: 'Bahri', center_name: 'F1', introduced_imci_to_facility: true },
    { id: 'p2', courseId: 'c1', name: 'B', group: 'Group B', pre_test_score: 60, post_test_score: 66 },
    { id: 'p3', courseId: 'c2', name: 'C', group: 'Group A', pre_test_score: 40, post_test_score: 70, state: 'Khartoum', locality: 'Omdurman', center_name: 'مستشفى X', introduced_imci_to_facility: 'true' },
    { id: 'p4', courseId: 'c3', name: 'D', group: 'Group A' },
    { id: 'p5', courseId: 'c1', name: 'Deleted', isDeleted: true },
];

describe('filterCourses', () => {
    it('drops recycled courses and applies state, locality, project, partner and date filters', () => {
        expect(filterCourses(courses).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
        expect(filterCourses(courses, { state: 'Khartoum' }).map((c) => c.id)).toEqual(['c1', 'c2']);
        expect(filterCourses(courses, { locality: 'Omdurman' }).map((c) => c.id)).toEqual(['c2']);
        expect(filterCourses(courses, { project: 'P1' }).map((c) => c.id)).toEqual(['c1', 'c3']);
        expect(filterCourses(courses, { partner: 'WHO' }).map((c) => c.id)).toEqual(['c2']);
        expect(filterCourses(courses, { dateFrom: '2025-01-01', dateTo: '2025-02-10' }).map((c) => c.id)).toEqual(['c1']);
        expect(filterCourses(courses, { subType: 'Refresher' }).map((c) => c.id)).toEqual(['c1']);
    });

    it('filters by month, inclusive at both ends', () => {
        expect(filterCourses(courses, { dateFrom: '2025-02', dateTo: '2025-06' }).map((c) => c.id)).toEqual(['c1', 'c2']);
        expect(filterCourses(courses, { dateTo: '2024-11' }).map((c) => c.id)).toEqual(['c3']);
        expect(buildFilterOptions(courses).months).toEqual(['2025-06', '2025-02', '2025-01', '2024-11']);
    });

    it('offers localities only within the chosen state', () => {
        expect(buildFilterOptions(courses, { state: 'Gezira' }).localities).toEqual([ALL, 'Medani']);
        expect(buildFilterOptions(courses).states).toEqual([ALL, 'Gezira', 'Khartoum']);
    });
});

describe('filterParticipants', () => {
    it('keeps only the sub-course\'s own participants when filtering by sub-course', () => {
        const list = filterCourses(courses, { subType: 'Refresher' });
        expect(filterParticipants(participants, list, { subType: 'Refresher' }).map((p) => p.id)).toEqual(['p2']);
        expect(filterParticipants(participants, list).map((p) => p.id)).toEqual(['p1', 'p2']);
    });
});

describe('buildCourseTypeReport', () => {
    const list = filterCourses(courses);
    const pax = filterParticipants(participants, list);
    const observations = [
        { participant_id: 'p1', item_correct: 1, day_of_course: 1 },
        { participant_id: 'p1', item_correct: 0, day_of_course: 2 },
        { participant_id: 'p3', item_correct: 1, day_of_course: 1 },
        { participant_id: 'p5', item_correct: 1, day_of_course: 1 }, // deleted participant
    ];
    const cases = [
        { participant_id: 'p1', is_correct: true, day_of_course: 1 },
        { participant_id: 'p3', is_correct: false, day_of_course: 1 },
    ];
    const report = buildCourseTypeReport({ courses: list, participants: pax, observations, cases });

    it('pools cases and skills across courses', () => {
        expect(report.summary.totalCourses).toBe(3);
        expect(report.summary.totalParticipants).toBe(4);
        expect(report.overall.totalSkills).toBe(3);
        expect(report.overall.correctSkills).toBe(2);
        expect(report.overall.totalCases).toBe(2);
        expect(report.overall.caseCorrectnessPercentage).toBe(50);
    });

    it('averages test scores over everyone with a result', () => {
        expect(report.preTestStats.avg).toBe(50);
        expect(report.postTestStats.avg).toBe(72);
        expect(report.totalImprovement).toBeCloseTo(44, 5);
        expect(report.improvementDistribution['Data Incomplete']).toBe(1);
    });

    it('builds day-by-group tables with totals', () => {
        expect(report.days).toEqual(['Day 1', 'Day 2']);
        const day1 = report.dailySkills.rows[0];
        expect(day1.cells['Group A']).toMatchObject({ correct: 2, total: 2 });
        expect(report.dailySkills.totals.total).toBe(3);
        expect(report.dailyCases.totals).toMatchObject({ correct: 1, total: 2 });
    });

    it('breaks results down by state, project and sub-course', () => {
        const kh = report.breakdowns.byState.find((r) => r.key === 'Khartoum');
        expect(kh).toMatchObject({ courses: 2, participants: 3, budget: 4000 });
        const p1 = report.breakdowns.byProject.find((r) => r.key === 'P1');
        expect(p1).toMatchObject({ courses: 2, participants: 3 });
        const refresher = report.breakdowns.bySubType.find((r) => r.key === 'Refresher');
        expect(refresher.participants).toBe(1);
        expect(report.breakdowns.byCourse.map((c) => c.id)).toEqual(['c2', 'c1', 'c3']);
    });

    it('summarises participant results as overall figures', () => {
        expect(report.participantSummary).toMatchObject({
            total: 4, practicalAssessed: 2, avgPracticalScore: 75, practicalPassRate: 50,
            withBothTests: 3, improvedRate: 100,
        });
        expect(report.participantSummary.avgIncrease).toBeCloseTo((60 + 10 + 75) / 3, 5);
    });

    it('computes investment and lists new IMNCI facilities, telling hospitals apart', () => {
        expect(report.investment.totalBudget).toBe(4000);
        expect(report.investment.costPerParticipant).toBe(1000);
        expect(report.investment.costPerNewFacility).toBe(800);
        expect(report.newImciFacilities.map((f) => [f.name, f.isHospital])).toEqual([
            ['F1', false], ['مستشفى X', true],
        ]);
    });
});

describe('aggregateCoverage', () => {
    it('uses the earliest baseline and adds every course\'s new PHCs', () => {
        const cov = aggregateCoverage(filterCourses(courses));
        expect(cov.coursesWithSnapshot).toBe(2);
        expect(cov.coursesWithoutSnapshot).toBe(1);
        const kh = cov.stateCoverage[0];
        expect(kh).toMatchObject({ name: 'Khartoum', totalPhc: 100, phcWithImnciBefore: 40, newPhc: 5 });
        expect(kh.covBefore).toBe(40);
        expect(kh.covAfter).toBe(45);
        expect(cov.localityCoverage.map((l) => l.name)).toEqual(['Bahri', 'Omdurman']);
    });
});

describe('mergeEmoncModuleSummaries', () => {
    it('pools rows per module and recomputes the averages', () => {
        const section = { key: 'eenc', part: 1, title: 'EENC', shortTitle: 'EENC' };
        const mk = (prePct, postPct) => ({ prePct, postPct, increase: ((postPct - prePct) / prePct) * 100, preParts: [{ percentage: prePct }], postParts: [{ percentage: postPct }] });
        const merged = mergeEmoncModuleSummaries([
            { course: { id: 'a', state: 'X', start_date: '2025-01-01' }, summary: { modules: [{ module: 'EENC', label: 'EENC', sections: [section], rows: [mk(40, 80)] }] } },
            { course: { id: 'b', state: 'Y', start_date: '2025-02-01' }, summary: { modules: [{ module: 'EENC', label: 'EENC', sections: [section], rows: [mk(60, 90)] }] } },
            { course: { id: 'c' }, summary: null },
        ]);
        expect(merged.modules).toHaveLength(1);
        const m = merged.modules[0];
        expect(m.stats).toMatchObject({ participantCount: 2, preAvg: 50, postAvg: 85 });
        expect(m.parts[0]).toMatchObject({ preAvg: 50, postAvg: 85 });
        expect(m.rows[0].courseState).toBe('X');
    });

    it('returns null when no course has results', () => {
        expect(mergeEmoncModuleSummaries([{ course: {}, summary: null }])).toBeNull();
    });
});

describe('getImprovementCategory', () => {
    it('matches the single course report thresholds', () => {
        expect(getImprovementCategory(50, 80)).toBe('Perfect');
        expect(getImprovementCategory(50, 66)).toBe('Excellent');
        expect(getImprovementCategory(50, 58)).toBe('Good');
        expect(getImprovementCategory(50, 52)).toBe('Fair');
        expect(getImprovementCategory(50, 40)).toBe('Fail');
        expect(getImprovementCategory(0, 40)).toBe('Data Incomplete');
    });
});
