import { describe, it, expect } from 'vitest';
import {
    EMONC_TEST_MODULES, EENC_ONLY_MODULE, isEencOnlySubCourse,
    getTestSections, getParticipantAssignedModule, getStoredTestType,
    getTestRecordModule, reviseEencOnlyTest, scoreEencOnly, isEencOnlyCourse,
} from '../src/components/CourseTestForm';
import { buildEmoncModuleTestSummary } from '../src/components/CourseReportView';

// =============================================================================
// EmONC has five sub-courses. Two are the full course — EENC plus their own
// subject. The other three teach EENC and nothing else.
//
// The test builder asked only "is this Emergency Maternal Care?" and gave
// everything else the neonatal questions. Somebody who had sat a two-day EENC
// orientation was therefore examined on emergency newborn care they had never
// been taught, and scored accordingly.
// =============================================================================

describe('isEencOnlySubCourse', () => {
    it('recognises the EENC-only sub-courses', () => {
        ['EENC Orientation', 'EENC TOT', 'EENC Mentorship'].forEach((name) => {
            expect(isEencOnlySubCourse(name)).toBe(true);
        });
    });

    it('covers an EENC sub-course added later, without being told about it', () => {
        expect(isEencOnlySubCourse('EENC Refresher')).toBe(true);
        expect(isEencOnlySubCourse('eenc orientation')).toBe(true);
    });

    it('does NOT catch the two full modules', () => {
        expect(isEencOnlySubCourse('Emergency Newborn Care')).toBe(false);
        expect(isEencOnlySubCourse('Emergency Maternal Care')).toBe(false);
    });

    it('is not fooled by a word that merely starts with those letters', () => {
        expect(isEencOnlySubCourse('EENCOMPASSING something')).toBe(false);
        expect(isEencOnlySubCourse('')).toBe(false);
        expect(isEencOnlySubCourse(null)).toBe(false);
    });
});

describe('getTestSections', () => {
    it('gives an EENC-only course one part', () => {
        const sections = getTestSections('EmONC', EENC_ONLY_MODULE);
        expect(sections).toHaveLength(1);
        expect(sections[0].key).toBe('eenc');
        expect(sections[0].part).toBe(1);
    });

    it('gives it one part when addressed by its sub-course name too', () => {
        expect(getTestSections('EmONC', 'EENC TOT')).toHaveLength(1);
    });

    it('still gives the full modules both parts', () => {
        expect(getTestSections('EmONC', 'Emergency Maternal Care')).toHaveLength(2);
        expect(getTestSections('EmONC', 'Emergency Newborn Care')).toHaveLength(2);
    });

    it('never puts newborn or maternal questions in the EENC-only test', () => {
        // The bug, stated directly.
        const [only] = getTestSections('EmONC', 'EENC Orientation');
        expect(only.questions.some((q) => String(q.id).startsWith('mat_'))).toBe(false);
        expect(only.title).toContain('EENC');
    });
});

describe('where an EENC-only result is filed', () => {
    it('reads the module off the participant sub-course', () => {
        expect(getParticipantAssignedModule({ imci_sub_type: 'EENC TOT' }, {}))
            .toBe(EENC_ONLY_MODULE);
    });

    it('keeps it in its own slot, not the Newborn one', () => {
        // Sharing the plain 'pre-test' type would make the Newborn pre-test
        // look already sat, which is the bug the maternal suffix exists for.
        expect(getStoredTestType('pre-test', EENC_ONLY_MODULE)).toBe('pre-test-eenc');
        expect(getStoredTestType('pre-test', 'Emergency Maternal Care')).toBe('pre-test-maternal');
        expect(getStoredTestType('pre-test', 'Emergency Newborn Care')).toBe('pre-test');
    });

    it('reads that slot back', () => {
        expect(getTestRecordModule({ testType: 'post-test-eenc' }, 'EmONC')).toBe(EENC_ONLY_MODULE);
    });

    it('offers EENC alongside the two full modules', () => {
        expect(EMONC_TEST_MODULES).toContain(EENC_ONLY_MODULE);
        expect(EMONC_TEST_MODULES).toHaveLength(3);
    });
});

// =============================================================================
// Correcting results recorded before EENC-only had its own test.
//
// Their EENC answers are real and were really given; the neonatal questions
// were asked in error and should not count against them. So the record is
// re-scored over the EENC questions only, from the answers already stored.
// Nothing is invented and no answer is changed.
// =============================================================================

