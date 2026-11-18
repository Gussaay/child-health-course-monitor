// src/components/imnci/onlineCourses/coursePackage.js
//
// A course file: one or more modules, their sections in order with every
// block of their Read, See and Practise tabs, and the exercises those sections
// link to, in one JSON document. Exported from the app, edited or kept as a
// backup, and imported back into any course. Nothing about a module has to be
// built into the app's code or read from another database.
//
//   {
//     "format": "imnci-course-package",
//     "version": 1,
//     "course":   { "title": "…", "description": "…" },
//     "modules":  [ { "title": "…", "order": 1,
//                     "sections": [ { "title": "1.1 …", "order": 1,
//                                     "read": [blocks], "see": [blocks], "practise": [blocks] } ] } ],
//     "exercises": [ exercise definitions, as Manage Exercises saves them ]
//   }
//
// Blocks are the section blocks the app already shows (see BLOCK_TYPES in
// book.js): paragraph, heading, list, rich, note, table, image, page, video,
// question, exercise (a link to an exercise by id), booklet (chart booklet
// tables from the protocol) and form (recording form rows from the protocol).
// Pure functions only: no Firestore, so it can be tested on its own.

import { BLOCK_TYPES } from '../book';
import { plotChild, kindForAge } from '../growthCharts';

export const PACKAGE_FORMAT = 'imnci-course-package';
export const PACKAGE_VERSION = 1;

const TABS = ['read', 'see', 'practise'];
const ID_OK = /^[a-zA-Z0-9_-]+$/;
// Fields a stored document carries that mean nothing in another course or
// another database, so they are never written into a file.
const STORAGE_FIELDS = ['id', 'courseId', 'moduleId', 'createdAt', 'lastUpdatedAt', 'lastUpdatedAtLocal',
    'isDeleted', 'deletedAt', 'deletedBy', 'legacyKey', 'legacyModuleKey', 'isCustom', 'blocks', 'test'];

const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k, v]) => !STORAGE_FIELDS.includes(k) && v !== undefined));
const copy = (v) => JSON.parse(JSON.stringify(v ?? null));
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

/** Exercise ids that a list of sections links to, in the order they appear. */
export function linkedExerciseIds(sections = []) {
    const ids = [];
    sections.forEach((s) => TABS.forEach((tab) => (s[tab] || []).forEach((b) => {
        if (b?.type === 'exercise' && b.exerciseId && !ids.includes(b.exerciseId)) ids.push(b.exerciseId);
    })));
    return ids;
}

/**
 * A file for one course, or for some of its modules.
 * @param {object}   course    the course document
 * @param {object[]} modules   module documents, in the order wanted
 * @param {object}   sectionsByModule  module id → its section documents
 * @param {object[]} exercises every exercise the app knows; only linked ones go in
 */
export function buildPackage({ course, modules = [], sectionsByModule = {}, exercises = [] }) {
    const outModules = [...modules].sort(byOrder).map((m) => {
        const sections = [...(sectionsByModule[m.id] || [])].sort(byOrder).map((s) => {
            const { kind, ...rest } = clean(s);
            const sec = { ...copy(rest) };
            // A section written before the tabs existed keeps its text in
            // `blocks`; a file always uses the tabs.
            TABS.forEach((tab) => { sec[tab] = copy(tab === 'read' ? (s.read || s.blocks || []) : tab === 'practise' ? [...(s.practise || []), ...(s.test || [])] : (s[tab] || [])); });
            return sec;
        });
        const { kind, ...rest } = clean(m);
        return { ...copy(rest), sections };
    });
    const wanted = linkedExerciseIds(outModules.flatMap((m) => m.sections));
    const outExercises = wanted
        .map((id) => exercises.find((e) => e.id === id))
        .filter(Boolean)
        .map((e) => copy({ ...clean(e), id: e.id }));
    return {
        format: PACKAGE_FORMAT,
        version: PACKAGE_VERSION,
        exportedAt: new Date().toISOString(),
        course: copy(clean({ title: course?.title, description: course?.description, imageUrl: course?.imageUrl, audience: course?.audience })),
        modules: outModules,
        exercises: outExercises,
    };
}

// The right answer(s) of a question-shaped block point at real options.
function answerErrors(q, where) {
    const n = (q?.options || []).length;
    if (!n) return [];
    const right = Array.isArray(q.answers) && q.answers.length ? q.answers : [q.answer ?? 0];
    const bad = right.some((a) => !Number.isInteger(Number(a)) || Number(a) < 0 || Number(a) >= n);
    return bad ? [`${where}the right answer is not one of its options.`] : [];
}

