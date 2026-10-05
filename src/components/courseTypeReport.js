// courseTypeReport.js
//
// Aggregation behind the comprehensive (multi-course) report for one course
// type. It works out the same figures the single Course Report shows — case and
// skill KPIs, pre/post test scores, performance by group and by day, investment,
// coverage, new IMNCI facilities and per-participant results — but over every
// course that passes the filters, plus breakdowns by course, state, locality,
// sub-course and project.
//
// Kept free of React and Firebase so it can be tested on its own.

export const ALL = 'All';

const isDeleted = (x) => x?.isDeleted === true || x?.isDeleted === 'true';
const isTrue = (v) => v === true || v === 'true';

const splitList = (value) => String(value || '').split(',').map((s) => s.trim()).filter(Boolean);

/** A course's states, whether stored as an array or a comma-separated string. */
export const getCourseStates = (course) => {
    if (Array.isArray(course?.states) && course.states.length > 0) return course.states.filter(Boolean);
    return splitList(course?.state);
};

/** A course's localities, whether stored as an array or a comma-separated string. */
export const getCourseLocalities = (course) => {
    if (Array.isArray(course?.localities) && course.localities.length > 0) return course.localities.filter(Boolean);
    return splitList(course?.locality);
};

/** Every sub-course a course teaches, from its group assignments and its own record. */
export const getCourseSubTypes = (course) => {
    const types = new Set();
    (course?.facilitatorAssignments || []).forEach((a) => { if (a?.imci_sub_type) types.add(a.imci_sub_type); });
    if (course?.imci_sub_type) types.add(course.imci_sub_type);
    return Array.from(types);
};

/** The sub-course a participant sat: their own record first, then their group's assignment. */
export const getParticipantSubType = (participant, course) =>
    participant?.imci_sub_type
    || course?.facilitatorAssignments?.find((a) => a.group === participant?.group)?.imci_sub_type
    || null;

const courseDate = (course) => String(course?.start_date || '').slice(0, 10);

/** Options for the report's filter dropdowns, from the courses available to it. */
export const buildFilterOptions = (courses, { state = ALL } = {}) => {
    const states = new Set();
    const localities = new Set();
    const subTypes = new Set();
    const projects = new Set();
    const partners = new Set();
    const months = new Set();
    (courses || []).forEach((c) => {
        const month = courseDate(c).slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(month)) months.add(month);
        const cStates = getCourseStates(c);
        cStates.forEach((s) => states.add(s));
        if (state === ALL || cStates.includes(state)) getCourseLocalities(c).forEach((l) => localities.add(l));
        getCourseSubTypes(c).forEach((t) => subTypes.add(t));
        if (c.course_project) projects.add(c.course_project);
        if (c.funded_by) partners.add(c.funded_by);
    });
    const sorted = (set) => [ALL, ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))];
    return {
        states: sorted(states),
        localities: sorted(localities),
        subTypes: sorted(subTypes),
        projects: sorted(projects),
        partners: sorted(partners),
        // Newest first: the recent months are the ones people pick.
        months: Array.from(months).sort().reverse(),
    };
};

/** "2025-03" -> "Mar 2025" */
export const formatMonth = (month) => {
    const [y, m] = String(month).split('-').map(Number);
    if (!y || !m) return String(month);
    return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' });
};

/**
 * The courses that pass the filters. State and locality are the course's own
 * location; dates compare against the start date, inclusive, at whatever
 * precision the filter gives (a month "YYYY-MM" or a day "YYYY-MM-DD").
 */
export const filterCourses = (courses, filters = {}) => {
    const { state = ALL, locality = ALL, subType = ALL, project = ALL, partner = ALL, dateFrom = '', dateTo = '' } = filters;
    return (courses || []).filter((c) => {
        if (!c || isDeleted(c) || c.inRecycleBin) return false;
        if (state !== ALL && !getCourseStates(c).includes(state)) return false;
        if (locality !== ALL && !getCourseLocalities(c).includes(locality)) return false;
        if (subType !== ALL && !getCourseSubTypes(c).includes(subType)) return false;
        if (project !== ALL && c.course_project !== project) return false;
        if (partner !== ALL && c.funded_by !== partner) return false;
        const d = courseDate(c);
        if (dateFrom && (!d || d.slice(0, dateFrom.length) < dateFrom)) return false;
        if (dateTo && (!d || d.slice(0, dateTo.length) > dateTo)) return false;
        return true;
    });
};