describe('reviseEencOnlyTest', () => {
    const orientation = { id: 'p1', imci_sub_type: 'EENC Orientation' };
    const fullCourse = { id: 'p2', imci_sub_type: 'Emergency Newborn Care' };
    const record = (over = {}) => ({
        participantId: 'p1', courseType: 'EmONC', testType: 'pre-test',
        answers: {}, manualScores: {}, score: 9, total: 30, percentage: 30, ...over,
    });

    it('leaves alone somebody who really did sit the full course', () => {
        expect(reviseEencOnlyTest(record({ participantId: 'p2' }), fullCourse)).toBeNull();
    });

    it('moves an EENC-only record into the EENC slot', () => {
        const out = reviseEencOnlyTest(record(), orientation);
        expect(out.after.testType).toBe('pre-test-eenc');
        expect(out.after.module).toBe(EENC_ONLY_MODULE);
        expect(out.patch.baseTestType).toBe('pre-test');
    });

    it('re-scores out of the EENC questions alone', () => {
        const out = reviseEencOnlyTest(record(), orientation);
        // The old total counted questions that were never covered.
        expect(out.after.total).toBeLessThan(30);
        expect(out.after.total).toBeGreaterThan(0);
    });

    it('does not change any answer', () => {
        const answers = { q1: 'a', mat_3: 'b' };
        const out = reviseEencOnlyTest(record({ answers }), orientation);
        expect(out.patch.answers).toEqual(answers);
    });

    it('keeps what it said before, so the change can be answered for', () => {
        const out = reviseEencOnlyTest(record(), orientation);
        expect(out.patch.correctedFrom).toMatchObject({ testType: 'pre-test', score: 9, total: 30 });
        expect(out.patch.correctedReason).toBeTruthy();
    });

    it('does nothing the second time it is run', () => {
        const once = reviseEencOnlyTest(record(), orientation);
        expect(reviseEencOnlyTest(once.patch, orientation)).toBeNull();
    });

    it('leaves a deleted record alone', () => {
        expect(reviseEencOnlyTest(record({ isDeleted: true }), orientation)).toBeNull();
    });

    it('gives it a one-part breakdown, not a Part 2 of zero', () => {
        const out = reviseEencOnlyTest(record(), orientation);
        expect(out.patch.sectionScores).toHaveLength(1);
        expect(out.patch.sectionScores[0].key).toBe('eenc');
    });
});

// =============================================================================
// The report.
//
// Reported from the screen: an EENC Orientation course showed its participants
// under "Emergency Newborn Care — Participant Results" with Part 1: Newborn
// reading 0/15 → 0/15, and their overall mark as 7.4% → 37.0%. They had
// answered 10/12 on EENC. The fifteen neonatal questions were never put to
// them; they were being failed on a paper they did not sit.
// =============================================================================

describe('the EmONC report tables', () => {
    const course = { id: 'c1', course_type: 'EmONC', facilitatorAssignments: [] };
    const orientationPeople = [
        { id: 'p1', name: 'Somia', group: 'Group B', imci_sub_type: 'EENC Orientation' },
    ];
    // A legacy record: no module field, scored over EENC + neonatal, and every
    // neonatal answer absent because those questions were never asked.
    // Built from the real EENC questions, so the arithmetic below is the
    // arithmetic the report actually does.
    const eencMcQuestions = getTestSections('EmONC', EENC_ONLY_MODULE)[0]
        .questions.filter((q) => q.type === 'mc');
    const legacy = (testType, eencCorrect) => ({
        id: `t_${testType}`, participantId: 'p1', courseType: 'EmONC', testType,
        answers: Object.fromEntries(
            eencMcQuestions.slice(0, eencCorrect).map((q) => [q.id, q.correctAnswer])),
        manualScores: {},
        // What the old scheme stored: marked out of the whole paper.
        score: eencCorrect, total: 27, percentage: (eencCorrect / 27) * 100,
    });

    it('does not list an EENC-only participant under Emergency Newborn Care', () => {
        const summary = buildEmoncModuleTestSummary(
            course, orientationPeople, [legacy('pre-test', 2), legacy('post-test', 10)]);
        const newborn = summary?.modules.find((m) => m.module === 'Emergency Newborn Care');
        expect(newborn).toBeUndefined();
    });

    it('lists them under EENC instead', () => {
        const summary = buildEmoncModuleTestSummary(
            course, orientationPeople, [legacy('pre-test', 2), legacy('post-test', 10)]);
        const eenc = summary?.modules.find((m) => m.module === EENC_ONLY_MODULE);
        expect(eenc).toBeDefined();
        expect(eenc.rows).toHaveLength(1);
        expect(eenc.rows[0].name).toBe('Somia');
    });

    it('marks them out of the EENC questions, not the whole paper', () => {
        // 10 of 12 is 83%, not the 37% that 10 out of 27 produced.
        const summary = buildEmoncModuleTestSummary(
            course, orientationPeople, [legacy('pre-test', 2), legacy('post-test', 10)]);
        const row = summary.modules.find((m) => m.module === EENC_ONLY_MODULE).rows[0];
        expect(row.postPct).toBeGreaterThan(70);
        expect(row.postPct).toBeLessThanOrEqual(100);
    });

    it('shows one part for them, not a Newborn part of zero', () => {
        const summary = buildEmoncModuleTestSummary(
            course, orientationPeople, [legacy('post-test', 10)]);
        const mod = summary.modules.find((m) => m.module === EENC_ONLY_MODULE);
        expect(mod.parts).toHaveLength(1);
        expect(mod.parts[0].shortTitle).toBe('EENC');
    });

    it('leaves a real Emergency Newborn Care participant where they were', () => {
        const people = [{ id: 'p9', name: 'Ali', group: 'A', imci_sub_type: 'Emergency Newborn Care' }];
        const test = { id: 't9', participantId: 'p9', courseType: 'EmONC', testType: 'pre-test',
            answers: {}, manualScores: {}, score: 5, total: 27, percentage: 18.5 };
        const summary = buildEmoncModuleTestSummary(course, people, [test]);
        expect(summary.modules.find((m) => m.module === 'Emergency Newborn Care')).toBeDefined();
        expect(summary.modules.find((m) => m.module === EENC_ONLY_MODULE)).toBeUndefined();
    });
});

