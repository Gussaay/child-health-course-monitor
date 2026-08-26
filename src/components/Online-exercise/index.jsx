// src/components/Online-exercise/index.jsx
//
// The whole exercise engine in one file. Exercise CONTENT lives next door in
// exercises.js — that is the only file you edit to add or change an exercise.
//
// ONE EXERCISE = ONE CASE = ONE PAGE. The learner opens a case, reads the
// scenario bullets, fills the real IMNCI recording form, ticks the
// classification (and treatment, if the case includes it), and presses check.
// No wizard, no next button, no page turns.
//
// Exported for the rest of the app:
//   CourseExercisesView        facilitator tab inside CourseManagementView
//   ParticipantExercisesModal  opened from a row on the Participants page
//   ParticipantExerciseSummary read-only history for a participant report
//   PublicExerciseView         the /public/exercises/course/:id page
//   ExerciseResultsTable       whole-course results grid
//
import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Button, Card, CardBody, EmptyState, FormGroup, Modal, Select, Spinner, Toast,
} from '../CommonComponents';
import {
    Award, AlertTriangle, ArrowLeft, BookOpen, CheckCircle, Clock, RefreshCw,
    Stethoscope, Users, XCircle, Languages,
} from 'lucide-react';
import {
    getCourseById,
    listAllParticipantsForCourse,
    upsertExerciseAttempt,
    listExerciseAttemptsForCourse,
    listExerciseAttemptsForParticipant,
    bestByExercise,
    listExerciseDefinitions,
    upsertExerciseDefinition,
    deleteExerciseDefinition,
    getCachedCourse,
    getCachedParticipants,
    getCachedExerciseDefinitions,
    subscribeExerciseAttempts,
    clearExerciseCache,
} from '../../data.js';
import {
    ONLINE_SUB_COURSE, EXERCISES, ALL_SECTIONS, SECTION_LABELS,
    CLASSIFY_OPTIONS, TREATMENT_OPTIONS,
    INFANT_SECTIONS, INFANT_SECTION_LABELS,
    INFANT_CLASSIFY_OPTIONS, INFANT_TREATMENT_OPTIONS,
    getExerciseById, getExercisesForSubCourse, matchesSubCourse,
} from './exercises';

export {
    ONLINE_SUB_COURSE, EXERCISES, ALL_SECTIONS, SECTION_LABELS,
    CLASSIFY_OPTIONS, TREATMENT_OPTIONS,
    getExerciseById, getExercisesForSubCourse,
} from './exercises';

// IMPORTANT: loaded lazily, NOT with a static import.
// IMNCIRecordingForm imports DataContext at module scope. A static import here
// pulls DataContext into Course.jsx's module graph through this file, which
// leaves useDataCache() undefined by the time CourseManagementView renders
// ("Cannot destructure property 'federalCoordinators' of 'useDataCache(...)'").
// The dynamic import breaks that edge, and keeps ~2,400 lines of form out of the
// Course chunk for anyone who never opens an exercise.
const ChildForm  = lazy(() => import('../IMNCIRecordingForm').then(m => ({ default: m.ChildForm })));
const InfantForm = lazy(() => import('../IMNCIRecordingForm').then(m => ({ default: m.InfantForm })));

// Labels for the feedback panel. Keys are ChildForm's own state field names.
export const FIELD_LABELS = {
    childName: 'Child name', sex: 'Sex', ageMonths: 'Age (months)', weightKg: 'Weight (kg)',
    lengthCm: 'Length / height (cm)', tempC: 'Temperature (°C)', visitType: 'Visit type',
    date: 'Date', problems: 'Presenting problem', ageDaysWeeks: 'Age (days / weeks)',
    notAbleToDrink: 'Not able to drink or breastfeed', vomitsEverything: 'Vomits everything',
    historyOfConvulsions: 'Convulsions in current illness', lethargicUnconscious: 'Lethargic or unconscious',
    convulsingNow: 'Convulsing now',
    hasCough: 'Has cough or difficult breathing', coughDays: 'Cough duration (days)',
    breathRate: 'Breaths per minute', fastBreathing: 'Fast breathing', chestIndrawing: 'Chest indrawing',
    stridor: 'Stridor', wheeze: 'Wheeze',
    hasDiarrhea: 'Has diarrhoea', diarrheaDays: 'Diarrhoea duration (days)', bloodInStool: 'Blood in the stool',
    lethargic: 'Lethargic or unconscious', restlessIrritable: 'Restless or irritable', sunkenEyes: 'Sunken eyes',
    drinkPoorly: 'Not able to drink / drinking poorly', drinkEagerly: 'Drinks eagerly, thirsty',
    pinchVerySlow: 'Skin pinch goes back very slowly', pinchSlow: 'Skin pinch goes back slowly',
    hasFever: 'Has fever', feverDays: 'Fever duration (days)', neckStiffness: 'Stiff neck',
    measlesRash: 'Generalised measles rash', malariaTest: 'Malaria test',
    hasEarProblem: 'Has ear problem', earPain: 'Ear pain', earDischarge: 'Ear discharge',
    tenderSwelling: 'Tender swelling behind the ear',
    pallor: 'Palmar pallor', edema: 'Oedema of both feet', muacCm: 'MUAC (cm)', appetiteTest: 'Appetite test',
};

const NUMERIC_FIELDS = ['ageMonths', 'weightKg', 'lengthCm', 'tempC', 'coughDays', 'diarrheaDays', 'breathRate', 'feverDays', 'muacCm'];

const pretty = (v) => {
    if (v === true) return 'Present';
    if (v === false) return 'Not present';
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
};

const labelFor = (k) => FIELD_LABELS[k] || k;

const sameSet = (a = [], b = []) =>
    a.length === b.length && a.every(x => b.includes(x));

// ============================================================================
// 0. EXERCISE SOURCE   (built-in file + editable Firestore definitions)
// ============================================================================

// Fills the option banks so every section listed in `sections` has choices,
// mirroring withDefaults() in exercises.js for exercises coming from Firestore.
const applyOptionDefaults = (expected = {}) => ({
    ...expected,
    classifyOptions: Object.fromEntries(
        (expected.sections || []).map(sec => [sec, expected.classifyOptions?.[sec] || CLASSIFY_OPTIONS[sec] || []])
    ),
    treatmentOptions: expected.includeTreatment
        ? Object.fromEntries(
            (expected.sections || []).map(sec => [sec, expected.treatmentOptions?.[sec] || TREATMENT_OPTIONS[sec] || []])
        )
        : {},
});

/**
 * Built-in exercises merged with the ones stored in Firestore.
 * A stored exercise with the same id REPLACES the built-in — that is how the
 * Manage Exercises tab edits a shipped exercise without touching the source.
 */