/**
 * Participants of the given courses. With a sub-course filter, only those who
 * sat that sub-course — a course teaching two sub-courses should not count the
 * other one's participants.
 */
export const filterParticipants = (participants, courses, { subType = ALL } = {}) => {
    const byId = new Map((courses || []).map((c) => [c.id, c]));
    return (participants || []).filter((p) => {
        if (!p || isDeleted(p)) return false;
        const course = byId.get(p.courseId);
        if (!course) return false;
        if (subType !== ALL && getParticipantSubType(p, course) !== subType) return false;
        return true;
    });
};

// --- Scoring helpers (same rules as the single course report) ---

export const calcPct = (correct, total) => (total > 0 ? (correct / total) * 100 : 0);

const average = (values) => {
    const valid = values.filter((v) => v !== null && v !== undefined && !isNaN(v));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
};

const validScore = (v) => {
    const n = Number(v);
    return !isNaN(n) && n > 0 ? n : null;
};

export const improvementOf = (pre, post) => {
    const a = validScore(pre);
    const b = validScore(post);
    return a !== null && b !== null ? ((b - a) / a) * 100 : null;
};

export const getImprovementCategory = (pre, post) => {
    const increase = improvementOf(pre, post);
    if (increase === null) return 'Data Incomplete';
    if (increase > 50) return 'Perfect';
    if (increase >= 30) return 'Excellent';
    if (increase >= 15) return 'Good';
    if (increase < 0) return 'Fail';
    return 'Fair';
};

export const getCaseCorrectnessName = (pct, total) => {
    if (!total || isNaN(pct) || pct === null) return 'Data Incomplete';
    if (pct === 100) return 'Perfect';
    if (pct >= 95) return 'Excellent';
    if (pct >= 90) return 'Good';
    return 'Fail';
};

const scoreStats = (scores) => {
    if (scores.length === 0) return { avg: 0, median: 0, min: 0, max: 0, count: 0 };
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return {
        avg: average(sorted),
        median: sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: sorted.length,
    };
};

const isHospitalFacility = (name, matched) => {
    if (matched && matched['نوع_المؤسسةالصحية']) return ['مستشفى', 'مستشفى ريفي'].includes(matched['نوع_المؤسسةالصحية']);
    return typeof name === 'string' && (name.includes('مستشفى') || name.toLowerCase().includes('hospital'));
};

const dayNumber = (label) => parseInt(String(label).replace('Day ', ''), 10) || 0;

const emptyBucket = () => ({
    courseIds: new Set(), participants: 0,
    cases: 0, correctCases: 0, skills: 0, correctSkills: 0,
    pre: [], post: [], budget: 0,
});

const finishBucket = (key, b) => {
    const avgPre = average(b.pre);
    const avgPost = average(b.post);
    return {
        key,
        courses: b.courseIds.size,
        participants: b.participants,
        cases: b.cases,
        correctCases: b.correctCases,
        casePct: b.cases > 0 ? calcPct(b.correctCases, b.cases) : null,
        skills: b.skills,
        correctSkills: b.correctSkills,
        skillPct: b.skills > 0 ? calcPct(b.correctSkills, b.skills) : null,
        avgPre: b.pre.length ? avgPre : null,
        avgPost: b.post.length ? avgPost : null,
        improvement: avgPre > 0 && b.post.length ? ((avgPost - avgPre) / avgPre) * 100 : null,
        budget: b.budget,
    };
};

/**
 * Coverage over several courses, from the baseline snapshot each course saved.
 *
 * Every snapshot records a level's PHC total and how many already had IMNCI on
 * that course's start date. Across several courses the earliest snapshot is the
 * baseline — later ones already count the earlier courses' new facilities as
 * "before" — and the new facilities of every course are added on top of it.
 */