// =============================================================================
// An EENC course reports EENC and nothing else.
//
// Not "the newborn table comes out empty" — it must not be built at all. A
// single stray newborn record from the old test would otherwise keep that
// table alive and put a Part 1: Newborn column back into the report, which is
// the column that read 0/15 and looked like a failure.
// =============================================================================

describe('isEencOnlyCourse', () => {
    it('is true for a course whose type is EENC', () => {
        expect(isEencOnlyCourse({ course_type: 'EENC' })).toBe(true);
    });

    it('is true for an EmONC course whose own sub-course is EENC', () => {
        expect(isEencOnlyCourse({ course_type: 'EmONC', imci_sub_type: 'EENC TOT' })).toBe(true);
    });

    it('falls back to what is being taught when the course record does not say', () => {
        const course = { course_type: 'EmONC', facilitatorAssignments: [{ imci_sub_type: 'EENC Orientation' }] };
        expect(isEencOnlyCourse(course, [{ imci_sub_type: 'EENC Orientation' }])).toBe(true);
    });

    it('is false when any part of the course is a full module', () => {
        const course = { course_type: 'EmONC', facilitatorAssignments: [] };
        expect(isEencOnlyCourse(course, [
            { imci_sub_type: 'EENC Orientation' },
            { imci_sub_type: 'Emergency Maternal Care' },
        ])).toBe(false);
    });

    it('is false when nothing says either way', () => {
        expect(isEencOnlyCourse({ course_type: 'EmONC' }, [])).toBe(false);
        expect(isEencOnlyCourse(null)).toBe(false);
    });

    it('is false for a course that is not EmONC at all', () => {
        expect(isEencOnlyCourse({ course_type: 'IMNCI', imci_sub_type: 'EENC Orientation' })).toBe(false);
    });
});

describe('the report of an EENC course', () => {
    const eencCourse = { id: 'c2', course_type: 'EENC', facilitatorAssignments: [] };
    const people = [{ id: 'p1', name: 'Somia', group: 'B', imci_sub_type: 'EENC Orientation' }];

    it('has no newborn table even when a newborn record exists', () => {
        // The case stated in the request: solved, and still not shown.
        const strayNewborn = {
            id: 't1', participantId: 'p1', courseType: 'EENC', testType: 'pre-test',
            module: 'Emergency Newborn Care', answers: {}, manualScores: {},
            score: 12, total: 27, percentage: 44,
        };
        const summary = buildEmoncModuleTestSummary(eencCourse, people, [strayNewborn]);
        const names = (summary?.modules || []).map((m) => m.module);
        expect(names).not.toContain('Emergency Newborn Care');
        expect(names).not.toContain('Emergency Maternal Care');
    });

    it('reports that record under EENC, scored on the EENC questions', () => {
        const stray = {
            id: 't1', participantId: 'p1', courseType: 'EENC', testType: 'pre-test',
            module: 'Emergency Newborn Care', answers: {}, manualScores: {},
            score: 12, total: 27, percentage: 44,
        };
        const summary = buildEmoncModuleTestSummary(eencCourse, people, [stray]);
        expect(summary.modules).toHaveLength(1);
        expect(summary.modules[0].module).toBe(EENC_ONLY_MODULE);
        expect(summary.modules[0].parts).toHaveLength(1);
    });
});