export async function loadAllExercises(subCourse = ONLINE_SUB_COURSE, { includeDrafts = false, force = false } = {}) {
    let stored = [];
    try {
        const raw = await getCachedExerciseDefinitions({ force });
        // Tolerate a map as well as an array — a shape change in data.js used to
        // throw here and silently leave the learner with the built-ins only.
        stored = Array.isArray(raw) ? raw : Object.values(raw || {});
    } catch (e) {
        // Editing is optional: if the collection is unreadable the built-ins still work.
        console.warn('Could not load stored exercise definitions:', e.message);
    }

    const byId = {};
    EXERCISES.forEach(e => { byId[e.id] = { ...e, isCustom: false }; });

    // A stored exercise OVERLAYS the built-in of the same id — it does not
    // replace it. Replacing was the bug: a stored copy that was missing
    // `subCourse`, or that still carried the editor's default `draft: true`,
    // removed a published built-in from the learner's list with nothing on
    // screen to explain why.
    stored.forEach(e => {
        if (!e?.id) return;
        const builtIn = byId[e.id];
        byId[e.id] = {
            ...(builtIn || {}),
            ...e,
            subCourse: e.subCourse || builtIn?.subCourse || ONLINE_SUB_COURSE,
            draft: e.draft ?? builtIn?.draft ?? false,
            // An empty array from an older stored document must not wipe the
            // learning points that ship with the built-in exercise.
            learningPoints: (e.learningPoints?.length ? e.learningPoints : builtIn?.learningPoints) || [],
            expected: applyOptionDefaults(e.expected || builtIn?.expected || {}),
            isCustom: true,
        };
    });

    return Object.values(byId)
        .filter(e => matchesSubCourse(e, subCourse) && (includeDrafts || !e.draft))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// ============================================================================
// 1. GRADING   (pure — no React, safe to unit-test)
// ============================================================================

/**
 * Grade one case.
 *
 * @param {object} expected  the exercise's `expected` block
 * @param {object} submitted { patientData, assessments, chosenClassifications,
 *                             chosenTreatments, classifications }
 *                           `classifications` is what the app's own engine
 *                           computed — reported back, never graded.
 * @param {function} t       i18n translator, used to render option labels
 */
/**
 * Fields the learner must fill in on every case, whether or not the exercise
 * specifies an expected value for them. A blank child name, date, sex, visit
 * type or presenting problem is a recording error on the real form, so it is
 * marked as one here.
 */
export const REQUIRED_PATIENT_FIELDS = {
    child: ['childName', 'date', 'sex', 'visitType', 'problems'],
    infant: ['childName', 'date', 'visitType', 'problems'],
};

export function gradeCase(expected, submitted, t = (k) => k, { requiredFields = [] } = {}) {
    const detail = { patientData: {}, assessments: {}, classifications: {}, treatments: {} };

    // Per-category subtotals, plus the name of every item on each side of the
    // line. A learner who scores 71% needs to see WHICH seven of ten were right,
    // and a facilitator reviewing an attempt needs the same list.
    const breakdown = {
        patientData: { earned: 0, possible: 0, correct: [], wrong: [] },
        assessments: { earned: 0, possible: 0, correct: [], wrong: [] },
        classifications: { earned: 0, possible: 0, correct: [], wrong: [] },
        treatments: { earned: 0, possible: 0, correct: [], wrong: [] },
    };

    let earned = 0, possible = 0;

    const tally = (bucket, label, ok) => {
        breakdown[bucket].possible += 1;
        possible += 1;
        if (ok) {
            breakdown[bucket].earned += 1;
            breakdown[bucket].correct.push(label);
            earned += 1;
        } else {
            breakdown[bucket].wrong.push(label);
        }
    };

    const compare = (section, expObj, gotObj) => {
        Object.entries(expObj || {}).forEach(([key, want]) => {
            const got = gotObj?.[key];
            let ok;
            if (typeof want === 'boolean') ok = !!got === want;
            else if (NUMERIC_FIELDS.includes(key)) {
                const a = parseFloat(want), b = parseFloat(got);
                ok = !Number.isNaN(b) && Math.abs(a - b) <= (key === 'tempC' ? 0.2 : 0.01);
            } else ok = String(got ?? '').trim().toLowerCase() === String(want).trim().toLowerCase();

            detail[section][key] = { ok, expected: want, got };
            tally(section, labelFor(key), ok);
        });
    };

    compare('patientData', expected.patientData, submitted.patientData);
    compare('assessments', expected.assessments, submitted.assessments);

    // Anything required but not already graded against an expected value is
    // scored purely on whether the learner answered it at all.
    requiredFields.forEach(key => {
        if (detail.patientData[key]) return;
        const got = submitted.patientData?.[key];
        const ok = String(got ?? '').trim() !== '';
        detail.patientData[key] = { ok, expected: null, got, required: true };
        tally('patientData', labelFor(key), ok);
    });

    const optionLabel = (section, id, bank) => {
        const opt = (expected[bank]?.[section] || []).find(o => o.id === id);
        if (opt?.label) return opt.label;
        return String(id).startsWith('imci.') ? t(id) : id;
    };

    // Classification — the learner's own choice, all-or-nothing per section.
    Object.entries(expected.classifications || {}).forEach(([section, wantIds]) => {
        const gotIds = submitted.chosenClassifications?.[section] || [];
        const ok = sameSet(wantIds, gotIds);
        detail.classifications[section] = {
            ok,
            expected: wantIds.map(id => optionLabel(section, id, 'classifyOptions')),
            chosen: gotIds.map(id => optionLabel(section, id, 'classifyOptions')),
            // What the app's engine derived from the signs entered, for comparison.
            engine: (submitted.classifications?.[section]?.c || []).map(c => c.label),
        };
        tally('classifications', SECTION_LABELS[section] || section, ok);
    });

    // Treatment — only when the case includes it.
    if (expected.includeTreatment) {
        Object.entries(expected.treatments || {}).forEach(([section, wantIds]) => {
            const gotIds = submitted.chosenTreatments?.[section] || [];
            const ok = sameSet(wantIds, gotIds);
            detail.treatments[section] = {
                ok,
                expected: wantIds.map(id => optionLabel(section, id, 'treatmentOptions')),
                chosen: gotIds.map(id => optionLabel(section, id, 'treatmentOptions')),
            };
            tally('treatments', SECTION_LABELS[section] || section, ok);
        });
    }

    const percent = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    return { earned, possible, percent, correct: earned === possible, detail, breakdown };
}

/**
 * Grade a quiz exercise. Each question is all-or-nothing, 1 point.
 *   'mcq'    options[] + correct[] of indexes (multi-select when correct.length > 1)
 *   'tf'     correct: true | false
 *   'text'   correct: string, accept: [alternative spellings]
 */
export function gradeQuiz(questions = [], answers = {}) {
    const detail = {};
    let earned = 0;
    questions.forEach(q => {
        const given = answers[q.id];
        let ok = false;
        if (q.type === 'tf') {
            ok = given === q.correct;
        } else if (q.type === 'text') {
            const accepted = [q.correct, ...(q.accept || [])].map(x => String(x).trim().toLowerCase());
            ok = accepted.includes(String(given ?? '').trim().toLowerCase());
        } else {
            const want = new Set(q.correct || []);
            const got = new Set(Array.isArray(given) ? given : (given === undefined ? [] : [given]));
            ok = want.size === got.size && [...want].every(i => got.has(i));
        }
        detail[q.id] = { ok, expected: q.correct, given };
        if (ok) earned += 1;
    });
    const possible = questions.length;
    return { earned, possible, percent: possible ? Math.round((earned / possible) * 100) : 0, correct: earned === possible, detail, isQuiz: true };
}

// ============================================================================
// 2. CASE PAGE   (scenario bullets + the real form + feedback, all one page)
// ============================================================================

function ScenarioHeader({ exercise, participant, lang, onToggleLang }) {
    const bullets = (lang === 'ar' && exercise.narrativeAr) ? exercise.narrativeAr : exercise.narrative;
    const title = (lang === 'ar' && exercise.titleAr) ? exercise.titleAr : exercise.title;
    const rtl = lang === 'ar';

    return (
        <div className="border-2 border-sky-200 bg-sky-50 rounded-xl overflow-hidden">
            {participant?.name && (
                <div className="bg-sky-700 text-white px-5 py-2.5 flex items-center justify-between gap-3">
                    <span className="font-semibold text-sm truncate">{participant.name}</span>
                    <button onClick={onToggleLang}
                        className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 rounded px-2 py-1 flex-shrink-0">
                        <Languages className="w-3.5 h-3.5" />{lang === 'en' ? 'عربي' : 'EN'}
                    </button>
                </div>
            )}
            <div className="p-5" dir={rtl ? 'rtl' : 'ltr'}>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">{title}</h3>
                        <ul className={`mt-3 space-y-2 ${rtl ? 'pr-5' : 'pl-5'} list-disc marker:text-sky-500`}>
                            {(bullets || []).map((line, i) => (
                                <li key={i} className="text-sm text-slate-800 leading-relaxed">{line}</li>
                            ))}
                        </ul>
                        <p className="text-xs text-slate-500 mt-4">
                            Record this child on the form below, tick the classification you would give
                            {exercise.expected?.includeTreatment ? ' and the treatment you would identify' : ''},
                            then press <strong>Check my form</strong>. Nothing is saved to patient records.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Score strip, pinned to the top of the form with the scenario. */
/** Headline result only. Stays at the top, beside the scenario. */
function ScoreStrip({ result, passMark, attemptNo, saveState, saveError }) {
    if (!result) return null;
    const passed = result.percent >= passMark;
    return (
        <div className="space-y-2">
            <div className={`rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-white ${passed ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                <span className="font-bold flex items-center gap-2">
                    {passed ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    {passed ? 'Passed' : 'Below the pass mark'}
                    <span className="font-normal opacity-90 text-sm">
                        · attempt {attemptNo} · pass mark {passMark}%
                    </span>
                </span>
                <span className="font-bold text-lg">
                    {result.percent}% <span className="text-sm font-normal opacity-80">({result.earned}/{result.possible})</span>
                </span>
            </div>

            <p className="text-xs text-slate-500">
                {saveState === 'saving' && 'Recording this attempt…'}
                {saveState === 'saved' && `Attempt ${attemptNo} recorded. Each field is marked where you filled it in; the full breakdown is at the foot of the form.`}
                {saveState === 'error' && <span className="text-rose-600">Not recorded: {saveError}</span>}
                {saveState === 'idle' && 'Each field is marked where you filled it in; the full breakdown is at the foot of the form.'}
            </p>
        </div>
    );
}

/**
 * The itemised marking and the teaching, both at the FOOT of the form.
 *
 * This is the order a learner works in: fill the form, read the marks against
 * the fields as they scroll down, then arrive at the totals and the learning
 * points at the end.
 */
function ResultDetail({ result, exercise }) {
    if (!result) return null;

    const rows = [
        ['Child details', result.breakdown?.patientData],
        ['Signs recorded', result.breakdown?.assessments],
        ['Classification', result.breakdown?.classifications],
        ['Treatment', result.breakdown?.treatments],
    ].filter(([, b]) => b && b.possible > 0);

    // Authored learning points if the exercise has them; otherwise the case
    // explanation stands as the single point.
    const points = (exercise.learningPoints || []).filter(p => String(p).trim() !== '');
    const fallback = points.length === 0 && exercise.explain ? [exercise.explain] : [];
    const learning = points.length > 0 ? points : fallback;

    return (
        <div className="space-y-4" dir="ltr">
            {rows.length > 0 && (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">
                        How this attempt was scored
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[540px]">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                                    <th className="text-left p-2.5 font-semibold">Part of the form</th>
                                    <th className="p-2.5 font-semibold w-20">Score</th>
                                    <th className="text-left p-2.5 font-semibold">Correct</th>
                                    <th className="text-left p-2.5 font-semibold">Wrong</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map(([label, b]) => (
                                    <tr key={label} className="align-top">
                                        <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">{label}</td>
                                        <td className={`p-2.5 text-center font-bold whitespace-nowrap ${b.earned === b.possible ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {b.earned}/{b.possible}
                                        </td>
                                        <td className="p-2.5 text-emerald-700 text-xs">{b.correct.join(', ') || '—'}</td>
                                        <td className="p-2.5 text-rose-700 text-xs">{b.wrong.join(', ') || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300">
                                    <td className="p-2.5">Total</td>
                                    <td className="p-2.5 text-center">{result.earned}/{result.possible}</td>
                                    <td className="p-2.5 text-xs font-normal text-slate-500" colSpan={2}>
                                        One mark per item. A classification or treatment row scores only when every
                                        correct box is ticked and no extra one is.
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {learning.length > 0 && (
                <div className="border-2 border-sky-200 rounded-xl bg-sky-50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-sky-600 text-white text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Learning points
                    </div>
                    <ul className="p-4 space-y-2">
                        {learning.map((p, i) => (
                            <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                                <span className="font-bold text-sky-600 flex-shrink-0">{i + 1}.</span>
                                <span>{p}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/**
 * One case, one page.
 *
 * @param {object}   exercise
 * @param {object}   participant   { id, name }
 * @param {function} onSubmit      async ({ result, submitted, durationSeconds }) => void
 * @param {function} onExit
 * @param {object}   readOnlyAttempt  a saved attempt, to render in review mode
 */
export function CasePlayer({ exercise, participant, onSubmit, onExit, previousBest = null, readOnlyAttempt = null, attemptsSoFar = 0 }) {
    const { t } = useTranslation();
    const [lang, setLang] = useState('en');
    const [result, setResult] = useState(readOnlyAttempt?.result || null);
    const [saveState, setSaveState] = useState(readOnlyAttempt ? 'saved' : 'idle');
    const [saveError, setSaveError] = useState('');
    const [attemptNo, setAttemptNo] = useState(readOnlyAttempt?.attemptNo || attemptsSoFar || 1);
    // Bumping this remounts the form, which is the only reliable way to clear
    // every field: the form owns its own state, and a fresh attempt must start
    // from a blank form rather than the previous answers.
    const [formKey, setFormKey] = useState(0);
    // The result popup, shown once on submission. Closing it leaves the form
    // locked — the popup is a receipt, not the only copy of the marking.
    const [showResult, setShowResult] = useState(false);
    const startedAt = useRef(Date.now());
    const topRef = useRef(null);

    const review = !!readOnlyAttempt;
    const passMark = exercise.passMark ?? 80;
    const infant = exercise.formType === 'infant';
    const fieldMap = infant ? INFANT_SECTION_FIELDS : SECTION_FIELDS;

    /**
     * Pressing "Check my form" IS the submission.
     *
     * The first check is the learner's initial answer and is recorded as
     * attempt 1. Every later check — after "Try again" — is recorded as its own
     * attempt, so the initial answer is never overwritten and a facilitator can
     * see how a learner moved from attempt 1 to attempt 3.
     */
    const handleCheck = async (payload) => {
        // A submitted form is closed. Re-submitting would record a second
        // attempt for answers the learner has already had marked for them.
        if (result || review) return;

        const graded = gradeCase(exercise.expected, payload, t, {
            requiredFields: REQUIRED_PATIENT_FIELDS[infant ? 'infant' : 'child'],
        });
        const thisAttempt = attemptsSoFar + 1;

        setResult(graded);
        setAttemptNo(thisAttempt);
        setShowResult(true);
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

        if (!onSubmit || review) return;

        setSaveState('saving');
        setSaveError('');
        try {
            await onSubmit({
                result: graded,
                submitted: payload,
                attemptNo: thisAttempt,
                isInitialAnswer: thisAttempt === 1,
                durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
            });
            setSaveState('saved');
        } catch (e) {
            setSaveState('error');
            setSaveError(e?.message || 'Could not record this attempt.');
        }
    };

    const detail = result?.detail;

    /**
     * Everything the form needs to mark itself, keyed by the `name` attribute
     * each graded input already carries. Nothing is rendered outside the form:
     * a field the learner got wrong is ringed where it sits, with the correct
     * value beside it.
     */
    const trainingMarks = useMemo(() => {
        if (!detail) return null;

        const fields = {};
        const addField = (key, d, kind) => {
            const isBool = typeof d.expected === 'boolean';
            // Radios carry a literal `value` attribute, so a string answer can
            // be marked on the exact option rather than the whole group.
            const isChoice = !isBool && kind === 'text';
            const blank = String(d.got ?? '').trim() === '';

            fields[key] = {
                kind: isBool ? 'bool' : 'value',
                ok: d.ok,
                expected: d.expected,
                // A field that is only required, with no expected value, is
                // marked on whether it was answered at all.
                expectedText: d.required ? 'filled in' : pretty(d.expected),
                expectedValue: isChoice && !d.required ? d.expected : null,
                gotValue: isChoice && d.got ? d.got : null,
                // Nothing was chosen: the whole group is the error, not one option.
                unanswered: blank && !d.ok,
            };
        };

        const patientFields = infant ? INFANT_PATIENT_FIELDS : PATIENT_FIELDS;
        const kindOf = (key) => {
            const all = [...patientFields, ...Object.values(fieldMap).flat()];
            return (all.find(([f]) => f === key) || [])[1] || 'text';
        };

        Object.entries(detail.patientData).forEach(([k, d]) => addField(k, d, kindOf(k)));
        Object.entries(detail.assessments).forEach(([k, d]) => addField(k, d, kindOf(k)));

        // The correct option ids per section, so each column marks its own ticks.
        const classify = {};
        const treatment = {};
        Object.entries(exercise.expected?.classifications || {}).forEach(([sec, ids]) => { classify[sec] = ids; });
        if (exercise.expected?.includeTreatment) {
            Object.entries(exercise.expected?.treatments || {}).forEach(([sec, ids]) => { treatment[sec] = ids; });
        }

        return { fields, classify, treatment };
    }, [detail, exercise, fieldMap, infant]);

    const header = (
        <div ref={topRef} className="space-y-4">
            <ScenarioHeader
                exercise={exercise}
                participant={participant}
                lang={lang}
                onToggleLang={() => setLang(l => (l === 'en' ? 'ar' : 'en'))}
            />
            <ScoreStrip
                result={result}
                passMark={passMark}
                attemptNo={attemptNo}
                saveState={saveState}
                saveError={saveError}
            />
        </div>
    );

    const actions = result ? (
        <div className="space-y-4">
            <ResultDetail result={result} exercise={exercise} />
            <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-xl bg-white p-4">
            <p className="text-sm text-slate-500">
                {previousBest != null ? `Previous best ${previousBest}%. ` : ''}
                {!review && 'Every check is recorded as its own attempt.'}
            </p>
            <div className="flex gap-2">
                {!review && (
                    <Button variant="secondary" onClick={() => {
                        setResult(null);
                        setSaveState('idle');
                        setSaveError('');
                        setShowResult(false);
                        setFormKey(k => k + 1);
                        startedAt.current = Date.now();
                        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
                        Try again with a blank form
                    </Button>
                )}
                {onExit && <Button variant="secondary" onClick={onExit}>Back to exercises</Button>}
            </div>
            </div>
        </div>
    ) : null;

    // Young infants (up to 2 months) are assessed on a different form entirely.
    const FormComponent = infant ? InfantForm : ChildForm;

    return (
        <Suspense fallback={<div className="flex justify-center p-10"><Spinner /></div>}>
            {showResult && result && (
                <Modal isOpen={showResult} onClose={() => setShowResult(false)}
                    title={`${exercise.title} — attempt ${attemptNo}`} size="xl">
                    <CardBody className="p-4 sm:p-5 max-h-[80vh] overflow-y-auto space-y-4">
                        <div className={`rounded-xl px-5 py-4 text-white ${result.percent >= passMark ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="font-bold flex items-center gap-2 text-lg">
                                    {result.percent >= passMark ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                    {result.percent >= passMark ? 'Passed' : 'Below the pass mark'}
                                </span>
                                <span className="font-bold text-2xl">
                                    {result.percent}% <span className="text-sm font-normal opacity-80">({result.earned}/{result.possible})</span>
                                </span>
                            </div>
                            <p className="text-sm opacity-90 mt-1">
                                Pass mark {passMark}% · attempt {attemptNo}
                                {saveState === 'saving' && ' · recording…'}
                                {saveState === 'saved' && ' · recorded'}
                                {saveState === 'error' && ` · NOT recorded: ${saveError}`}
                            </p>
                        </div>

                        <ResultDetail result={result} exercise={exercise} />

                        <p className="text-xs text-slate-500">
                            Close this to see each answer marked on the form itself. The form is now
                            closed for this attempt — start a blank form to try again.
                        </p>

                        <div className="flex justify-end border-t border-slate-200 pt-4">
                            <Button onClick={() => setShowResult(false)} className="px-10">OK</Button>
                        </div>
                    </CardBody>
                </Modal>
            )}

            <FormComponent
                key={formKey}
                trainingCase={exercise.expected}
                trainingLocked={!!result || review}
                trainingHeader={header}
                trainingMarks={trainingMarks}
                trainingFeedback={actions}
                onTrainingCheck={handleCheck}
                selectedState={null}
                selectedLocality={null}
                selectedFacility={null}
                onBack={onExit || (() => {})}
                onSaveSuccess={() => {}}
            />
        </Suspense>
    );
}

// ============================================================================
// 2b. QUIZ PAGE   (multiple choice, true/false, short answer — one page)
// ============================================================================

function QuizQuestion({ q, index, value, onChange, detail, locked }) {
    const wrong = detail && !detail.ok;
    const right = detail && detail.ok;

    return (
        <div className={`border rounded-lg p-4 ${!detail ? 'border-slate-200 bg-white' : right ? 'border-emerald-300 bg-emerald-50/40' : 'border-rose-300 bg-rose-50/40'}`}>
            <div className="flex items-start gap-2 mb-3">
                <span className="text-xs font-bold text-slate-400 mt-0.5">{index + 1}.</span>
                <p className="text-sm font-medium text-slate-800 flex-1 whitespace-pre-line">{q.question}</p>
                {right && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                {wrong && <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            </div>

            {q.type === 'text' ? (
                <input
                    disabled={locked}
                    className="w-full sm:w-80 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={q.placeholder || 'Type your answer'}
                />
            ) : q.type === 'tf' ? (
                <div className="flex gap-2">
                    {[{ v: true, l: 'True' }, { v: false, l: 'False' }].map(o => (
                        <button key={o.l} type="button" disabled={locked} onClick={() => onChange(o.v)}
                            className={`px-4 py-1.5 rounded-md text-sm border transition-colors ${
                                value === o.v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                            {o.l}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="space-y-1.5">
                    {(q.correct || []).length > 1 && <p className="text-xs text-slate-500">Select all that apply.</p>}
                    {q.options.map((opt, i) => {
                        const multi = (q.correct || []).length > 1;
                        const chosen = Array.isArray(value) ? value.includes(i) : value === i;
                        return (
                            <button key={i} type="button" disabled={locked}
                                onClick={() => {
                                    if (multi) {
                                        const cur = Array.isArray(value) ? value : [];
                                        onChange(cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i]);
                                    } else onChange([i]);
                                }}
                                className={`w-full text-left border rounded-md px-3 py-2 text-sm transition-colors ${
                                    chosen ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-400' : 'bg-white border-slate-200 hover:border-slate-400'}`}>
                                <span className="text-slate-400 font-mono text-xs mr-2">{String.fromCharCode(97 + i)}</span>{opt}
                            </button>
                        );
                    })}
                </div>
            )}

            {detail && !detail.ok && (
                <p className="text-xs text-emerald-700 mt-2">
                    Correct answer:{' '}
                    <strong>
                        {q.type === 'tf' ? (q.correct ? 'True' : 'False')
                            : q.type === 'text' ? q.correct
                            : (q.correct || []).map(i => q.options[i]).join('; ')}
                    </strong>
                </p>
            )}
            {detail && q.explain && (
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{q.explain}</p>
            )}
        </div>
    );
}

export function QuizPlayer({ exercise, participant, onSubmit, onExit, previousBest = null, readOnlyAttempt = null }) {
    const [lang, setLang] = useState('en');
    const [answers, setAnswers] = useState(readOnlyAttempt?.submitted?.answers || {});
    const [result, setResult] = useState(readOnlyAttempt?.result || null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(!!readOnlyAttempt);
    const [saveError, setSaveError] = useState('');
    const startedAt = useRef(Date.now());
    const endRef = useRef(null);

    const review = !!readOnlyAttempt;
    const questions = exercise.questions || [];
    const passMark = exercise.passMark ?? 80;

    const check = () => {
        const g = gradeQuiz(questions, answers);
        setResult(g); setSaved(false);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const save = async () => {
        if (!onSubmit || !result) return;
        setSaving(true); setSaveError('');
        try {
            await onSubmit({
                result,
                submitted: { answers },
                durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
            });
            setSaved(true);
        } catch (e) { setSaveError(e?.message || 'Could not save your result.'); }
        finally { setSaving(false); }
    };

    const answeredAll = questions.every(q => answers[q.id] !== undefined &&
        !(Array.isArray(answers[q.id]) && answers[q.id].length === 0) &&
        !(q.type === 'text' && String(answers[q.id]).trim() === ''));

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <ScenarioHeader exercise={exercise} participant={participant} lang={lang}
                onToggleLang={() => setLang(l => (l === 'en' ? 'ar' : 'en'))} />

            <div className="space-y-3">
                {questions.map((q, i) => (
                    <QuizQuestion key={q.id} q={q} index={i}
                        value={answers[q.id]}
                        onChange={(v) => setAnswers(a => ({ ...a, [q.id]: v }))}
                        detail={result?.detail?.[q.id]}
                        locked={review || !!result} />
                ))}
            </div>

            <div ref={endRef} className="border border-slate-200 rounded-xl bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                    {result ? (
                        <>
                            <span className={`font-bold ${result.percent >= passMark ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {result.percent}% — {result.earned}/{result.possible}
                            </span>
                            <span className="text-slate-500"> · pass mark {passMark}%{previousBest != null ? ` · previous best ${previousBest}%` : ''}</span>
                            {saveError && <p className="text-rose-600 mt-1">{saveError}</p>}
                            {saved && !review && <p className="text-emerald-600 mt-1">Result saved.</p>}
                        </>
                    ) : (
                        <span className="text-slate-500">{Object.keys(answers).length} of {questions.length} answered</span>
                    )}
                </div>
                <div className="flex gap-2">
                    {!result && !review && <Button onClick={check} disabled={!answeredAll}>Check my answers</Button>}
                    {result && !review && onSubmit && (
                        <Button onClick={save} disabled={saving || saved}>
                            {saving ? <Spinner size="sm" /> : saved ? 'Saved' : 'Save my result'}
                        </Button>
                    )}
                    {result && !review && <Button variant="secondary" onClick={() => { setAnswers({}); setResult(null); setSaved(false); startedAt.current = Date.now(); }}>Try again</Button>}
                    {onExit && <Button variant="secondary" onClick={onExit}>Back to exercises</Button>}
                </div>
            </div>

            {result && exercise.explain && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm text-slate-700 leading-relaxed">{exercise.explain}</p>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// 3. VIEWS   (picker, course tab, results grid, public page)
// ============================================================================

export function ExerciseListView({
    course, participant, subCourse = ONLINE_SUB_COURSE,
    source = 'public', includeDrafts = false, onChangeParticipant = null,
}) {
    const [exercises, setExercises] = useState(() => getExercisesForSubCourse(subCourse, { includeDrafts }));
    // Kept only so the empty state can say WHY the list is empty.
    const [allForSubCourse, setAllForSubCourse] = useState(() => getExercisesForSubCourse(subCourse, { includeDrafts: true }));
    const [activeId, setActiveId] = useState(null);
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewAttempt, setReviewAttempt] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });

    const loadAttempts = useCallback(async () => {
        if (!course?.id || !participant?.id) { setLoading(false); return; }
        setLoading(true);
        try {
            setAttempts(await listExerciseAttemptsForParticipant(course.id, participant.id));
        } catch (e) {
            setToast({ show: true, message: `Could not load previous attempts: ${e.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [course?.id, participant?.id]);

    useEffect(() => { loadAttempts(); }, [loadAttempts]);

    // Pull in anything authored through Manage Exercises. Built-ins render
    // immediately, then the merged list replaces them.
    useEffect(() => {
        let alive = true;
        loadAllExercises(subCourse, { includeDrafts: true })
            .then(all => {
                if (!alive) return;
                setAllForSubCourse(all);
                setExercises(includeDrafts ? all : all.filter(e => !e.draft));
            })
            .catch(() => {});
        return () => { alive = false; };
    }, [subCourse, includeDrafts]);

    const best = useMemo(() => bestByExercise(attempts), [attempts]);
    const active = activeId ? exercises.find(e => e.id === activeId) : null;

    const makeSubmit = (exercise) => async ({ result, submitted, durationSeconds, attemptNo, isInitialAnswer }) => {
        // The document id in data.js is keyed on attemptNo, so the number must
        // never repeat: counting rows would collide if a row failed to load or
        // was soft-deleted, and the earlier attempt would be overwritten.
        const priorMax = attempts
            .filter(a => a.exerciseId === exercise.id)
            .reduce((max, a) => Math.max(max, Number(a.attemptNo) || 0), 0);
        const n = Math.max(attemptNo ?? 0, priorMax + 1);
        await upsertExerciseAttempt({
            courseId: course.id,
            participantId: participant.id,
            participantName: participant.name,
            exerciseId: exercise.id,
            exerciseTitle: exercise.title,
            subCourse,
            attemptNo: n,
            isInitialAnswer: isInitialAnswer ?? n === 1,
            percent: result.percent,
            earned: result.earned,
            possible: result.possible,
            passed: result.percent >= (exercise.passMark ?? 80),
            durationSeconds,
            responses: { submitted },
            results: { result },
            source,
        });
        setToast({ show: true, message: 'Your result has been saved.', type: 'success' });
        await loadAttempts();
    };

    if (active) {
        return (
            <>
                {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false })} />}
                {active.kind === 'quiz' ? (
                    <QuizPlayer
                        exercise={active}
                        participant={participant}
                        previousBest={best[active.id]?.percent ?? null}
                        readOnlyAttempt={reviewAttempt ? { result: reviewAttempt.results?.result, submitted: reviewAttempt.responses?.submitted } : null}
                        onSubmit={makeSubmit(active)}
                        onExit={() => { setActiveId(null); setReviewAttempt(null); }}
                    />
                ) : (
                    <CasePlayer
                        exercise={active}
                        participant={participant}
                        attemptsSoFar={attempts
                            .filter(a => a.exerciseId === active.id)
                            .reduce((max, a) => Math.max(max, Number(a.attemptNo) || 0), 0)}
                        previousBest={best[active.id]?.percent ?? null}
                        readOnlyAttempt={reviewAttempt ? { result: reviewAttempt.results?.result, submitted: reviewAttempt.responses?.submitted } : null}
                        onSubmit={makeSubmit(active)}
                        onExit={() => { setActiveId(null); setReviewAttempt(null); }}
                    />
                )}
            </>
        );
    }

    return (
        <div className="space-y-4">
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false })} />}

            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Interactive Exercises</h2>
                    <p className="text-sm text-slate-500">{subCourse}{participant?.name ? ` · ${participant.name}` : ''}</p>
                </div>
                {onChangeParticipant && (
                    <Button variant="secondary" onClick={onChangeParticipant}>
                        <Users className="w-4 h-4" /> Change participant
                    </Button>
                )}
            </div>

            {loading ? <div className="flex justify-center p-8"><Spinner /></div>
                : exercises.length === 0 ? (
                    <EmptyState message={
                        allForSubCourse.length > 0
                            ? `${allForSubCourse.length} exercise${allForSubCourse.length === 1 ? ' is' : 's are'} written for “${subCourse}”, but ${allForSubCourse.length === 1 ? 'it is' : 'they are all'} still marked DRAFT. Open Manage Exercises and turn Draft off to publish.`
                            : `No exercises match the sub-course “${subCourse}”. Check that the course's sub-course name matches ONLINE_SUB_COURSE in exercises.js.`
                    } />
                )
                : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {exercises.map(ex => {
                            const b = best[ex.id];
                            const passed = b && b.percent >= (ex.passMark ?? 80);
                            const count = attempts.filter(a => a.exerciseId === ex.id).length;
                            return (
                                <div key={ex.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${passed ? 'bg-emerald-100' : 'bg-sky-100'}`}>
                                            {passed ? <Award className="w-5 h-5 text-emerald-600" /> : <BookOpen className="w-5 h-5 text-sky-600" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-slate-800 text-sm leading-snug">{ex.title}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ex.estimatedMinutes || 15} min</span>
                                                <span>Pass {ex.passMark ?? 80}%</span>
                                                {ex.kind === 'quiz' && <span className="text-purple-600 font-semibold">QUIZ</span>}
                                                {ex.formType === 'infant' && <span className="text-sky-600 font-semibold">YOUNG INFANT</span>}
                                                {ex.expected?.includeTreatment && <span className="text-sky-600">+ treatment</span>}
                                                {ex.draft && <span className="text-amber-600 font-semibold">DRAFT</span>}
                                            </div>
                                            {b && (
                                                <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    Best {b.percent}% · {count} attempt{count > 1 ? 's' : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Button className="flex-1 justify-center" onClick={() => { setReviewAttempt(null); setActiveId(ex.id); }}>
                                            {b ? 'Try again' : 'Start'}
                                        </Button>
                                        {b && (
                                            <Button variant="secondary" onClick={() => { setReviewAttempt(b); setActiveId(ex.id); }}>
                                                Review
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
        </div>
    );
}

export function CourseExercisesView({ course, participants = [], selectedParticipantId = null, canManageExercises = true }) {
    const [participantId, setParticipantId] = useState(selectedParticipantId || '');
    const [tab, setTab] = useState('results');

    const participant = participants.find(p => p.id === participantId) || null;
    if (!course) return <EmptyState message="Select a course first." />;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b border-slate-200 pb-3 flex-wrap">
                <Button variant="tab" isActive={tab === 'live'} onClick={() => setTab('live')}>Live Dashboard</Button>
                <Button variant="tab" isActive={tab === 'results'} onClick={() => setTab('results')}>Exercise Results</Button>
                <Button variant="tab" isActive={tab === 'run'} onClick={() => setTab('run')}>Open an Exercise</Button>
                {canManageExercises && (
                    <Button variant="tab" isActive={tab === 'manage'} onClick={() => setTab('manage')}>Manage Exercises</Button>
                )}
            </div>

            {tab === 'live' && <LiveExerciseDashboard course={course} participants={participants} />}
            {tab === 'manage' && canManageExercises && <ExerciseManagerView />}

            {tab === 'results' && <ExerciseResultsTable course={course} participants={participants} />}

            {tab === 'run' && (
                <div className="space-y-4">
                    <div className="max-w-sm">
                        <FormGroup label="Participant">
                            <Select value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
                                <option value="">— Select participant —</option>
                                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                        </FormGroup>
                    </div>
                    {participant
                        ? <ExerciseListView course={course} participant={participant} source="facilitator" includeDrafts />
                        : <EmptyState message="Choose a participant to open the exercises on their behalf." />}
                </div>
            )}
        </div>
    );
}

export function ExerciseResultsTable({ course, participants = [] }) {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try { setAttempts(await listExerciseAttemptsForCourse(course.id)); }
        finally { setLoading(false); }
    }, [course.id]);


    useEffect(() => { load(); }, [load]);

    const exercises = getExercisesForSubCourse(ONLINE_SUB_COURSE, { includeDrafts: true });

    const rows = useMemo(() => {
        const byP = {};
        attempts.forEach(a => {
            byP[a.participantId] = byP[a.participantId] || { name: a.participantName, scores: {}, count: 0 };
            byP[a.participantId].count += 1;
            const cur = byP[a.participantId].scores[a.exerciseId];
            if (cur == null || a.percent > cur) byP[a.participantId].scores[a.exerciseId] = a.percent;
        });
        participants.forEach(p => { if (!byP[p.id]) byP[p.id] = { name: p.name, scores: {}, count: 0 }; });
        return Object.entries(byP).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [attempts, participants]);

    const exportCsv = () => {
        const header = ['Participant', ...exercises.map(e => e.title), 'Attempts'];
        const lines = rows.map(r => [`"${r.name}"`, ...exercises.map(e => r.scores[e.id] ?? ''), r.count].join(','));
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `exercise-results-${course.id}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (rows.length === 0) return <EmptyState message="No participants or attempts yet." />;

    return (
        <div className="space-y-3">
            <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> Refresh</Button>
                <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-3 text-left font-semibold border-b border-slate-200">Participant</th>
                            {exercises.map(e => (
                                <th key={e.id} className="p-3 text-center font-semibold border-b border-slate-200 whitespace-nowrap">
                                    {e.title.split('—')[0].trim()}
                                </th>
                            ))}
                            <th className="p-3 text-center font-semibold border-b border-slate-200">Attempts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="p-3 font-medium text-slate-800">{r.name}</td>
                                {exercises.map(e => {
                                    const s = r.scores[e.id];
                                    const passed = s != null && s >= (e.passMark ?? 80);
                                    return (
                                        <td key={e.id} className="p-3 text-center">
                                            {s == null ? <span className="text-slate-300">—</span>
                                                : <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s}%</span>}
                                        </td>
                                    );
                                })}
                                <td className="p-3 text-center text-slate-500">{r.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ============================================================================
// 3b. FULL EXERCISE REPORT   (course-level, for the Course Report tabs)
// ============================================================================
//
// Three questions a facilitator actually asks after a course:
//   1. Who did the exercises, and how did they score?
//   2. Which exercises did the group find hard?
//   3. Which specific signs, classifications or treatments were missed most?
//
// (3) is only answerable because each attempt stores the graded breakdown, so
// the wrong items can be counted across the whole cohort.

const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null);

function ReportTile({ label, value, sub, tone = 'slate' }) {
    const tones = { slate: 'text-slate-800', emerald: 'text-emerald-600', amber: 'text-amber-600', sky: 'text-sky-600', rose: 'text-rose-600' };
    return (
        <div className="border border-slate-200 rounded-lg p-4 bg-white text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
    );
}

export function ExerciseCourseReport({ course, participants = [], subCourse = ONLINE_SUB_COURSE }) {
    const [attempts, setAttempts] = useState([]);
    const [exercises, setExercises] = useState(() => getExercisesForSubCourse(subCourse, { includeDrafts: true }));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [rows, list] = await Promise.all([
                listExerciseAttemptsForCourse(course.id),
                loadAllExercises(subCourse, { includeDrafts: true }),
            ]);
            setAttempts(rows || []);
            setExercises(list || []);
        } catch (e) {
            setError(e?.message || 'Could not load exercise results.');
        } finally {
            setLoading(false);
        }
    }, [course.id, subCourse]);

    useEffect(() => { load(); }, [load]);

    const model = useMemo(() => {
        // attempts grouped by participant + exercise
        const key = (pid, eid) => `${pid}__${eid}`;
        const byPair = {};
        attempts.forEach(a => {
            const k = key(a.participantId, a.exerciseId);
            (byPair[k] = byPair[k] || []).push(a);
        });
        Object.values(byPair).forEach(list => list.sort((x, y) => (x.attemptNo || 0) - (y.attemptNo || 0)));

        const roster = participants.length
            ? participants
            : Object.values(attempts.reduce((acc, a) => {
                acc[a.participantId] = { id: a.participantId, name: a.participantName };
                return acc;
            }, {}));

        // ---- per exercise -------------------------------------------------
        const perExercise = exercises.map(ex => {
            const pairs = Object.entries(byPair)
                .filter(([k]) => k.endsWith(`__${ex.id}`))
                .map(([, list]) => list);

            const firsts = pairs.map(l => l[0]).filter(Boolean);
            const bests = pairs.map(l => Math.max(...l.map(a => Number(a.percent) || 0)));
            const passMark = ex.passMark ?? 80;

            return {
                id: ex.id,
                title: ex.title,
                draft: ex.draft,
                passMark,
                attemptedBy: pairs.length,
                notStarted: Math.max(0, roster.length - pairs.length),
                initialAvg: avg(firsts.map(a => Number(a.percent) || 0)),
                bestAvg: avg(bests),
                passed: bests.filter(b => b >= passMark).length,
                passRate: pctOf(bests.filter(b => b >= passMark).length, pairs.length),
                totalAttempts: pairs.reduce((n, l) => n + l.length, 0),
                avgAttempts: pairs.length ? (pairs.reduce((n, l) => n + l.length, 0) / pairs.length).toFixed(1) : '—',
                avgMinutes: avg(firsts.map(a => Math.round((Number(a.durationSeconds) || 0) / 60))),
            };
        });

        // ---- per participant ----------------------------------------------
        const perParticipant = roster.map(p => {
            const scores = {};
            const initial = {};
            let attemptCount = 0;
            exercises.forEach(ex => {
                const list = byPair[key(p.id, ex.id)];
                if (!list?.length) return;
                attemptCount += list.length;
                scores[ex.id] = Math.max(...list.map(a => Number(a.percent) || 0));
                initial[ex.id] = Number(list[0].percent) || 0;
            });
            const done = Object.keys(scores);
            const passedCount = done.filter(id => {
                const ex = exercises.find(e => e.id === id);
                return scores[id] >= (ex?.passMark ?? 80);
            }).length;
            return {
                id: p.id,
                name: p.name || '—',
                scores,
                initial,
                attemptCount,
                completed: done.length,
                passedCount,
                overall: avg(done.map(id => scores[id])),
            };
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // ---- commonly missed items ----------------------------------------
        // Counted on each learner's FIRST attempt only: later attempts are made
        // with the marking already in front of them, so including them would
        // flatter the group and hide the real teaching gaps.
        const missCounts = {};
        let scoredFirsts = 0;
        Object.values(byPair).forEach(list => {
            const first = list[0];
            const bd = first?.results?.result?.breakdown;
            if (!bd) return;
            scoredFirsts += 1;
            [
                ['Child details', bd.patientData],
                ['Sign', bd.assessments],
                ['Classification', bd.classifications],
                ['Treatment', bd.treatments],
            ].forEach(([group, b]) => {
                (b?.wrong || []).forEach(label => {
                    const k = `${group}||${label}`;
                    missCounts[k] = (missCounts[k] || 0) + 1;
                });
            });
        });

        const missed = Object.entries(missCounts)
            .map(([k, count]) => {
                const [group, label] = k.split('||');
                return { group, label, count, percent: pctOf(count, scoredFirsts) };
            })
            .sort((a, b) => b.count - a.count);

        // ---- headline -------------------------------------------------------
        const everyone = perParticipant.filter(p => p.completed > 0);
        const overallScores = everyone.map(p => p.overall).filter(v => v != null);

        return {
            roster,
            perExercise,
            perParticipant,
            missed,
            scoredFirsts,
            kpis: {
                started: everyone.length,
                notStarted: roster.length - everyone.length,
                totalAttempts: attempts.length,
                avgScore: avg(overallScores),
                fullyPassed: perParticipant.filter(p => p.completed > 0 && p.passedCount === p.completed).length,
            },
        };
    }, [attempts, exercises, participants]);

    const csv = (filename, header, lines) => {
        const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const exportParticipants = () => csv(
        `exercise-report-participants-${course.id}.csv`,
        ['Participant', ...exercises.map(e => e.title), 'Exercises done', 'Passed', 'Total attempts', 'Average %'],
        model.perParticipant.map(r => [
            q(r.name),
            ...exercises.map(e => r.scores[e.id] ?? ''),
            r.completed, r.passedCount, r.attemptCount, r.overall ?? '',
        ].join(','))
    );

    const exportMissed = () => csv(
        `exercise-report-missed-items-${course.id}.csv`,
        ['Group', 'Item', 'Learners who got it wrong', '% of first attempts'],
        model.missed.map(m => [q(m.group), q(m.label), m.count, m.percent].join(','))
    );

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;
    if (attempts.length === 0) {
        return <EmptyState message={`No exercise attempts have been recorded for this course yet.`} />;
    }

    const { kpis } = model;

    return (
        <div className="space-y-6" dir="ltr">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <p className="text-sm text-slate-500">
                    {kpis.totalAttempts} attempt{kpis.totalAttempts === 1 ? '' : 's'} from {kpis.started} of {model.roster.length} participants
                </p>
                <div className="flex gap-2 print-hide">
                    <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> Refresh</Button>
                    <Button variant="secondary" onClick={exportParticipants}>Export participants CSV</Button>
                    {model.missed.length > 0 && <Button variant="secondary" onClick={exportMissed}>Export missed items CSV</Button>}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ReportTile label="Started" value={kpis.started} sub={`of ${model.roster.length} participants`} tone="sky" />
                <ReportTile label="Not started" value={kpis.notStarted} tone={kpis.notStarted > 0 ? 'amber' : 'emerald'} />
                <ReportTile label="Total attempts" value={kpis.totalAttempts} />
                <ReportTile label="Average score" value={kpis.avgScore != null ? `${kpis.avgScore}%` : '—'} sub="best attempt per exercise" tone="emerald" />
                <ReportTile label="Passed everything" value={kpis.fullyPassed} sub="of those who started" tone="emerald" />
            </div>

            {/* ---- per exercise ---- */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">
                    Results by exercise
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[820px]">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                            <tr>
                                <th className="p-3 text-left font-semibold">Exercise</th>
                                <th className="p-3 font-semibold">Attempted by</th>
                                <th className="p-3 font-semibold">Avg 1st attempt</th>
                                <th className="p-3 font-semibold">Avg best</th>
                                <th className="p-3 font-semibold">Pass rate</th>
                                <th className="p-3 font-semibold">Avg attempts</th>
                                <th className="p-3 font-semibold">Avg minutes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {model.perExercise.map(e => (
                                <tr key={e.id} className={e.attemptedBy === 0 ? 'opacity-50' : ''}>
                                    <td className="p-3 font-medium text-slate-800">
                                        {e.title}
                                        {e.draft && <span className="ml-2 text-[10px] font-bold text-amber-600">DRAFT</span>}
                                    </td>
                                    <td className="p-3 text-center">{e.attemptedBy}<span className="text-slate-400"> / {model.roster.length}</span></td>
                                    <td className="p-3 text-center">{e.initialAvg != null ? `${e.initialAvg}%` : '—'}</td>
                                    <td className="p-3 text-center font-semibold">{e.bestAvg != null ? `${e.bestAvg}%` : '—'}</td>
                                    <td className={`p-3 text-center font-bold ${e.attemptedBy === 0 ? 'text-slate-400' : e.passRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {e.attemptedBy === 0 ? '—' : `${e.passRate}%`}
                                    </td>
                                    <td className="p-3 text-center">{e.avgAttempts}</td>
                                    <td className="p-3 text-center">{e.avgMinutes != null ? e.avgMinutes : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ---- commonly missed ---- */}
            {model.missed.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div className="px-4 py-2.5 bg-rose-700 text-white text-sm font-bold uppercase tracking-wide">
                        Most commonly missed items
                    </div>
                    <p className="px-4 pt-3 text-xs text-slate-500">
                        Counted on each learner&apos;s first attempt only ({model.scoredFirsts} first attempts),
                        because later attempts are made with the marking already visible.
                    </p>
                    <div className="p-4 space-y-2.5">
                        {model.missed.slice(0, 12).map(m => (
                            <div key={`${m.group}-${m.label}`}>
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <span className="text-sm text-slate-700">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 mr-2">{m.group}</span>
                                        {m.label}
                                    </span>
                                    <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">{m.count} · {m.percent}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500" style={{ width: `${m.percent}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ---- per participant ---- */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-2.5 bg-slate-800 text-white text-sm font-bold uppercase tracking-wide">
                    Results by participant
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                            <tr>
                                <th className="p-3 text-left font-semibold">Participant</th>
                                {exercises.map(e => (
                                    <th key={e.id} className="p-3 font-semibold whitespace-nowrap" title={e.title}>
                                        {e.title.split('—')[0].trim()}
                                    </th>
                                ))}
                                <th className="p-3 font-semibold">Done</th>
                                <th className="p-3 font-semibold">Passed</th>
                                <th className="p-3 font-semibold">Attempts</th>
                                <th className="p-3 font-semibold">Average</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {model.perParticipant.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-medium text-slate-800">{r.name}</td>
                                    {exercises.map(e => {
                                        const best = r.scores[e.id];
                                        const first = r.initial[e.id];
                                        const passed = best != null && best >= (e.passMark ?? 80);
                                        return (
                                            <td key={e.id} className="p-3 text-center">
                                                {best == null ? <span className="text-slate-300">—</span> : (
                                                    <div className="flex flex-col items-center leading-tight">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {best}%
                                                        </span>
                                                        {first !== best && (
                                                            <span className="text-[10px] text-slate-400 mt-0.5">1st {first}%</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="p-3 text-center text-slate-600">{r.completed}</td>
                                    <td className="p-3 text-center text-slate-600">{r.passedCount}</td>
                                    <td className="p-3 text-center text-slate-500">{r.attemptCount}</td>
                                    <td className="p-3 text-center font-bold text-slate-800">{r.overall != null ? `${r.overall}%` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
                    A cell shows the best score; where a learner improved, the first attempt is shown beneath it.
                </p>
            </div>
        </div>
    );
}

export function PublicExerciseView({ courseId }) {
    const [course, setCourse] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [participant, setParticipant] = useState(null);
    const [pickId, setPickId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                // Cached for the session: a participant who reloads, loses signal,
                // or reopens the link does not re-download the course and roster.
                const c = await getCachedCourse(courseId);
                if (!c) throw new Error('Course not found.');
                const ps = await getCachedParticipants(courseId);
                if (!alive) return;
                setCourse(c);
                setParticipants((ps || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            } catch (e) {
                if (alive) setError(e.message);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [courseId]);

    if (loading) return <div className="flex justify-center p-10"><Spinner /></div>;
    if (error) return <EmptyState message={error} />;

    if (!participant) {
        return (
            <div className="max-w-md mx-auto mt-6 p-4">
                <Card className="p-8">
                    <div className="text-center mb-6">
                        <div className="mx-auto h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="h-8 w-8 text-sky-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">IMNCI Online Exercises</h1>
                        <p className="text-sm text-slate-500 mt-1">{course.course_type}</p>
                        <p className="text-xs text-slate-400">{course.state} — {course.locality} ({course.start_date})</p>
                    </div>
                    <FormGroup label="Find your name to begin">
                        <Select value={pickId} onChange={(e) => setPickId(e.target.value)}>
                            <option value="">— Select your name —</option>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    </FormGroup>
                    <Button className="w-full justify-center mt-4" disabled={!pickId}
                        onClick={() => setParticipant(participants.find(p => p.id === pickId))}>
                        Continue
                    </Button>
                    {participants.length === 0 && (
                        <p className="text-xs text-amber-600 mt-4 text-center">
                            No participants are registered on this course yet. Register first using the course registration link.
                        </p>
                    )}
                </Card>
            </div>
        );
    }

    // Full width: the recording form needs the whole page.
    return (
        <div className="w-full px-3 sm:px-6 py-6">
            <button onClick={() => { setParticipant(null); setPickId(''); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
                <ArrowLeft className="w-4 h-4" /> Not you?
            </button>
            <ExerciseListView course={course} participant={participant} source="public" />
        </div>
    );
}

// ============================================================================
// 4. PARTICIPANT   (modal + summary for the Participants page)
// ============================================================================

export function ParticipantExercisesModal({ isOpen, onClose, course, participant, subCourse = ONLINE_SUB_COURSE }) {
    if (!isOpen || !participant) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Online Exercises — ${participant.name}`} size="xl">
            <CardBody className="p-3 sm:p-4 max-h-[85vh] overflow-y-auto">
                <ExerciseListView
                    course={course}
                    participant={participant}
                    subCourse={subCourse}
                    source="facilitator"
                    includeDrafts
                />
            </CardBody>
        </Modal>
    );
}

export function ParticipantExerciseSummary({ course, participant, subCourse = ONLINE_SUB_COURSE }) {
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewing, setReviewing] = useState(null);

    const load = useCallback(async () => {
        if (!course?.id || !participant?.id) { setLoading(false); return; }
        setLoading(true);
        try { setAttempts(await listExerciseAttemptsForParticipant(course.id, participant.id)); }
        finally { setLoading(false); }
    }, [course?.id, participant?.id]);

    useEffect(() => { load(); }, [load]);

    const exercises = useMemo(() => getExercisesForSubCourse(subCourse, { includeDrafts: true }), [subCourse]);
    const best = useMemo(() => bestByExercise(attempts), [attempts]);

    if (reviewing) {
        const ex = getExerciseById(reviewing.exerciseId);
        return (
            <div className="space-y-3">
                <Button variant="secondary" onClick={() => setReviewing(null)}>Back to summary</Button>
                {ex
                    ? <CasePlayer
                        exercise={ex}
                        participant={participant}
                        readOnlyAttempt={{ result: reviewing.results?.result, submitted: reviewing.responses?.submitted }}
                        onExit={() => setReviewing(null)} />
                    : <EmptyState message="This exercise is no longer in the content library." />}
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-6"><Spinner /></div>;

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Award className="w-4 h-4 text-slate-400" /> Online Exercises
                </h4>
                <button onClick={load} className="text-slate-400 hover:text-slate-700" title="Refresh">
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {attempts.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No exercise attempts recorded yet.</p>
            ) : (
                <div className="divide-y divide-slate-100">
                    {exercises.map(ex => {
                        const b = best[ex.id];
                        if (!b) return null;
                        const passed = b.percent >= (ex.passMark ?? 80);
                        const count = attempts.filter(a => a.exerciseId === ex.id).length;
                        return (
                            <div key={ex.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-slate-800 truncate">{ex.title}</p>
                                    <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{count} attempt{count > 1 ? 's' : ''}</span>
                                        <span>{Math.round((b.durationSeconds || 0) / 60)} min</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {b.percent}%
                                    </span>
                                    {passed ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
                                    <button onClick={() => setReviewing(b)} className="text-xs text-sky-600 hover:underline">Review</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// 5. EXERCISE MANAGER   (author and edit exercises inside the app)
// ============================================================================
//
// Exercises live in two places and are merged by loadAllExercises():
//   * the built-ins in exercises.js, shipped with the app
//   * documents in the exerciseDefinitions collection, authored here
// Saving an edit to a built-in writes a stored copy under the SAME id, which
// then overrides the built-in. "Reset to built-in" deletes the stored copy.
//
// Field lists per section so the editor can offer the right signs.
// Keys are the forms' own state field names.

const SECTION_FIELDS = {
    danger: [
        ['notAbleToDrink', 'bool'], ['vomitsEverything', 'bool'], ['historyOfConvulsions', 'bool'],
        ['lethargicUnconscious', 'bool'], ['convulsingNow', 'bool'],
    ],
    cough: [
        ['hasCough', 'bool'], ['coughDays', 'num'], ['breathRate', 'num'],
        ['fastBreathing', 'bool'], ['chestIndrawing', 'bool'], ['stridor', 'bool'], ['wheeze', 'bool'],
    ],
    diarrhea: [
        ['hasDiarrhea', 'bool'], ['diarrheaDays', 'num'], ['bloodInStool', 'bool'],
        ['lethargic', 'bool'], ['restlessIrritable', 'bool'], ['sunkenEyes', 'bool'],
        ['drinkPoorly', 'bool'], ['drinkEagerly', 'bool'], ['pinchVerySlow', 'bool'], ['pinchSlow', 'bool'],
    ],
    fever: [
        ['hasFever', 'bool'], ['feverDays', 'num'], ['neckStiffness', 'bool'], ['measlesRash', 'bool'],
    ],
    ear: [
        ['hasEarProblem', 'bool'], ['earPain', 'bool'], ['earDischarge', 'bool'], ['tenderSwelling', 'bool'],
    ],
    anemia: [['pallor', 'text']],
    malnutrition: [['edema', 'bool'], ['muacCm', 'num']],
    vaccine: [],
    other: [],
    feeding: [['feed_ageLess2', 'bool'], ['feedingStatus', 'text']],
};

// The young infant form has entirely different fields.
const INFANT_SECTION_FIELDS = {
    infection: [
        ['notFeedingWell', 'bool'], ['convulsions', 'bool'], ['convulsingNow', 'bool'],
        ['movementOnlyStimulatedNoMovement', 'bool'], ['breathRate', 'num'], ['fastBreathing', 'bool'],
        ['severeChestIndrawing', 'bool'], ['fever38', 'bool'], ['lowTemp35_5', 'bool'],
        ['umbilicusRedDraining', 'bool'], ['pusFromEyes', 'bool'], ['skinPustules', 'bool'],
    ],
    jaundice: [
        ['hasJaundice', 'yesno'], ['jaundiceFirst24h', 'bool'],
        ['jaundiceSolesPalms', 'bool'], ['jaundiceLowWeight', 'bool'],
    ],
    diarrhea: [
        ['hasDiarrhea', 'yesno'], ['diarrheaDays', 'num'], ['bloodInStool', 'bool'],
        ['diarrheaMovement', 'bool'], ['diarrheaRestless', 'bool'], ['diarrheaSunkenEyes', 'bool'],
        ['pinchVerySlow', 'bool'], ['pinchSlow', 'bool'],
    ],
    feeding: [
        ['diffFeeding', 'yesno'], ['breastfed', 'yesno'], ['breastfeedTimes', 'num'],
        ['otherFoods', 'yesno'], ['feedTool', 'text'], ['weightForAgeLow', 'bool'], ['thrush', 'bool'],
    ],
    breast: [['wellPositioned', 'yesno'], ['goodAttachment', 'yesno'], ['suckingEffectively', 'yesno']],
    vaccine: [['vaccineStatus', 'text'], ['nextVaccine', 'text']],
    other: [],
};

const PATIENT_FIELDS = [
    ['childName', 'text'], ['sex', 'text'], ['ageMonths', 'num'],
    ['weightKg', 'num'], ['lengthCm', 'num'], ['tempC', 'num'], ['visitType', 'text'],
];

const INFANT_PATIENT_FIELDS = [
    ['childName', 'text'], ['ageDaysWeeks', 'text'],
    ['weightKg', 'num'], ['tempC', 'num'], ['visitType', 'text'],
];

const INFANT_FIELD_LABELS = {
    ageDaysWeeks: 'Age (days or weeks)',
    notFeedingWell: 'Not feeding well', convulsions: 'Convulsions', convulsingNow: 'Convulsing now',
    movementOnlyStimulatedNoMovement: 'Moves only when stimulated, or no movement',
    severeChestIndrawing: 'Severe chest indrawing', fever38: 'Temperature 38 °C or more',
    lowTemp35_5: 'Temperature below 35.5 °C', umbilicusRedDraining: 'Red umbilicus or draining pus',
    pusFromEyes: 'Pus draining from the eyes', skinPustules: 'Skin pustules',
    hasJaundice: 'Has jaundice', jaundiceFirst24h: 'Jaundice started in the first 24 hours',
    jaundiceSolesPalms: 'Jaundice extends to palms or soles', jaundiceLowWeight: 'Jaundice with low weight',
    diarrheaMovement: 'Moves only when stimulated', diarrheaRestless: 'Restless or irritable',
    diarrheaSunkenEyes: 'Sunken eyes',
    diffFeeding: 'Any difficulty feeding', breastfed: 'Breastfed', breastfeedTimes: 'Breastfeeds per 24 hours',
    otherFoods: 'Takes other food or fluids', feedTool: 'What is used to feed the infant',
    weightForAgeLow: 'Low weight for age', thrush: 'Thrush',
    wellPositioned: 'Well positioned', goodAttachment: 'Good attachment', suckingEffectively: 'Sucking effectively',
    vaccineStatus: 'Immunisation status', nextVaccine: 'Next immunisation due',
};

// Which registry set applies, given the exercise being edited.
const editorRegistry = (formType) => formType === 'infant'
    ? {
        sections: INFANT_SECTIONS,
        labels: INFANT_SECTION_LABELS,
        fields: INFANT_SECTION_FIELDS,
        patient: INFANT_PATIENT_FIELDS,
        classify: INFANT_CLASSIFY_OPTIONS,
        treatment: INFANT_TREATMENT_OPTIONS,
        fieldLabel: (k) => INFANT_FIELD_LABELS[k] || FIELD_LABELS[k] || k,
    }
    : {
        sections: ALL_SECTIONS,
        labels: SECTION_LABELS,
        fields: SECTION_FIELDS,
        patient: PATIENT_FIELDS,
        classify: CLASSIFY_OPTIONS,
        treatment: TREATMENT_OPTIONS,
        fieldLabel: (k) => FIELD_LABELS[k] || k,
    };

const blankExercise = (kind = 'case', formType = 'child') => ({
    id: '',
    kind,
    formType,
    order: 90,
    title: '',
    titleAr: '',
    subCourse: ONLINE_SUB_COURSE,
    passMark: 80,
    estimatedMinutes: 15,
    draft: true,
    narrative: [''],
    explain: '',
    learningPoints: [],
    questions: kind === 'quiz' ? [] : undefined,
    expected: kind === 'quiz' ? {} : {
        sections: [formType === 'infant' ? 'infection' : 'danger'],
        patientData: {},
        assessments: {},
        classifications: {},
        includeTreatment: false,
        treatments: {},
    },
});

const blankQuestion = () => ({
    id: `q${Date.now().toString(36)}`,
    type: 'mcq',
    question: '',
    options: ['', ''],
    correct: [],
    explain: '',
});

function TriState({ value, onChange }) {
    const opts = [
        { v: undefined, label: 'Not graded' },
        { v: true, label: 'Present' },
        { v: false, label: 'Not present' },
    ];
    return (
        <div className="flex gap-1">
            {opts.map(o => (
                <button key={String(o.label)} type="button" onClick={() => onChange(o.v)}
                    className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                        value === o.v
                            ? (o.v === undefined ? 'bg-slate-500 text-white border-slate-500'
                                : o.v ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-600 text-white border-slate-600')
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function YesNoState({ value, onChange }) {
    const opts = [
        { v: undefined, label: 'Not graded' },
        { v: 'yes', label: 'Yes' },
        { v: 'no', label: 'No' },
    ];
    return (
        <div className="flex gap-1">
            {opts.map(o => (
                <button key={o.label} type="button" onClick={() => onChange(o.v)}
                    className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                        value === o.v
                            ? (o.v === undefined ? 'bg-slate-500 text-white border-slate-500' : 'bg-sky-600 text-white border-sky-600')
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// --------------------------------------------------------------------------- quiz question editor

function QuestionEditor({ q, index, total, onChange, onRemove, onMove }) {
    const setQ = (patch) => onChange({ ...q, ...patch });

    const setType = (type) => {
        if (type === 'mcq') setQ({ type, options: q.options?.length ? q.options : ['', ''], correct: [] });
        else if (type === 'tf') setQ({ type, correct: true, options: undefined });
        else setQ({ type, correct: '', accept: [], options: undefined });
    };

    const toggleCorrect = (i) => {
        const cur = Array.isArray(q.correct) ? q.correct : [];
        setQ({ correct: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] });
    };

    return (
        <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold text-slate-400 mt-2">Q{index + 1}</span>
                <div className="flex-1 space-y-2">
                    <textarea rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={q.question} onChange={e => setQ({ question: e.target.value })}
                        placeholder="Question text" />
                    <div className="flex flex-wrap gap-2">
                        {[['mcq', 'Multiple choice'], ['tf', 'True / False'], ['text', 'Short answer']].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => setType(v)}
                                className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                                    q.type === v ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)}
                        className="text-xs px-2 py-1 border border-slate-200 rounded disabled:opacity-30">↑</button>
                    <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)}
                        className="text-xs px-2 py-1 border border-slate-200 rounded disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => onRemove(index)}
                        className="text-xs px-2 py-1 border border-rose-200 text-rose-600 rounded">✕</button>
                </div>
            </div>

            {q.type === 'mcq' && (
                <div className="space-y-1.5 pl-8">
                    <p className="text-xs text-slate-500">Tick every correct option. Ticking more than one makes it multi-select for the learner.</p>
                    {(q.options || []).map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <input type="checkbox" className="rounded w-4 h-4 flex-shrink-0"
                                checked={(q.correct || []).includes(i)} onChange={() => toggleCorrect(i)} />
                            <input className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                value={opt}
                                onChange={e => {
                                    const opts = [...q.options]; opts[i] = e.target.value; setQ({ options: opts });
                                }}
                                placeholder={`Option ${String.fromCharCode(97 + i)}`} />
                            <button type="button"
                                onClick={() => setQ({
                                    options: q.options.filter((_, j) => j !== i),
                                    correct: (q.correct || []).filter(c => c !== i).map(c => (c > i ? c - 1 : c)),
                                })}
                                className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-500">✕</button>
                        </div>
                    ))}
                    <Button variant="secondary" onClick={() => setQ({ options: [...(q.options || []), ''] })}>Add option</Button>
                </div>
            )}

            {q.type === 'tf' && (
                <div className="pl-8 flex gap-2 items-center">
                    <span className="text-xs text-slate-500">Correct answer:</span>
                    {[{ v: true, l: 'True' }, { v: false, l: 'False' }].map(o => (
                        <button key={o.l} type="button" onClick={() => setQ({ correct: o.v })}
                            className={`px-3 py-1 rounded-md text-xs border ${q.correct === o.v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                            {o.l}
                        </button>
                    ))}
                </div>
            )}

            {q.type === 'text' && (
                <div className="pl-8 grid sm:grid-cols-2 gap-2">
                    <FormGroup label="Correct answer">
                        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={q.correct || ''} onChange={e => setQ({ correct: e.target.value })} />
                    </FormGroup>
                    <FormGroup label="Also accept (comma separated)">
                        <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            value={(q.accept || []).join(', ')}
                            onChange={e => setQ({ accept: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
                            placeholder="7 days, seven" />
                    </FormGroup>
                </div>
            )}

            <div className="pl-8">
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={q.explain || ''} onChange={e => setQ({ explain: e.target.value })}
                    placeholder="Explanation shown after checking (optional)" />
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------- main editor

export function ExerciseEditor({ initial, onSaved, onCancel, isBuiltIn = false }) {
    const { t } = useTranslation();
    const [ex, setEx] = useState(() => {
        const base = initial ? JSON.parse(JSON.stringify(initial)) : blankExercise();
        base.kind = base.kind || 'case';
        base.formType = base.formType || 'child';
        if (base.kind === 'quiz') base.questions = base.questions || [];
        else base.expected = base.expected || blankExercise().expected;
        return base;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const reg = editorRegistry(ex.formType);
    const isQuiz = ex.kind === 'quiz';

    const setField = (k, v) => setEx(p => ({ ...p, [k]: v }));
    const setExpected = (k, v) => setEx(p => ({ ...p, expected: { ...p.expected, [k]: v } }));

    const sections = ex.expected?.sections || [];
    const toggleSection = (sec) => {
        const next = sections.includes(sec)
            ? sections.filter(s => s !== sec)
            : reg.sections.filter(s => sections.includes(s) || s === sec);
        setExpected('sections', next);
    };

    const optLabel = (o) => (String(o.id).startsWith('imci.') ? t(o.id) : (o.label || o.id));

    const toggleAnswer = (bucket, sec, id) => {
        const cur = ex.expected[bucket]?.[sec] || [];
        const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
        setExpected(bucket, { ...(ex.expected[bucket] || {}), [sec]: next });
    };

    // Switching kind or form type resets the parts that no longer apply, rather
    // than leaving orphaned child sections on an infant exercise.
    const switchKind = (kind, formType = ex.formType) => {
        if (kind === ex.kind && formType === ex.formType) return;
        setEx(p => ({
            ...blankExercise(kind, formType),
            id: p.id, order: p.order, title: p.title, titleAr: p.titleAr,
            passMark: p.passMark, estimatedMinutes: p.estimatedMinutes,
            draft: p.draft, narrative: p.narrative, explain: p.explain,
            learningPoints: p.learningPoints,
        }));
    };

    const setQuestion = (i, q) => setEx(p => ({ ...p, questions: p.questions.map((x, j) => (j === i ? q : x)) }));
    const removeQuestion = (i) => setEx(p => ({ ...p, questions: p.questions.filter((_, j) => j !== i) }));
    const moveQuestion = (i, d) => setEx(p => {
        const qs = [...p.questions];
        const [item] = qs.splice(i, 1);
        qs.splice(i + d, 0, item);
        return { ...p, questions: qs };
    });

    const save = async () => {
        setError('');
        if (!ex.id.trim()) return setError('An id is required. Use something stable like imnci-ex8-fatima.');
        if (!/^[a-zA-Z0-9_-]+$/.test(ex.id)) return setError('The id may only contain letters, numbers, hyphens and underscores.');
        if (!ex.title.trim()) return setError('A title is required.');

        if (isQuiz) {
            if (!ex.questions.length) return setError('Add at least one question.');
            for (let i = 0; i < ex.questions.length; i++) {
                const q = ex.questions[i];
                if (!q.question.trim()) return setError(`Question ${i + 1} has no text.`);
                if (q.type === 'mcq') {
                    if ((q.options || []).some(o => !o.trim())) return setError(`Question ${i + 1} has an empty option.`);
                    if (!(q.correct || []).length) return setError(`Question ${i + 1} has no correct option ticked.`);
                }
                if (q.type === 'text' && !String(q.correct || '').trim()) return setError(`Question ${i + 1} has no correct answer.`);
            }
        } else if (sections.length === 0) {
            return setError('Select at least one section.');
        }

        setSaving(true);
        try {
            // `isCustom` is added at load time by loadAllExercises; it is not
            // part of the stored document and must not be persisted.
            const { isCustom, ...clean } = ex;
            await upsertExerciseDefinition({
                ...clean,
                narrative: (ex.narrative || []).filter(l => l.trim() !== ''),
                learningPoints: (ex.learningPoints || []).filter(l => String(l).trim() !== ''),
            });
            onSaved?.();
        } catch (e) {
            setError(e.message || 'Could not save.');
        } finally {
            setSaving(false);
        }
    };

    const Actions = () => (
        <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Spinner size="sm" /> : 'Save exercise'}</Button>
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-bold text-slate-900">
                    {initial ? 'Edit exercise' : 'New exercise'}
                    {isBuiltIn && <span className="ml-2 text-xs font-normal text-amber-600">editing a built-in — saving creates an override</span>}
                </h3>
                <Actions />
            </div>

            {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{error}</p>}

            {/* kind */}
            <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Exercise type</p>
                <div className="flex flex-wrap gap-2">
                    {[
                        { kind: 'case', formType: 'child',  label: 'Case — sick child form (2 months–5 years)' },
                        { kind: 'case', formType: 'infant', label: 'Case — young infant form (up to 2 months)' },
                        { kind: 'quiz', formType: 'child',  label: 'Quiz — questions only' },
                    ].map(o => {
                        const on = ex.kind === o.kind && (o.kind === 'quiz' || ex.formType === o.formType);
                        return (
                            <button key={o.label} type="button" onClick={() => switchKind(o.kind, o.formType)}
                                className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                                    on ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
                {initial && <p className="text-xs text-amber-600 mt-2">Changing the type clears the answers below — the two formats share nothing.</p>}
            </div>

            {/* basics */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <FormGroup label="Id (never change once attempted)">
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.id} disabled={!!initial}
                        onChange={e => setField('id', e.target.value.trim())} placeholder="imnci-ex8-fatima" />
                </FormGroup>
                <FormGroup label="Order">
                    <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.order} onChange={e => setField('order', Number(e.target.value))} />
                </FormGroup>
                <FormGroup label="Estimated minutes">
                    <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.estimatedMinutes} onChange={e => setField('estimatedMinutes', Number(e.target.value))} />
                </FormGroup>
                <FormGroup label="Title">
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.title} onChange={e => setField('title', e.target.value)} />
                </FormGroup>
                <FormGroup label="Title (Arabic)">
                    <input dir="rtl" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.titleAr} onChange={e => setField('titleAr', e.target.value)} />
                </FormGroup>
                <FormGroup label="Pass mark (%)">
                    <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={ex.passMark} onChange={e => setField('passMark', Number(e.target.value))} />
                </FormGroup>
            </div>

            <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded w-4 h-4" checked={!!ex.draft}
                        onChange={e => setField('draft', e.target.checked)} />
                    Draft — facilitators see it, participants do not
                </label>
                {!isQuiz && (
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded w-4 h-4" checked={!!ex.expected.includeTreatment}
                            onChange={e => setExpected('includeTreatment', e.target.checked)} />
                        Include the treatment column
                    </label>
                )}
            </div>

            {/* narrative */}
            <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                    {isQuiz ? 'Instructions — one bullet per line' : 'Case scenario — one bullet per line'}
                </p>
                <textarea rows={6} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={(ex.narrative || []).join('\n')}
                    onChange={e => setField('narrative', e.target.value.split('\n'))} />
            </div>

            {/* ---------------- QUIZ ---------------- */}
            {isQuiz && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Questions ({ex.questions.length})</p>
                        <Button variant="secondary" onClick={() => setEx(p => ({ ...p, questions: [...p.questions, blankQuestion()] }))}>
                            Add question
                        </Button>
                    </div>
                    {ex.questions.length === 0 && (
                        <p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-6 text-center">
                            No questions yet.
                        </p>
                    )}
                    {ex.questions.map((q, i) => (
                        <QuestionEditor key={q.id} q={q} index={i} total={ex.questions.length}
                            onChange={(nq) => setQuestion(i, nq)} onRemove={removeQuestion} onMove={moveQuestion} />
                    ))}
                </div>
            )}

            {/* ---------------- CASE ---------------- */}
            {!isQuiz && (
                <>
                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Sections shown on the form</p>
                        <p className="text-xs text-slate-500 mb-2">
                            The form ends after the last one selected.
                            {ex.formType === 'child' && ' Include "Mother card — assess feeding" only when the case needs it.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {reg.sections.map(sec => (
                                <button key={sec} type="button" onClick={() => toggleSection(sec)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                        sections.includes(sec) ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                                    {reg.labels[sec] || sec}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                            {ex.formType === 'infant' ? 'Infant details' : 'Child details'} (leave blank to skip grading a field)
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {reg.patient.map(([key, kind]) => (
                                <FormGroup key={key} label={reg.fieldLabel(key)}>
                                    <input type={kind === 'num' ? 'number' : 'text'} step="any"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        value={ex.expected.patientData?.[key] ?? ''}
                                        onChange={e => {
                                            const v = e.target.value;
                                            const pd = { ...(ex.expected.patientData || {}) };
                                            if (v === '') delete pd[key]; else pd[key] = kind === 'num' ? Number(v) : v;
                                            setExpected('patientData', pd);
                                        }} />
                                </FormGroup>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {ex.formType === 'infant'
                                ? <>Age is free text, e.g. <code>5 weeks</code>. Visit type: <code>initial</code> / <code>followup</code>.</>
                                : <>Sex: <code>male</code> / <code>female</code>. Visit type: <code>initial</code> / <code>followup</code>.</>}
                        </p>
                    </div>

                    {sections.map(sec => (
                        <div key={sec} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2.5 font-semibold text-sm text-slate-800">
                                {reg.labels[sec] || sec}
                            </div>
                            <div className="p-4 space-y-4">
                                {(reg.fields[sec] || []).length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signs</p>
                                        <div className="space-y-1.5">
                                            {(reg.fields[sec] || []).map(([key, kind]) => (
                                                <div key={key} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded px-3 py-2">
                                                    <span className="text-sm text-slate-700">{reg.fieldLabel(key)}</span>
                                                    {kind === 'bool' ? (
                                                        <TriState value={ex.expected.assessments?.[key]}
                                                            onChange={v => {
                                                                const a = { ...(ex.expected.assessments || {}) };
                                                                if (v === undefined) delete a[key]; else a[key] = v;
                                                                setExpected('assessments', a);
                                                            }} />
                                                    ) : kind === 'yesno' ? (
                                                        <YesNoState value={ex.expected.assessments?.[key]}
                                                            onChange={v => {
                                                                const a = { ...(ex.expected.assessments || {}) };
                                                                if (v === undefined) delete a[key]; else a[key] = v;
                                                                setExpected('assessments', a);
                                                            }} />
                                                    ) : (
                                                        <input type={kind === 'num' ? 'number' : 'text'} step="any"
                                                            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
                                                            value={ex.expected.assessments?.[key] ?? ''}
                                                            onChange={e => {
                                                                const v = e.target.value;
                                                                const a = { ...(ex.expected.assessments || {}) };
                                                                if (v === '') delete a[key]; else a[key] = kind === 'num' ? Number(v) : v;
                                                                setExpected('assessments', a);
                                                            }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Correct classification</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(reg.classify[sec] || []).map(o => {
                                            const on = (ex.expected.classifications?.[sec] || []).includes(o.id);
                                            return (
                                                <button key={o.id} type="button" onClick={() => toggleAnswer('classifications', sec, o.id)}
                                                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                                                    {optLabel(o)}
                                                </button>
                                            );
                                        })}
                                        {(reg.classify[sec] || []).length === 0 && (
                                            <span className="text-xs text-slate-400 italic">No classification bank for this section.</span>
                                        )}
                                    </div>
                                </div>

                                {ex.expected.includeTreatment && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Correct treatment</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(reg.treatment[sec] || []).map(o => {
                                                const on = (ex.expected.treatments?.[sec] || []).includes(o.id);
                                                return (
                                                    <button key={o.id} type="button" onClick={() => toggleAnswer('treatments', sec, o.id)}
                                                        className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${on ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                                                        {optLabel(o)}
                                                    </button>
                                                );
                                            })}
                                            {(reg.treatment[sec] || []).length === 0 && (
                                                <span className="text-xs text-slate-400 italic">No treatment bank for this section.</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Select nothing to require that the learner ticks nothing here.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </>
            )}

            <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Explanation shown after checking</p>
                <textarea rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={ex.explain || ''} onChange={e => setField('explain', e.target.value)} />
            </div>

            <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Learning points</p>
                <p className="text-xs text-slate-500 mb-2">
                    One per line. These appear as a numbered list at the foot of the form after the
                    learner submits. Leave empty to fall back to the explanation above.
                </p>
                <textarea rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder={'Blood in the stool is DYSENTERY, whatever the hydration state.\nDiarrhoea under 14 days is not persistent diarrhoea.'}
                    value={(ex.learningPoints || []).join('\n')}
                    onChange={e => setField('learningPoints', e.target.value.split('\n'))} />
            </div>

            <div className="flex justify-end border-t pt-4"><Actions /></div>
        </div>
    );
}

export function ExerciseManagerView({ subCourse = ONLINE_SUB_COURSE }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);   // exercise object
    const [creating, setCreating] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        clearExerciseCache();
        try { setList(await loadAllExercises(subCourse, { includeDrafts: true, force: true })); }
        catch (e) { setToast({ show: true, message: e.message, type: 'error' }); }
        finally { setLoading(false); }
    }, [subCourse]);

    useEffect(() => { load(); }, [load]);

    // `isCustom` is a runtime marker from loadAllExercises, not part of the
    // document — it must never be written back to Firestore.
    const persist = (ex, patch) => {
        const { isCustom, ...clean } = ex;
        return upsertExerciseDefinition({ ...clean, ...patch });
    };

    // Publishing a built-in writes a stored override carrying draft:false.
    // That is the same mechanism as editing one, so "Reset to built-in" still
    // undoes it.
    const setDraft = async (ex, draft) => {
        setBusy(true);
        try {
            await persist(ex, { draft });
            setToast({ show: true, message: draft ? `“${ex.title}” is now a draft.` : `“${ex.title}” is published.`, type: 'success' });
            await load();
        } catch (e) {
            setToast({ show: true, message: e.message, type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const draftCount = list.filter(e => e.draft).length;

    const publishAll = async () => {
        const drafts = list.filter(e => e.draft);
        if (!drafts.length) return;
        setBusy(true);
        try {
            for (const ex of drafts) await persist(ex, { draft: false });
            setToast({ show: true, message: `Published ${drafts.length} exercise${drafts.length === 1 ? '' : 's'}.`, type: 'success' });
            await load();
        } catch (e) {
            setToast({ show: true, message: e.message, type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const resetToBuiltIn = async (ex) => {
        setBusy(true);
        try {
            await deleteExerciseDefinition(ex.id);
            setToast({ show: true, message: 'Stored copy removed.', type: 'success' });
            await load();
        } catch (e) {
            setToast({ show: true, message: e.message, type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    if (creating || editing) {
        return (
            <ExerciseEditor
                initial={editing}
                isBuiltIn={!!editing && !editing.isCustom}
                onCancel={() => { setEditing(null); setCreating(false); }}
                onSaved={async () => {
                    setEditing(null); setCreating(false);
                    setToast({ show: true, message: 'Exercise saved.', type: 'success' });
                    await load();
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            {toast.show && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ show: false })} />}

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="font-bold text-slate-900">Manage Exercises</h3>
                    <p className="text-xs text-slate-500">
                        Built-in exercises ship with the app. Editing one stores an override under the same id.
                    </p>
                    {draftCount > 0 && (
                        <p className="text-xs text-amber-600 font-medium mt-1">
                            {draftCount} of {list.length} {draftCount === 1 ? 'is a draft' : 'are drafts'} — participants cannot see {draftCount === 1 ? 'it' : 'them'}.
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={load} disabled={busy}><RefreshCw className="w-4 h-4" /> Refresh</Button>
                    {draftCount > 0 && (
                        <Button variant="secondary" onClick={publishAll} disabled={busy}>
                            Publish all ({draftCount})
                        </Button>
                    )}
                    <Button onClick={() => setCreating(true)} disabled={busy}>New exercise</Button>
                </div>
            </div>

            {loading ? <div className="flex justify-center p-8"><Spinner /></div>
                : list.length === 0 ? <EmptyState message="No exercises yet." />
                : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {list.map(ex => (
                            <div key={ex.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-sm text-slate-800">{ex.title}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                        <code>{ex.id}</code>
                                        <span>order {ex.order}</span>
                                        {ex.kind === 'quiz'
                                            ? <span className="text-purple-600 font-semibold">QUIZ · {(ex.questions || []).length} questions</span>
                                            : <span>{(ex.expected?.sections || []).length} sections{ex.formType === 'infant' ? ' · young infant form' : ''}</span>}
                                        {ex.expected?.includeTreatment && <span className="text-sky-600">+ treatment</span>}
                                        {ex.draft
                                            ? <span className="text-amber-600 font-semibold">DRAFT</span>
                                            : <span className="text-emerald-600 font-semibold">PUBLISHED</span>}
                                        {ex.isCustom
                                            ? <span className="text-indigo-600 font-semibold">STORED</span>
                                            : <span className="text-slate-400">built-in</span>}
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button variant={ex.draft ? undefined : 'secondary'} disabled={busy}
                                        onClick={() => setDraft(ex, !ex.draft)}>
                                        {ex.draft ? 'Publish' : 'Unpublish'}
                                    </Button>
                                    <Button variant="secondary" disabled={busy} onClick={() => setEditing(ex)}>Edit</Button>
                                    {ex.isCustom && (
                                        <Button variant="secondary" disabled={busy} onClick={() => resetToBuiltIn(ex)}>
                                            {EXERCISES.some(b => b.id === ex.id) ? 'Reset to built-in' : 'Delete'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}

// ============================================================================
// 6. LIVE DASHBOARD   (real-time results for group discussion)
// ============================================================================
//
// One Firestore listener on the whole course, kept open while the tab is on
// screen. Built for projecting during a session: the facilitator sees answers
// land as participants submit, and can open any question to see how the group
// split — which is the thing worth discussing.
//
// The listener is the one place we deliberately do NOT cache: stale numbers
// during a live discussion are worse than no numbers.

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

function StatTile({ label, value, sub, tone = 'slate' }) {
    const tones = {
        slate: 'text-slate-800', emerald: 'text-emerald-600',
        amber: 'text-amber-600', sky: 'text-sky-600',
    };
    return (
        <div className="border border-slate-200 rounded-lg p-4 bg-white">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
    );
}

function Bar({ label, count, total, tone = 'sky', highlight = false }) {
    const p = pct(count, total);
    const tones = { sky: 'bg-sky-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', slate: 'bg-slate-400' };
    return (
        <div className={`${highlight ? 'ring-1 ring-emerald-400 rounded-md p-1.5 -m-1.5' : ''}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-sm text-slate-700 flex items-center gap-1.5">
                    {highlight && <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                    {label}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">{count} · {p}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${tones[tone]} transition-all duration-500`} style={{ width: `${p}%` }} />
            </div>
        </div>
    );
}

/**
 * @param {object} course
 * @param {array}  participants  the roster, so we can show who has not started
 */
export function LiveExerciseDashboard({ course, participants = [], subCourse = ONLINE_SUB_COURSE }) {
    const { t } = useTranslation();
    const [attempts, setAttempts] = useState([]);
    const [exercises, setExercises] = useState([]);
    const [live, setLive] = useState(false);
    const [error, setError] = useState('');
    const [focusId, setFocusId] = useState('');     // exercise being discussed
    const [lastUpdate, setLastUpdate] = useState(null);

    useEffect(() => {
        loadAllExercises(subCourse, { includeDrafts: true }).then(setExercises).catch(() => {});
    }, [subCourse]);

    useEffect(() => {
        if (!course?.id) return;
        const unsub = subscribeExerciseAttempts(
            course.id,
            (rows, meta) => {
                setAttempts(rows);
                setLive(!meta.fromCache);
                setLastUpdate(new Date());
            },
            (e) => setError(e.message || 'Live updates unavailable.')
        );
        // Always detach: an open listener keeps reading in the background.
        return () => unsub();
    }, [course?.id]);

    const focus = exercises.find(e => e.id === focusId) || null;

    // ---- whole-course roll-up -------------------------------------------------
    const overall = useMemo(() => {
        const byParticipant = {};
        attempts.forEach(a => {
            const cur = byParticipant[a.participantId];
            const key = `${a.participantId}:${a.exerciseId}`;
            byParticipant[a.participantId] = byParticipant[a.participantId] || { name: a.participantName, best: {} };
            const b = byParticipant[a.participantId].best;
            if (b[a.exerciseId] == null || a.percent > b[a.exerciseId]) b[a.exerciseId] = a.percent;
        });
        const people = Object.values(byParticipant);
        const scores = people.flatMap(p => Object.values(p.best));
        const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
        return {
            started: people.length,
            notStarted: Math.max(0, participants.length - people.length),
            submissions: attempts.length,
            avg,
        };
    }, [attempts, participants.length]);

    // ---- per-exercise roll-up -------------------------------------------------
    const perExercise = useMemo(() => exercises.map(ex => {
        const rows = attempts.filter(a => a.exerciseId === ex.id);
        const best = {};
        rows.forEach(a => { if (best[a.participantId] == null || a.percent > best[a.participantId]) best[a.participantId] = a.percent; });
        const vals = Object.values(best);
        const passMark = ex.passMark ?? 80;
        return {
            ex,
            attempts: rows.length,
            participants: vals.length,
            avg: vals.length ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : 0,
            passed: vals.filter(v => v >= passMark).length,
        };
    }).filter(r => r.attempts > 0), [exercises, attempts]);

    // ---- breakdown for the exercise being discussed ---------------------------
    const breakdown = useMemo(() => {
        if (!focus) return null;
        const rows = attempts.filter(a => a.exerciseId === focus.id);
        if (rows.length === 0) return { rows: [], items: [] };

        if (focus.kind === 'quiz') {
            const items = (focus.questions || []).map(q => {
                const counts = {};
                let answered = 0;
                rows.forEach(a => {
                    const given = a.responses?.submitted?.answers?.[q.id];
                    if (given === undefined) return;
                    answered += 1;
                    const keys = q.type === 'mcq'
                        ? (Array.isArray(given) ? given : [given]).map(i => String(i))
                        : [String(given)];
                    keys.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
                });
                const correctCount = rows.filter(a => a.results?.result?.detail?.[q.id]?.ok).length;
                const options = q.type === 'mcq'
                    ? q.options.map((label, i) => ({ key: String(i), label, correct: (q.correct || []).includes(i) }))
                    : q.type === 'tf'
                        ? [{ key: 'true', label: 'True', correct: q.correct === true }, { key: 'false', label: 'False', correct: q.correct === false }]
                        : Object.keys(counts).map(k => ({ key: k, label: k || '(blank)', correct: String(q.correct).toLowerCase() === k.toLowerCase() }));
                return {
                    id: q.id, title: q.question, explain: q.explain,
                    answered, correctCount, options, counts,
                };
            });
            return { rows, items };
        }

        // Case exercise: how did the group classify each section?
        const sections = focus.expected?.sections || [];
        const items = sections
            .filter(sec => (focus.expected.classifications?.[sec] || []).length > 0)
            .map(sec => {
                const counts = {};
                let answered = 0;
                rows.forEach(a => {
                    const chosen = a.responses?.submitted?.chosenClassifications?.[sec];
                    if (!chosen) return;
                    answered += 1;
                    const key = [...chosen].sort().join(' + ') || '(nothing)';
                    counts[key] = (counts[key] || 0) + 1;
                });
                const correctCount = rows.filter(a => a.results?.result?.detail?.classifications?.[sec]?.ok).length;
                const bank = focus.expected.classifyOptions?.[sec] || [];
                const labelOf = (combo) => combo.split(' + ').map(id => {
                    const o = bank.find(x => x.id === id);
                    return o ? (String(o.id).startsWith('imci.') ? t(o.id) : (o.label || o.id)) : id;
                }).join(' + ');
                const correctKey = [...(focus.expected.classifications[sec] || [])].sort().join(' + ');
                const options = Object.keys(counts).map(k => ({ key: k, label: labelOf(k), correct: k === correctKey }));
                if (!options.some(o => o.correct)) options.push({ key: correctKey, label: labelOf(correctKey), correct: true });
                return {
                    id: sec,
                    title: (focus.formType === 'infant' ? INFANT_SECTION_LABELS : SECTION_LABELS)[sec] || sec,
                    answered, correctCount, options, counts,
                };
            });

        // Which signs did the group get wrong most often?
        const signMisses = {};
        rows.forEach(a => {
            const d = a.results?.result?.detail?.assessments || {};
            Object.entries(d).forEach(([k, v]) => { if (!v.ok) signMisses[k] = (signMisses[k] || 0) + 1; });
        });
        const missed = Object.entries(signMisses)
            .sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([k, n]) => ({ field: k, count: n }));

        return { rows, items, missed };
    }, [focus, attempts, t]);

    if (!course) return <EmptyState message="Select a course first." />;

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        Live Results
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {live ? 'Live' : 'Cached'}
                        </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                        Updates as participants submit — project this during the discussion.
                        {lastUpdate && ` Last change ${lastUpdate.toLocaleTimeString()}.`}
                    </p>
                </div>
            </div>

            {error && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">{error}</p>}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Participants started" value={overall.started}
                    sub={participants.length ? `of ${participants.length} on the roster` : null} tone="sky" />
                <StatTile label="Not started" value={overall.notStarted} tone="amber" />
                <StatTile label="Submissions" value={overall.submissions} tone="slate" />
                <StatTile label="Average score" value={`${overall.avg}%`} tone={overall.avg >= 80 ? 'emerald' : 'amber'} />
            </div>

            {/* per exercise */}
            <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">By exercise — tap one to discuss it</p>
                {perExercise.length === 0 ? (
                    <EmptyState message="No submissions yet. This updates the moment someone presses Save." />
                ) : perExercise.map(({ ex, attempts: n, participants: np, avg, passed }) => (
                    <button key={ex.id} onClick={() => setFocusId(focusId === ex.id ? '' : ex.id)}
                        className={`w-full text-left border rounded-lg p-3 transition-colors ${focusId === ex.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{ex.title}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {np} participant{np === 1 ? '' : 's'} · {n} submission{n === 1 ? '' : 's'} · {passed} passed
                                </p>
                            </div>
                            <span className={`text-lg font-bold flex-shrink-0 ${avg >= (ex.passMark ?? 80) ? 'text-emerald-600' : 'text-amber-600'}`}>{avg}%</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* discussion panel */}
            {focus && breakdown && (
                <div className="border-2 border-sky-200 rounded-xl overflow-hidden">
                    <div className="bg-sky-700 text-white px-5 py-3">
                        <p className="font-bold">{focus.title}</p>
                        <p className="text-xs opacity-90">
                            {breakdown.rows.length} submission{breakdown.rows.length === 1 ? '' : 's'} · the green bar is the correct answer
                        </p>
                    </div>

                    <div className="p-5 space-y-6 bg-white">
                        {breakdown.items.length === 0 && (
                            <p className="text-sm text-slate-500">Nothing to break down for this exercise yet.</p>
                        )}

                        {breakdown.items.map(item => (
                            <div key={item.id}>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <p className="text-sm font-semibold text-slate-800 whitespace-pre-line">{item.title}</p>
                                    <span className={`text-xs font-semibold flex-shrink-0 ${
                                        pct(item.correctCount, breakdown.rows.length) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {item.correctCount}/{breakdown.rows.length} correct
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {item.options.map(o => (
                                        <Bar key={o.key} label={o.label} count={item.counts[o.key] || 0}
                                            total={item.answered || breakdown.rows.length}
                                            tone={o.correct ? 'emerald' : 'slate'} highlight={o.correct} />
                                    ))}
                                </div>
                                {item.explain && (
                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 border border-slate-200 rounded p-2 leading-relaxed">
                                        {item.explain}
                                    </p>
                                )}
                            </div>
                        ))}

                        {breakdown.missed?.length > 0 && (
                            <div className="border-t pt-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Signs most often recorded wrongly
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {breakdown.missed.map(m => (
                                        <span key={m.field} className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                            {FIELD_LABELS[m.field] || m.field} · {m.count}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    These are the assessment entries to walk through with the group.
                                </p>
                            </div>
                        )}

                        {/* who has submitted */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Submissions</p>
                            <div className="flex flex-wrap gap-1.5">
                                {breakdown.rows.map(a => (
                                    <span key={a.id}
                                        className={`text-xs px-2.5 py-1 rounded-full border ${
                                            a.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                        {a.participantName || 'Participant'} · {a.percent}%
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