export const aggregateCoverage = (courses) => {
    const withSnapshot = (courses || [])
        .filter((c) => c.coverageSnapshot)
        .sort((a, b) => courseDate(a).localeCompare(courseDate(b)));

    const combine = (listKey) => {
        const levels = new Map();
        withSnapshot.forEach((c) => {
            (c.coverageSnapshot[listKey] || []).forEach((lvl) => {
                if (!lvl?.name) return;
                if (!levels.has(lvl.name)) {
                    levels.set(lvl.name, {
                        name: lvl.name,
                        totalPhc: Number(lvl.totalPhc) || 0,
                        phcWithImnciBefore: Number(lvl.phcWithImnciBefore) || 0,
                        newPhc: 0,
                        courses: 0,
                    });
                }
                const agg = levels.get(lvl.name);
                agg.newPhc += Number(lvl.newPhc) || 0;
                agg.courses += 1;
            });
        });
        return Array.from(levels.values()).map((l) => {
            const covBefore = l.totalPhc > 0 ? (l.phcWithImnciBefore / l.totalPhc) * 100 : 0;
            const covAfter = l.totalPhc > 0 ? (Math.min(l.phcWithImnciBefore + l.newPhc, l.totalPhc) / l.totalPhc) * 100 : 0;
            return { ...l, covBefore, covAfter, increase: covAfter - covBefore };
        }).sort((a, b) => a.name.localeCompare(b.name));
    };

    const stateCoverage = combine('stateCoverage');
    const localityCoverage = combine('localityCoverage');
    return {
        coursesWithSnapshot: withSnapshot.length,
        coursesWithoutSnapshot: (courses || []).length - withSnapshot.length,
        stateCoverage,
        localityCoverage,
        totalNewPhc: stateCoverage.reduce((sum, s) => sum + s.newPhc, 0),
    };
};

/**
 * Everything the comprehensive report shows.
 *
 * @param {object}   args
 * @param {object[]} args.courses       the filtered courses
 * @param {object[]} args.participants  their (filtered) participants
 * @param {object[]} args.observations  skill observations of those courses
 * @param {object[]} args.cases         cases of those courses (with is_correct)
 * @param {object[]} args.facilities    health facilities, to tell PHCs from hospitals
 */