// =============================================================================
// Reported from the screen a second time: the Emergency Newborn Care table was
// still there, with Somia at Part 1: Newborn 0/15 → 0/15 and EENC 2/12 → 10/12.
//
// The course was NOT detectable as EENC-only — it had a genuine mix — and her
// participant record did not say her sub-course was EENC. The registration
// data simply did not know. Her answers did: not one of the fifteen newborn
// questions was answered, in either test.
// =============================================================================

describe('who actually sat a module', () => {
    const mixedCourse = { id: 'c3', course_type: 'EmONC', facilitatorAssignments: [] };
    const sections = getTestSections('EmONC', 'Emergency Newborn Care');
    const newbornQs = sections.find((s) => s.key !== 'eenc').questions.filter((q) => q.type === 'mc');
    const eencQs = sections.find((s) => s.key === 'eenc').questions.filter((q) => q.type === 'mc');

    const answering = (questions, howMany, correct) => Object.fromEntries(
        questions.slice(0, howMany).map((q) => [q.id, correct ? q.correctAnswer : '__wrong__']));

    // Registered as Newborn, but never answered a newborn question.
    const somia = { id: 'p1', name: 'Somia', group: 'B', imci_sub_type: 'Emergency Newborn Care' };
    const somiaTests = [
        { id: 't1', participantId: 'p1', courseType: 'EmONC', testType: 'pre-test',
          answers: answering(eencQs, 2, true), manualScores: {}, score: 2, total: 27, percentage: 7.4 },
        { id: 't2', participantId: 'p1', courseType: 'EmONC', testType: 'post-test',
          answers: answering(eencQs, 10, true), manualScores: {}, score: 10, total: 27, percentage: 37 },
    ];

    it('does not list somebody who never answered a newborn question under Newborn', () => {
        const summary = buildEmoncModuleTestSummary(mixedCourse, [somia], somiaTests);
        const newborn = summary?.modules.find((m) => m.module === 'Emergency Newborn Care');
        expect(newborn).toBeUndefined();
    });

    it('lists them under EENC, marked out of the EENC questions', () => {
        const summary = buildEmoncModuleTestSummary(mixedCourse, [somia], somiaTests);
        const eenc = summary.modules.find((m) => m.module === EENC_ONLY_MODULE);
        expect(eenc.rows).toHaveLength(1);
        // 10 of 12 is 83%, not the 37% that 10 out of 27 gave.
        expect(eenc.rows[0].postPct).toBeGreaterThan(70);
    });

    it('DOES list somebody who answered them and got them wrong', () => {
        // Scoring zero is not the same as never sitting it, and hiding a real
        // result would be a worse fault than the one being fixed.
        const tried = { id: 'p2', name: 'Ali', group: 'A', imci_sub_type: 'Emergency Newborn Care' };
        const triedTests = [{
            id: 't3', participantId: 'p2', courseType: 'EmONC', testType: 'pre-test',
            answers: { ...answering(newbornQs, newbornQs.length, false), ...answering(eencQs, 3, true) },
            manualScores: {}, score: 3, total: 27, percentage: 11,
        }];
        const summary = buildEmoncModuleTestSummary(mixedCourse, [tried], triedTests);
        const newborn = summary.modules.find((m) => m.module === 'Emergency Newborn Care');
        expect(newborn).toBeDefined();
        expect(newborn.rows[0].name).toBe('Ali');
    });

    it('keeps the two apart in one mixed course', () => {
        const tried = { id: 'p2', name: 'Ali', group: 'A', imci_sub_type: 'Emergency Newborn Care' };
        const triedTests = [{
            id: 't3', participantId: 'p2', courseType: 'EmONC', testType: 'pre-test',
            answers: { ...answering(newbornQs, newbornQs.length, true), ...answering(eencQs, 3, true) },
            manualScores: {}, score: 18, total: 27, percentage: 67,
        }];
        const summary = buildEmoncModuleTestSummary(
            mixedCourse, [somia, tried], [...somiaTests, ...triedTests]);
        const newborn = summary.modules.find((m) => m.module === 'Emergency Newborn Care');
        const eenc = summary.modules.find((m) => m.module === EENC_ONLY_MODULE);
        expect(newborn.rows.map((r) => r.name)).toEqual(['Ali']);
        expect(eenc.rows.map((r) => r.name)).toEqual(['Somia']);
    });
});