/** Problems in the practice blocks: case sets, find the error, drills, cards. */
export function practiceErrors(b) {
    const out = [];
    if (['question', 'drill'].includes(b?.type)) out.push(...answerErrors(b, ''));
    if (b?.type === 'scenario') {
        if (!(b.cases || []).length) out.push('the case set has no cases.');
        (b.cases || []).forEach((c, i) => {
            if (!(c?.options || []).length) out.push(`case ${i + 1} has no answer options.`);
            out.push(...answerErrors(c, `case ${i + 1}: `));
        });
    }
    if (b?.type === 'spot') {
        const marked = (b.record || []).flatMap((s) => [...(s?.lines || []), ...(s?.classify || [])]).filter((l) => l && typeof l === 'object' && l.error);
        if (marked.length !== 1) out.push(`find the error needs exactly one wrong entry, it has ${marked.length}.`);
    }
    if (b?.type === 'classcards') {
        if (!(b.cards || []).length) out.push('the classification cards are empty.');
        (b.cards || []).forEach((c, i) => {
            if (!['pink', 'red', 'yellow', 'green'].includes(c?.colour)) out.push(`card ${i + 1} has an unknown colour "${c?.colour}".`);
        });
    }
    return out;
}

/**
 * Checks a file before anything is written. Errors stop the import; warnings
 * are shown and the import can go ahead.
 * @param {object} pkg            the parsed file
 * @param {string[]} knownExerciseIds exercises already in the app
 */
export function checkPackage(pkg, knownExerciseIds = []) {
    const errors = [];
    const warnings = [];
    if (!pkg || typeof pkg !== 'object') return { errors: ['The file is not a course file.'], warnings, summary: null };
    if (pkg.format !== PACKAGE_FORMAT) errors.push(`This is not a course file (format should be "${PACKAGE_FORMAT}").`);
    if (Number(pkg.version) > PACKAGE_VERSION) errors.push(`The file was made by a newer version of the app (version ${pkg.version}). Update the app first.`);
    const modules = Array.isArray(pkg.modules) ? pkg.modules : [];
    if (!modules.length) errors.push('The file has no modules.');

    const exercises = Array.isArray(pkg.exercises) ? pkg.exercises : [];
    const fileIds = new Set();
    exercises.forEach((e, i) => {
        const where = `Exercise ${i + 1}${e?.title ? ` (${e.title})` : ''}`;
        if (!e?.id || !ID_OK.test(e.id)) errors.push(`${where}: its id must be letters, numbers, hyphens or underscores.`);
        else if (fileIds.has(e.id)) errors.push(`${where}: the id "${e.id}" is used twice.`);
        else fileIds.add(e.id);
        if (!String(e?.title || '').trim()) errors.push(`${where}: it has no title.`);
        if (e?.kind === 'quiz') {
            if (!(e.questions || []).length) errors.push(`${where}: a quiz needs at least one question.`);
            (e.questions || []).forEach((q, qi) => {
                const qw = `${where}, question ${qi + 1}`;
                if (!String(q?.question || '').trim()) errors.push(`${qw}: no question text.`);
                if (q?.type === 'mcq' && (!(q.correct || []).length || q.correct.some((c) => !String(q.options?.[c] ?? '').trim()))) errors.push(`${qw}: the correct answer is not one of its options.`);
                if (q?.type === 'tf' && typeof q.correct !== 'boolean') errors.push(`${qw}: true or false is not set.`);
                if (q?.type === 'text' && !String(q.correct ?? '').trim()) errors.push(`${qw}: the expected text answer is missing.`);
                if (q?.type === 'open' && !(q.points || []).length) errors.push(`${qw}: the written answer has no answer key.`);
            });
        } else if (!(e?.expected?.sections || []).length) {
            errors.push(`${where}: a recording-form case needs at least one form section.`);
        }
    });

    let sectionCount = 0;
    modules.forEach((m, mi) => {
        const mw = `Module ${mi + 1}${m?.title ? ` (${m.title})` : ''}`;
        if (!String(m?.title || '').trim()) errors.push(`${mw}: it has no title.`);
        (m?.sections || []).forEach((s, si) => {
            sectionCount += 1;
            const sw = `${mw}, section ${si + 1}${s?.title ? ` (${s.title})` : ''}`;
            if (!String(s?.title || '').trim()) errors.push(`${sw}: it has no title.`);
            TABS.forEach((tab) => (s?.[tab] || []).forEach((b, bi) => {
                if (!BLOCK_TYPES.includes(b?.type)) errors.push(`${sw}, ${tab} block ${bi + 1}: unknown block type "${b?.type}".`);
                if (b?.type === 'growthchart') growthChartErrors(b).forEach((e) => errors.push(`${sw}, ${tab} block ${bi + 1}: ${e}`));
                practiceErrors(b).forEach((e) => errors.push(`${sw}, ${tab} block ${bi + 1}: ${e}`));
                if (b?.type === 'courselink') courseLinkErrors(b).forEach((e) => errors.push(`${sw}, ${tab} block ${bi + 1}: ${e}`));
                if (b?.type === 'exercise' && !fileIds.has(b.exerciseId) && !knownExerciseIds.includes(b.exerciseId)) {
                    warnings.push(`${sw}: links to exercise "${b.exerciseId}", which is not in the file or the app.`);
                }
            }));
        });
        if (!(m?.sections || []).length) warnings.push(`${mw}: it has no sections.`);
    });

    const clashes = [...fileIds].filter((id) => knownExerciseIds.includes(id));
    return {
        errors,
        warnings,
        summary: { modules: modules.length, sections: sectionCount, exercises: exercises.length, clashes },
    };
}