export const buildCourseTypeReport = ({ courses = [], participants = [], observations = [], cases = [], facilities = [] }) => {
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const participantById = new Map(participants.map((p) => [p.id, p]));

    const obsByParticipant = new Map();
    (observations || []).forEach((o) => {
        if (isDeleted(o) || !participantById.has(o.participant_id)) return;
        if (!obsByParticipant.has(o.participant_id)) obsByParticipant.set(o.participant_id, []);
        obsByParticipant.get(o.participant_id).push(o);
    });
    const casesByParticipant = new Map();
    (cases || []).forEach((c) => {
        if (isDeleted(c) || !participantById.has(c.participant_id)) return;
        if (!casesByParticipant.has(c.participant_id)) casesByParticipant.set(c.participant_id, []);
        casesByParticipant.get(c.participant_id).push(c);
    });

    // --- Per participant ---
    const participantsWithStats = participants.map((p) => {
        const course = courseById.get(p.courseId) || {};
        const pObs = obsByParticipant.get(p.id) || [];
        const pCases = casesByParticipant.get(p.id) || [];
        const correctSkills = pObs.filter((o) => o.item_correct > 0).length;
        const part = (pred) => {
            const list = pObs.filter(pred);
            const correct = list.filter((o) => o.item_correct > 0).length;
            return { correct, total: list.length, pct: calcPct(correct, list.length) };
        };
        const eenc = part((o) => o.age_group?.includes('eenc_breathing') || o.age_group?.includes('eenc_not_breathing'));
        const maternal = part((o) => o.age_group?.startsWith('Maternal_') && !o.age_group?.includes('eenc_'));
        const neonatal = part((o) => o.age_group?.startsWith('Neonatal_') && !o.age_group?.includes('eenc_'));
        const pre = validScore(p.pre_test_score);
        const post = validScore(p.post_test_score);
        return {
            ...p,
            courseDate: courseDate(course),
            courseState: getCourseStates(course).join(', '),
            courseLocality: getCourseLocalities(course).join(', '),
            courseProject: course.course_project || '',
            subType: getParticipantSubType(p, course) || '',
            total_cases_seen: pCases.length,
            correct_cases: pCases.filter((c) => c.is_correct).length,
            total_skills_recorded: pObs.length,
            correct_skills: correctSkills,
            correctness_percentage: calcPct(correctSkills, pObs.length),
            eenc_correct: eenc.correct, eenc_total: eenc.total, eenc_score: eenc.pct,
            maternal_correct: maternal.correct, maternal_total: maternal.total, maternal_score: maternal.pct,
            neonatal_correct: neonatal.correct, neonatal_total: neonatal.total, neonatal_score: neonatal.pct,
            pre, post,
            increase: improvementOf(pre, post),
            practicalCategory: getCaseCorrectnessName(calcPct(correctSkills, pObs.length), pObs.length),
            improvementCategory: getImprovementCategory(pre, post),
        };
    });

    // --- Participant results, as overall figures ---
    const assessed = participantsWithStats.filter((p) => p.total_skills_recorded > 0);
    const partAverage = (key, totalKey) => {
        const list = participantsWithStats.filter((p) => p[totalKey] > 0);
        return list.length ? average(list.map((p) => p[key])) : null;
    };
    const withBoth = participantsWithStats.filter((p) => p.increase !== null);
    const participantSummary = {
        total: participantsWithStats.length,
        practicalAssessed: assessed.length,
        avgPracticalScore: assessed.length ? average(assessed.map((p) => p.correctness_percentage)) : null,
        practicalPassRate: assessed.length ? calcPct(assessed.filter((p) => p.correctness_percentage >= 90).length, assessed.length) : null,
        avgEencScore: partAverage('eenc_score', 'eenc_total'),
        avgMaternalScore: partAverage('maternal_score', 'maternal_total'),
        avgNeonatalScore: partAverage('neonatal_score', 'neonatal_total'),
        withBothTests: withBoth.length,
        avgIncrease: withBoth.length ? average(withBoth.map((p) => p.increase)) : null,
        improvedRate: withBoth.length ? calcPct(withBoth.filter((p) => p.increase > 0).length, withBoth.length) : null,
    };

    // --- Overall KPIs ---
    let totalCases = 0, correctCases = 0, totalSkills = 0, correctSkills = 0;
    participantsWithStats.forEach((p) => {
        totalCases += p.total_cases_seen; correctCases += p.correct_cases;
        totalSkills += p.total_skills_recorded; correctSkills += p.correct_skills;
    });
    const n = participantsWithStats.length;
    const overall = {
        totalCases, correctCases,
        avgCasesPerParticipant: n ? totalCases / n : 0,
        caseCorrectnessPercentage: calcPct(correctCases, totalCases),
        totalSkills, correctSkills,
        avgSkillsPerParticipant: n ? totalSkills / n : 0,
        skillCorrectnessPercentage: calcPct(correctSkills, totalSkills),
    };

    // --- Test scores ---
    const preTestStats = scoreStats(participantsWithStats.map((p) => p.pre).filter((v) => v !== null));
    const postTestStats = scoreStats(participantsWithStats.map((p) => p.post).filter((v) => v !== null));
    const totalImprovement = preTestStats.avg > 0 ? ((postTestStats.avg - preTestStats.avg) / preTestStats.avg) * 100 : 0;
    const hasTestScores = preTestStats.count > 0 || postTestStats.count > 0;

    const improvementDistribution = { Perfect: 0, Excellent: 0, Good: 0, Fair: 0, Fail: 0, 'Data Incomplete': 0 };
    const practicalDistribution = { Perfect: 0, Excellent: 0, Good: 0, Fail: 0, 'Data Incomplete': 0 };
    participantsWithStats.forEach((p) => {
        improvementDistribution[p.improvementCategory]++;
        practicalDistribution[p.practicalCategory]++;
    });

    // --- By group and by day (group names are pooled across courses) ---
    const groupPerformance = {};
    const dailyPerformance = {};
    const groupOf = (pid) => participantById.get(pid)?.group;
    participantsWithStats.forEach((p) => {
        if (!p.group) return;
        if (!groupPerformance[p.group]) groupPerformance[p.group] = { participantCount: 0, totalCases: 0, correctCases: 0, totalObs: 0, correctObs: 0 };
        const g = groupPerformance[p.group];
        g.participantCount++;
        g.totalCases += p.total_cases_seen; g.correctCases += p.correct_cases;
        g.totalObs += p.total_skills_recorded; g.correctObs += p.correct_skills;
    });
    const groups = Object.keys(groupPerformance).sort();
    const dayCell = (day, group) => {
        if (!dailyPerformance[day]) dailyPerformance[day] = {};
        if (!dailyPerformance[day][group]) dailyPerformance[day][group] = { correct: 0, total: 0, cases: 0, correctCases: 0 };
        return dailyPerformance[day][group];
    };
    obsByParticipant.forEach((list, pid) => {
        const group = groupOf(pid);
        if (!group) return;
        list.forEach((o) => {
            if (!o.day_of_course) return;
            const cell = dayCell(`Day ${o.day_of_course}`, group);
            cell.total++;
            if (o.item_correct > 0) cell.correct++;
        });
    });
    casesByParticipant.forEach((list, pid) => {
        const group = groupOf(pid);
        if (!group) return;
        list.forEach((c) => {
            if (!c.day_of_course) return;
            const cell = dayCell(`Day ${c.day_of_course}`, group);
            cell.cases++;
            if (c.is_correct) cell.correctCases++;
        });
    });
    groups.forEach((g) => { groupPerformance[g].percentage = calcPct(groupPerformance[g].correctObs, groupPerformance[g].totalObs); });
    const days = Object.keys(dailyPerformance).sort((a, b) => dayNumber(a) - dayNumber(b));

    const dailyTable = (numKey, denKey) => {
        const rows = days.map((day) => {
            const row = { day, cells: {}, correct: 0, total: 0 };
            groups.forEach((g) => {
                const cell = dailyPerformance[day][g] || { correct: 0, total: 0, cases: 0, correctCases: 0 };
                row.cells[g] = { correct: cell[numKey], total: cell[denKey], pct: cell[denKey] > 0 ? calcPct(cell[numKey], cell[denKey]) : null };
                row.correct += cell[numKey]; row.total += cell[denKey];
            });
            row.pct = row.total > 0 ? calcPct(row.correct, row.total) : null;
            return row;
        });
        const totals = { cells: {}, correct: 0, total: 0 };
        groups.forEach((g) => {
            const correct = rows.reduce((s, r) => s + r.cells[g].correct, 0);
            const total = rows.reduce((s, r) => s + r.cells[g].total, 0);
            totals.cells[g] = { correct, total, pct: total > 0 ? calcPct(correct, total) : null };
            totals.correct += correct; totals.total += total;
        });
        totals.pct = totals.total > 0 ? calcPct(totals.correct, totals.total) : null;
        return { rows, totals };
    };
    const dailyCases = dailyTable('correctCases', 'cases');
    const dailySkills = dailyTable('correct', 'total');

    // --- Breakdowns ---
    const breakdown = (keysOf) => {
        const buckets = new Map();
        const bucket = (key) => {
            if (!buckets.has(key)) buckets.set(key, emptyBucket());
            return buckets.get(key);
        };
        // Budget and course counts belong to the course, so they are counted
        // once per course even when none of its participants are in the report.
        courses.forEach((c) => {
            const keys = keysOf(c, null);
            keys.forEach((k) => {
                const b = bucket(k);
                b.courseIds.add(c.id);
                b.budget += (Number(c.course_budget) || 0) / keys.length;
            });
        });
        participantsWithStats.forEach((p) => {
            const course = courseById.get(p.courseId);
            keysOf(course, p).forEach((k) => {
                const b = bucket(k);
                b.courseIds.add(p.courseId);
                b.participants++;
                b.cases += p.total_cases_seen; b.correctCases += p.correct_cases;
                b.skills += p.total_skills_recorded; b.correctSkills += p.correct_skills;
                if (p.pre !== null) b.pre.push(p.pre);
                if (p.post !== null) b.post.push(p.post);
            });
        });
        return Array.from(buckets.entries())
            .map(([k, b]) => finishBucket(k, b))
            .sort((a, b) => String(a.key).localeCompare(String(b.key)));
    };
    const orNone = (list) => (list.length ? list : ['(Not set)']);
    const byState = breakdown((c) => orNone(getCourseStates(c)));
    const byLocality = breakdown((c) => orNone(getCourseLocalities(c)));
    const byProject = breakdown((c) => [c?.course_project || '(Not set)']);
    const byPartner = breakdown((c) => [c?.funded_by || '(Not set)']);
    // Sub-course is the participant's own; a course with no participants yet is
    // listed under each sub-course it teaches.
    const bySubType = breakdown((c, p) => (p ? [getParticipantSubType(p, c) || '(Not set)'] : orNone(getCourseSubTypes(c))));
    const byYear = breakdown((c) => [courseDate(c).slice(0, 4) || '(No date)']);

    const byCourse = courses.map((c) => {
        const row = participantsWithStats.filter((p) => p.courseId === c.id);
        const b = emptyBucket();
        b.courseIds.add(c.id);
        b.budget = Number(c.course_budget) || 0;
        row.forEach((p) => {
            b.participants++;
            b.cases += p.total_cases_seen; b.correctCases += p.correct_cases;
            b.skills += p.total_skills_recorded; b.correctSkills += p.correct_skills;
            if (p.pre !== null) b.pre.push(p.pre);
            if (p.post !== null) b.post.push(p.post);
        });
        return {
            ...finishBucket(c.id, b),
            id: c.id,
            date: courseDate(c),
            state: getCourseStates(c).join(', '),
            locality: getCourseLocalities(c).join(', '),
            subTypes: getCourseSubTypes(c).join(', '),
            project: c.course_project || '',
            partner: c.funded_by || '',
            director: c.director || '',
            hasCoverageSnapshot: !!c.coverageSnapshot,
            newPhc: c.coverageSnapshot ? (c.coverageSnapshot.stateCoverage || []).reduce((s, l) => s + (Number(l.newPhc) || 0), 0) : null,
        };
    }).sort((a, b) => b.date.localeCompare(a.date));

    // --- New IMNCI facilities ---
    const facilityMap = new Map();
    participantsWithStats.filter((p) => isTrue(p.introduced_imci_to_facility)).forEach((p) => {
        const key = `${p.center_name}|${p.locality}|${p.state}`;
        if (facilityMap.has(key)) {
            facilityMap.get(key).courseDates.add(p.courseDate);
            return;
        }
        const matched = (facilities || []).find((f) =>
            f['اسم_المؤسسة'] === p.center_name && f['المحلية'] === p.locality && f['الولاية'] === p.state);
        facilityMap.set(key, {
            name: p.center_name, locality: p.locality, state: p.state,
            isHospital: isHospitalFacility(p.center_name, matched),
            courseDates: new Set([p.courseDate]),
        });
    });
    const newImciFacilities = Array.from(facilityMap.values())
        .map((f) => ({ ...f, courseDates: Array.from(f.courseDates).filter(Boolean).sort() }))
        .sort((a, b) => `${a.state}${a.locality}${a.name}`.localeCompare(`${b.state}${b.locality}${b.name}`));

    // --- Investment and coverage ---
    const coverage = aggregateCoverage(courses);
    const totalBudget = courses.reduce((sum, c) => sum + (Number(c.course_budget) || 0), 0);
    const investment = {
        totalBudget,
        coursesWithBudget: courses.filter((c) => Number(c.course_budget) > 0).length,
        costPerParticipant: n > 0 ? totalBudget / n : 0,
        costPerCourse: courses.length > 0 ? totalBudget / courses.length : 0,
        costPerNewFacility: coverage.totalNewPhc > 0 ? totalBudget / coverage.totalNewPhc : 0,
    };

    // --- Summary ---
    const dates = courses.map(courseDate).filter(Boolean).sort();
    const summary = {
        totalCourses: courses.length,
        totalParticipants: n,
        avgParticipantsPerCourse: courses.length ? n / courses.length : 0,
        states: Array.from(new Set(courses.flatMap(getCourseStates))).sort(),
        localities: Array.from(new Set(courses.flatMap(getCourseLocalities))).sort(),
        partners: Array.from(new Set(courses.map((c) => c.funded_by).filter(Boolean))).sort(),
        projects: Array.from(new Set(courses.map((c) => c.course_project).filter(Boolean))).sort(),
        subTypes: Array.from(new Set(courses.flatMap(getCourseSubTypes))).sort(),
        firstDate: dates[0] || '',
        lastDate: dates[dates.length - 1] || '',
        facilitiesRepresented: new Set(participants.map((p) => `${p.state}|${p.locality}|${p.center_name}`).filter((k) => !k.endsWith('|undefined'))).size,
    };

    return {
        summary, overall, investment, coverage, newImciFacilities,
        preTestStats, postTestStats, totalImprovement, hasTestScores,
        improvementDistribution, practicalDistribution,
        groups, groupPerformance, days, dailyPerformance, dailyCases, dailySkills,
        participantsWithStats, participantSummary,
        breakdowns: { byCourse, byState, byLocality, bySubType, byProject, byPartner, byYear },
        hasCases: totalCases > 0,
        hasSkills: totalSkills > 0,
    };
};