describe('a record with no answers stored', () => {
    // Scores typed in by hand, and legacy imports, have no answers on them.
    // Their silence must not be read as "never sat it", or genuine Emergency
    // Newborn Care participants get moved out of their own table.
    it('leaves the participant where they were registered', () => {
        const course = { id: 'c4', course_type: 'EmONC', facilitatorAssignments: [] };
        const person = { id: 'p5', name: 'Manual', group: 'A', imci_sub_type: 'Emergency Newborn Care' };
        const typedIn = {
            id: 't5', participantId: 'p5', courseType: 'EmONC', testType: 'pre-test',
            answers: {}, manualScores: {}, score: 14, total: 27, percentage: 52,
        };
        const summary = buildEmoncModuleTestSummary(course, [person], [typedIn]);
        expect(summary.modules.find((m) => m.module === 'Emergency Newborn Care')).toBeDefined();
        expect(summary.modules.find((m) => m.module === EENC_ONLY_MODULE)).toBeUndefined();
    });
});

// =============================================================================
// The course in the screenshot: three groups, every one of them assigned
// "EENC Orientation". The participants had nonetheless been given the newborn
// questions by the old test and had answered them, and their records were
// registered under Emergency Newborn Care.
//
// The detection weighed the group assignments and the participant records
// together and demanded that all of them agree, so one mis-registered
// participant outvoted three groups that plainly said EENC Orientation.
// =============================================================================

describe('a course whose groups are all EENC Orientation', () => {
    const course = {
        id: 'c5', course_type: 'EmONC',
        facilitatorAssignments: [
            { group: 'Group A', imci_sub_type: 'EENC Orientation' },
            { group: 'Group B', imci_sub_type: 'EENC Orientation' },
            { group: 'Group C', imci_sub_type: 'EENC Orientation' },
        ],
    };
    // Registered wrongly, and they DID answer the newborn questions.
    const people = [
        { id: 'p1', name: 'Somia', group: 'Group B', imci_sub_type: 'Emergency Newborn Care' },
        { id: 'p2', name: 'Aisha', group: 'Group A', imci_sub_type: 'Emergency Newborn Care' },
    ];

    it('is an EENC course, whatever the participant records say', () => {
        expect(isEencOnlyCourse(course, people)).toBe(true);
    });

    it('is still an EENC course when a participant record disagrees', () => {
        // The exact failure: one wrong registration must not outvote the groups.
        expect(isEencOnlyCourse(course, [
            ...people, { id: 'p3', imci_sub_type: 'Emergency Maternal Care' },
        ])).toBe(true);
    });

    it('omits Emergency Newborn Care from the report even though it was answered', () => {
        const sections = getTestSections('EmONC', 'Emergency Newborn Care');
        const newbornQs = sections.find((s) => s.key !== 'eenc').questions.filter((q) => q.type === 'mc');
        const eencQs = sections.find((s) => s.key === 'eenc').questions.filter((q) => q.type === 'mc');
        const answered = (qs, n) => Object.fromEntries(qs.slice(0, n).map((q) => [q.id, q.correctAnswer]));

        const tests = [
            { id: 't1', participantId: 'p1', courseType: 'EmONC', testType: 'pre-test',
              answers: { ...answered(newbornQs, 6), ...answered(eencQs, 2) },
              manualScores: {}, score: 8, total: 27, percentage: 29.6 },
            { id: 't2', participantId: 'p1', courseType: 'EmONC', testType: 'post-test',
              answers: { ...answered(newbornQs, 6), ...answered(eencQs, 10) },
              manualScores: {}, score: 16, total: 27, percentage: 59.3 },
        ];

        const summary = buildEmoncModuleTestSummary(course, people, tests);
        expect(summary.modules.map((m) => m.module)).toEqual([EENC_ONLY_MODULE]);
        expect(summary.modules[0].parts).toHaveLength(1);

        // The mark is out of the EENC questions alone: 10 of 12, not 16 of 27.
        const row = summary.modules[0].rows.find((r) => r.name === 'Somia');
        expect(row.postPct).toBeCloseTo((10 / eencQs.length) * 100, 0);
    });

    it('still counts a course whose groups teach a full module', () => {
        const full = { id: 'c6', course_type: 'EmONC', facilitatorAssignments: [
            { group: 'A', imci_sub_type: 'Emergency Newborn Care' },
            { group: 'B', imci_sub_type: 'EENC Orientation' },
        ] };
        expect(isEencOnlyCourse(full, [])).toBe(false);
    });
});