/**
 * What bulkUpsertOnlineCourseContent writes for a file: a new course, or the
 * modules added to an existing course after the ones it already has.
 */
export function packagePlan(pkg, { existingCourseId = null, firstModuleOrder = 1 } = {}) {
    const stamp = Date.now().toString(36);
    const items = [];
    [...(pkg.modules || [])].sort(byOrder).forEach((m, mi) => {
        const key = `file-${stamp}-${mi + 1}`;
        const { sections = [], ...mod } = copy(m);
        items.push({ ...clean(mod), kind: 'module', order: firstModuleOrder + mi, isPublished: mod.isPublished !== false, legacyKey: key, source: 'file' });
        [...sections].sort(byOrder).forEach((s, si) => {
            const sec = clean(s);
            items.push({
                ...sec, kind: 'section', order: si + 1, legacyModuleKey: key, source: 'file',
                read: sec.read || [], see: sec.see || [], practise: sec.practise || [],
                isPublished: sec.isPublished !== false,
            });
        });
    });
    const course = existingCourseId
        ? { id: existingCourseId }
        : { ...clean(pkg.course), title: String(pkg.course?.title || '').trim() || 'Imported course', isPublished: false, source: 'file' };
    return { course, items, existingCourseId };
}

/** The exercises to save: all of them, or only those not already in the app. */
export function exercisesToSave(pkg, knownExerciseIds = [], { replace = false } = {}) {
    return (pkg.exercises || []).filter((e) => replace || !knownExerciseIds.includes(e.id));
}

/** A file name from a title: "Module 1: General danger signs" → module-1-general-danger-signs.imnci.json */
export const packageFileName = (title) =>
    `${String(title || 'course').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'course'}.imnci.json`;

// A "Plot on the chart" activity must place its child on a printed chart.
// One without a weight is free practice and needs nothing more.
/** What is wrong with a link to another course's module or lesson. */
export function courseLinkErrors(b) {
    const errors = [];
    if (!String(b?.course || '').trim()) errors.push('the link to another course does not name the course.');
    const n = Number(b?.module);
    if (!Number.isInteger(n) || n < 1) errors.push('the link to another course needs the module number (1 or more).');
    return errors;
}

export function growthChartErrors(b) {
    const out = [];
    if (b.chart && !['wfl', 'wfh', 'wfa'].includes(b.chart)) out.push(`the chart "${b.chart}" is not weight-for-length, weight-for-height or weight-for-age.`);
    if (b.weightKg === undefined || b.weightKg === '') return out;
    if (!['male', 'female'].includes(b.sex)) out.push('the child\'s sex is not set.');
    const kind = b.chart || (b.ageMonths !== undefined ? kindForAge(b.ageMonths) : null);
    if (!kind) { out.push('the age is missing.'); return out; }
    if (kind !== 'wfa' && b.chart && b.ageMonths !== undefined && kindForAge(b.ageMonths) !== b.chart) {
        out.push(`a child of ${b.ageMonths} months is plotted on the ${kindForAge(b.ageMonths) === 'wfl' ? 'weight-for-length' : 'weight-for-height'} chart, not this one.`);
    }
    if (kind !== 'wfa' && (b.ageMonths === undefined || b.ageMonths === '')) out.push('the age in months is missing (it decides length or height).');
    if (kind === 'wfa' && typeof b.lowWeightForAge !== 'boolean') out.push('whether the weight is low for age is not set.');
    const p = plotChild(b, { kind });
    if (p && p.x === null) out.push(kind === 'wfa' ? 'the age is missing.' : 'the length or height is missing.');
    else if (p && !p.inRange) out.push('the point falls outside the printed chart.');
    return out;
}