/**
 * Pools the per-course EmONC module test summaries (from
 * buildEmoncModuleTestSummary) into one per module.
 *
 * @param {{course: object, summary: object|null}[]} perCourse
 */
export const mergeEmoncModuleSummaries = (perCourse) => {
    const modules = new Map();
    (perCourse || []).forEach(({ course, summary }) => {
        (summary?.modules || []).forEach((mod) => {
            if (!modules.has(mod.module)) {
                modules.set(mod.module, { module: mod.module, label: mod.label, sections: mod.sections, rows: [] });
            }
            const target = modules.get(mod.module);
            mod.rows.forEach((r) => target.rows.push({
                ...r,
                courseId: course?.id,
                courseDate: courseDate(course),
                courseState: getCourseStates(course).join(', '),
            }));
        });
    });
    const avgOrNull = (values) => {
        const valid = values.filter((v) => v !== null && v !== undefined && !isNaN(v));
        return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    };
    const merged = Array.from(modules.values()).map((m) => {
        const rows = [...m.rows].sort((a, b) => (b.increase ?? -1000) - (a.increase ?? -1000));
        const preAvg = avgOrNull(rows.map((r) => r.prePct));
        const postAvg = avgOrNull(rows.map((r) => r.postPct));
        return {
            ...m,
            rows,
            stats: {
                participantCount: rows.length,
                preAvg, postAvg,
                preCount: rows.filter((r) => r.prePct !== null).length,
                postCount: rows.filter((r) => r.postPct !== null).length,
                improvement: preAvg > 0 && postAvg !== null ? ((postAvg - preAvg) / preAvg) * 100 : null,
            },
            parts: (m.sections || []).map((section, idx) => ({
                key: section.key, part: section.part, title: section.title, shortTitle: section.shortTitle,
                preAvg: avgOrNull(rows.map((r) => r.preParts?.[idx]?.percentage ?? null)),
                postAvg: avgOrNull(rows.map((r) => r.postParts?.[idx]?.percentage ?? null)),
            })),
        };
    });
    return merged.length ? { modules: merged } : null;
};
