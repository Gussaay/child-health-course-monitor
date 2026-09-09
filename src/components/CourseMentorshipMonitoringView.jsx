// CourseMentorshipMonitoringView.jsx
//
// The course "Mentorship Practice" tab.
//
// Before this file, the tab re-implemented a cut-down IMNCI/EENC form from the
// shared renderers. Participants therefore practised on a form that was not the
// one they would use in the field, and only two of the six trainings were
// available at all.
//
// This version opens the *same* components the full mentorship view opens —
// SkillsAssessmentForm, EENCSkillsAssessmentForm, ETATSkillsAssessmentForm,
// HandwashingAssessmentForm, IPCAssessmentForm, AMSAssessmentForm, the two
// mothers interviews and the two visit reports — so what a participant fills in
// during a course is byte-for-byte the field form.
//
// The one thing that changes is where the result goes. Every form takes an
// `onSaveOverride` prop; when it is supplied the form saves through that
// instead of `saveMentorshipSession`. Here it is always supplied, so a practice
// session becomes a **course record** (a case + observations against the course
// and participant) and never lands in the shared mentorship-sessions
// collection. Course reports pick it up; facility mentorship dashboards do not
// see it, which is correct — nobody was mentored at a real facility.

import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
    Card, PageHeader, Button, FormGroup, Input, Select, EmptyState, Spinner, Modal,
} from './CommonComponents';
import {
    getMentorshipSubType, getCourseMentorshipService,
    getScenariosForService, getServiceScenarioById, checkEtatScenario,
    compareMentorToStandard,
} from './constants.js';
import {
    listObservationsForParticipant,
    listCasesForParticipant,
    upsertCaseAndObservations,
    deleteCaseAndObservations,
} from '../data.js';

// The field forms, imported exactly as SkillsMentorshipView imports them. They
// are lazy-loaded because the course tab is itself lazy-loaded and most courses
// only ever open one of them.
const SkillsAssessmentForm = lazy(() => import('./mentorship/SkillsAssessmentForm'));
const EENCSkillsAssessmentForm = lazy(() => import('./mentorship/EENCSkillsAssessmentForm'));
const ETATSkillsAssessmentForm = lazy(() => import('./mentorship/ETATSkillsAssessmentForm'));
const HandwashingAssessmentForm = lazy(() => import('./mentorship/HandwashingAssessmentForm'));
const IPCAssessmentForm = lazy(() => import('./mentorship/IPCAssessmentForm'));
const AMSAssessmentForm = lazy(() => import('./mentorship/AMSAssessmentForm'));
const IMNCIMothersForm = lazy(() => import('./mentorship/IMNCIMothersForm'));
const EENCMothersForm = lazy(() => import('./mentorship/EENCMothersForm'));
const IMNCIVisitReport = lazy(() =>
    import('./mentorship/VisitReports.jsx').then(m => ({ default: m.IMNCIVisitReport })));
const EENCVisitReport = lazy(() =>
    import('./mentorship/VisitReports.jsx').then(m => ({ default: m.EENCVisitReport })));

// ---------------------------------------------------------------------------
// Catalogue: which trainings exist, and which forms each one owns
// ---------------------------------------------------------------------------

// Keyed by the `serviceType` each form already writes into its own payload, so
// a practice record and a field record describe themselves the same way.
export const PRACTICE_FORMS = {
    skills_assessment: {
        recordType: 'SKILLS',
        title: 'Skills assessment',
        ageGroup: 'MENTORSHIP',
        needsWorker: true,
    },
    mothers_form: {
        recordType: 'MOTHERS',
        title: 'Mothers interview',
        ageGroup: 'MENTORSHIP_MOTHERS',
        needsWorker: false,
    },
    visit_report: {
        recordType: 'VISIT',
        title: 'Visit report',
        ageGroup: 'MENTORSHIP_VISIT',
        needsWorker: false,
    },
    handwashing: {
        recordType: 'HANDWASHING',
        title: 'Hand hygiene observation',
        ageGroup: 'MENTORSHIP_IPC',
        needsWorker: true,
    },
    ipc_facility_assessment: {
        recordType: 'IPC_FACILITY',
        title: 'IPC facility assessment',
        ageGroup: 'MENTORSHIP_IPC',
        needsWorker: false,
        // This form does not read `existingSessionData` — it has no rehydrate
        // path, in this tab or in the facility mentorship view. Reopening a
        // saved one would therefore show a blank form and the first autosave
        // would overwrite the completed record, so a saved IPC assessment is
        // read-only and a correction is recorded as a new session.
        canReopen: false,
    },
    ams_assessment: {
        recordType: 'AMS',
        title: 'Antimicrobial stewardship',
        ageGroup: 'MENTORSHIP_IPC',
        needsWorker: false,
    },
};

export const PRACTICE_SERVICES = {
    IMNCI: {
        label: 'IMNCI',
        subtitle: 'Integrated management of newborn and childhood illness',
        forms: [
            { key: 'skills_assessment', desc: 'Observe a participant managing a sick child, case by case.' },
            { key: 'mothers_form', desc: 'Interview a mother about the care her child received.' },
            { key: 'visit_report', desc: 'Complete a full IMNCI supervision visit report.' },
        ],
    },
    EENC: {
        label: 'EENC',
        subtitle: 'Early essential newborn care',
        forms: [
            { key: 'skills_assessment', desc: 'Observe a delivery, including resuscitation when it happens.' },
            { key: 'mothers_form', desc: 'Interview a mother about the first hours after birth.' },
            { key: 'visit_report', desc: 'Complete a full EENC supervision visit report.' },
        ],
    },
    ETAT: {
        label: 'ETAT',
        subtitle: 'Emergency triage, assessment and treatment',
        forms: [
            { key: 'skills_assessment', desc: 'Score the triage and emergency treatment checklists.' },
        ],
    },
    IPC: {
        label: 'IPC / AMS',
        subtitle: 'Infection prevention, control and antimicrobial stewardship',
        forms: [
            { key: 'handwashing', desc: 'Record hand hygiene opportunities and compliance.' },
            { key: 'ipc_facility_assessment', desc: 'Assess the facility infection-control programme.' },
            { key: 'ams_assessment', desc: 'Assess the antimicrobial stewardship programme.' },
        ],
    },
};

// A course teaches one thing, but a participant may practise any of them, which
// is the point of the tab. This only picks the tab's opening selection.
const COURSE_TYPE_TO_SERVICE = {
    'IMNCI': 'IMNCI',
    'ICCM': 'IMNCI',
    'Comprehensive Package For Community Midwives': 'IMNCI',
    'Program Management': 'IMNCI',
    'EENC': 'EENC',
    'EmONC': 'EENC',
    'Small & Sick Newborn': 'EENC',
    'ETAT': 'ETAT',
    'IPC': 'IPC',
};

// Which training this course actually teaches. Returns null only when nothing
// identifies it, which is the one case where the picker has to offer a choice.
const resolveCourseService = (course, participant) => {
    // The sub-course helper wins when it has an opinion, so a course that was
    // set up as an EENC mentorship sub-course still opens on EENC.
    try {
        const fromSubCourse = getCourseMentorshipService(course, participant);
        if (fromSubCourse && PRACTICE_SERVICES[fromSubCourse]) return fromSubCourse;
    } catch {
        // The helper is only a hint; a course type it does not recognise is not
        // an error here because the course type below is checked next.
    }
    return COURSE_TYPE_TO_SERVICE[course?.course_type] || null;
};

// ---------------------------------------------------------------------------
// The training facility
// ---------------------------------------------------------------------------

// Every field form reads the facility through the Arabic column names used in
// the facilities sheet. A practice session has no facility, so one is
// synthesised from the course. It is course-scoped rather than global so two
// courses running at once cannot collide on the visit-number cache the forms
// keep in localStorage.
const buildTrainingFacility = (course, participant) => ({
    id: `course-${course?.id || 'unknown'}`,
    'اسم_المؤسسة': `${course?.course_type || 'Course'} training — ${course?.locality || ''}`.trim(),
    'الولاية': course?.state || 'N/A',
    'المحلية': course?.locality || 'N/A',
    'نوع_المؤسسةالصحية': 'Training course',
    project_name: 'Course practice',
    // The IMNCI visit report reads each of these to pre-fill its equipment
    // block. Answering 'No' keeps a practice report from claiming a training
    // room holds equipment it does not have.
    'ميزان_طول': 'No',
    'ميزان_حرارة': 'No',
    'ساعة_مؤقت': 'No',
    'غرفة_إرواء': 'No',
    immunization_office_exists: 'No',
    nutrition_center_exists: 'No',
    growth_monitoring_service_exists: 'No',
    // Marks the record for anything downstream that needs to tell a practice
    // facility from a real one.
    is_training_facility: true,
    courseId: course?.id || null,
    participantId: participant?.id || null,
});

// ---------------------------------------------------------------------------
// Payload to course record
// ---------------------------------------------------------------------------

// Firestore rejects `undefined`. Timestamps and other class instances are passed
// through untouched, because cloning them would turn them into plain objects and
// break every date read downstream.
const sanitize = (value) => {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(sanitize);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
        if (v === undefined) return;
        out[k] = sanitize(v);
    });
    return out;
};

// Totals rather than per-domain figures. Counting both would double every score.
const OVERALL_SCORE_KEYS = new Set(['overall', 'overallScore', 'total', 'grandTotal']);

// Every form writes its scores as matching `<domain>_score` / `<domain>_maxScore`
// pairs, which is the one shape all eight have in common — so domains are read
// off the payload instead of being hard-coded per form. A form that gains a
// domain is picked up here with no change.
export const extractScoreDomains = (scores) => {
    if (!scores || typeof scores !== 'object') return [];
    const found = [];
    Object.keys(scores).forEach(key => {
        if (!key.endsWith('_score')) return;
        const domain = key.slice(0, -'_score'.length);
        const maxKey = `${domain}_maxScore`;
        if (!(maxKey in scores)) return;
        const score = Number(scores[key]);
        const max = Number(scores[maxKey]);
        if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) return;
        found.push({ domain, score, max, isOverall: OVERALL_SCORE_KEYS.has(domain) });
    });
    const detailed = found.filter(d => !d.isOverall);
    return detailed.length ? detailed : found;
};

const humaniseDomain = (domain) =>
    domain
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, c => c.toUpperCase());

// Turns the payload a field form produced into the case + observations shape the
// course collections use.
//
// Observations are written one per scored domain rather than one per question.
// The forms score to different granularities — hand hygiene has no per-item
// score at all, only a compliance percentage — and a domain-level row is the
// finest cut that means the same thing across all of them. Sums still work, so
// every percentage in the course report is exact; only a per-question drill-down
// is unavailable, and the untouched payload is kept on the case for that.
export const buildCoursePracticeRecord = (payload, context) => {
    const {
        course, participant, service, formKey,
        dayOfCourse = 1, caseSerial = 1, caseAgeMonths = '',
        subCourse = null,
    } = context;

    const form = PRACTICE_FORMS[formKey] || PRACTICE_FORMS.skills_assessment;
    const encounterDate =
        payload?.sessionDate ||
        payload?.reportDate ||
        payload?.visitDate ||
        new Date().toISOString().slice(0, 10);

    const domains = extractScoreDomains(payload?.scores);
    const earned = domains.reduce((sum, d) => sum + d.score, 0);
    const possible = domains.reduce((sum, d) => sum + d.max, 0);

    const observations = domains.map(d => sanitize({
        courseId: course.id,
        course_type: course.course_type,
        participant_id: participant.id,
        encounter_date: encounterDate,
        day_of_course: dayOfCourse,
        setting: 'MENTORSHIP',
        record_source: 'COURSE_PRACTICE',
        record_type: form.recordType,
        mentorship_service: service,
        domain: d.domain,
        section: 'summary',
        item_recorded: humaniseDomain(d.domain),
        item_correct: d.score,
        item_max: d.max,
        case_serial: caseSerial,
        age_group: form.ageGroup,
        sub_course: subCourse || null,
        ...(caseAgeMonths !== '' && caseAgeMonths !== null
            ? { case_age_months: Number(caseAgeMonths) }
            : {}),
    }));

    const caseData = sanitize({
        courseId: course.id,
        course_type: course.course_type,
        participant_id: participant.id,
        encounter_date: encounterDate,
        setting: 'MENTORSHIP',
        // Says plainly that this is course practice and not a facility
        // mentorship record, for anything reading the collection later.
        record_source: 'COURSE_PRACTICE',
        record_type: form.recordType,
        form_key: formKey,
        mentorship_service: service,
        service_type: payload?.serviceType || service,
        age_group: form.ageGroup,
        case_serial: caseSerial,
        day_of_course: dayOfCourse,
        sub_course: subCourse || null,
        status: payload?.status || 'complete',
        health_worker_name: payload?.healthWorkerName || participant?.name || null,
        score_total: earned,
        score_max: possible,
        score_pct: possible ? Math.round((earned / possible) * 100) : null,
        allCorrect: possible > 0 && earned === possible,
        contentHash: domains
            .map(d => `${d.domain}:${d.score}/${d.max}`)
            .sort()
            .join('|') || `practice-${formKey}-${encounterDate}`,
        notes: payload?.notes || '',
        // The complete form payload, so re-opening a saved session rehydrates
        // the real form rather than an approximation of it.
        session_payload: payload,
    });

    return { caseData, observations };
};

// ---------------------------------------------------------------------------
// Automatic check against the standard case
// ---------------------------------------------------------------------------

// IMNCI and ETAT are marked differently — an absolute total against a fixed
// maximum for IMNCI, checklist selection plus a percentage for ETAT — because
// their forms score differently, not by preference. This picks the right one and
// returns a single shape: what to store on the case, and what to show the
// mentor afterwards.
const runScenarioCheck = (payload, scenario, service) => {
    if (!scenario) return null;

    if (service === 'ETAT') {
        const result = checkEtatScenario(payload, scenario);
        if (!result) return null;
        return {
            kind: 'ETAT',
            result,
            caseFields: {
                scenario_checklists_expected: result.expected,
                scenario_checklists_selected: result.selected,
                scenario_checklists_missing: result.missing,
                scenario_checklists_extra: result.extra,
                scenario_checklists_correct: result.checklistsCorrect,
                mentor_pct: result.mentorPct,
                standard_pct: result.standardPct,
                standard_difference: result.pctDifference,
                standard_within_tolerance: result.withinTolerance,
            },
        };
    }

    if (service === 'IMNCI') {
        // compareMentorToStandard expects the form's own calculateScores output,
        // which is keyed `<domain>: {score, maxScore}`. The payload flattens that
        // into `<domain>_score` / `<domain>_maxScore`, so it is rebuilt here.
        const flat = payload?.scores || {};
        const nested = {};
        Object.keys(flat).forEach(key => {
            if (!key.endsWith('_score')) return;
            const domain = key.slice(0, -'_score'.length);
            if (!(`${domain}_maxScore` in flat)) return;
            nested[domain] = { score: flat[key], maxScore: flat[`${domain}_maxScore`] };
        });

        const result = compareMentorToStandard(nested, scenario, null);
        if (!result) return null;
        return {
            kind: 'IMNCI',
            result,
            caseFields: {
                mentor_score: result.mentorScore,
                mentor_max: result.mentorMax,
                standard_score: result.standardScore,
                standard_max: result.standardMax,
                standard_difference: result.difference,
                standard_agreement_pct: result.agreementPct,
                standard_within_tolerance: result.withinTolerance,
            },
        };
    }

    return null;
};

// ---------------------------------------------------------------------------
// Saved sessions list
// ---------------------------------------------------------------------------

function SavedPracticeSessions({ cases, observations, onEdit, onDelete }) {
    if (!cases.length) {
        return (
            <Card>
                <div className="p-8 text-center">
                    <h3 className="text-base font-semibold text-slate-700">Nothing recorded yet</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Start a session above. What you record here goes into this participant's
                        course report.
                    </p>
                </div>
            </Card>
        );
    }

    const sorted = [...cases].sort((a, b) => {
        const byDate = String(b.encounter_date || '').localeCompare(String(a.encounter_date || ''));
        return byDate !== 0 ? byDate : (b.case_serial || 0) - (a.case_serial || 0);
    });

    const rows = sorted.map(c => {
        // Sessions recorded before this tab stored a total — and any recorded by
        // the earlier version of it — carry no score on the case, so the figure
        // is summed back off their observations rather than shown as missing.
        let earned = c.score_total;
        let possible = c.score_max;
        if (possible === undefined || possible === null) {
            const obs = (observations || []).filter(o => o.caseId === c.id);
            earned = obs.reduce((sum, o) => sum + (o.item_correct || 0), 0);
            possible = obs.reduce((sum, o) => sum + (o.item_max || 1), 0);
        }
        const pct = possible ? Math.round((earned / possible) * 100) : null;

        return {
            c,
            pct,
            label: PRACTICE_FORMS[c.form_key]?.title || c.record_type || 'Session',
            scoreText: possible ? `${earned}/${possible} (${pct}%)` : '—',
            tone: pct === null ? 'text-slate-500'
                : pct >= 80 ? 'text-green-700'
                    : pct >= 50 ? 'text-yellow-700' : 'text-red-700',
        };
    });

    return (
        <Card className="p-3 sm:p-4">
            <h3 className="text-lg font-semibold mb-3">Recorded practice sessions</h3>

            {/* Phone view: a seven-column table is unreadable at 360px. */}
            <div className="md:hidden space-y-3">
                {rows.map(({ c, label, scoreText, tone }) => (
                    <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                                <div className="font-semibold text-slate-800 break-words">
                                    #{c.case_serial} · {label}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {c.mentorship_service} · {c.encounter_date} · Day {c.day_of_course}
                                </div>
                            </div>
                            <span className={`font-semibold text-sm flex-shrink-0 ${tone}`}>{scoreText}</span>
                        </div>
                        {c.status === 'draft' && (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                                Draft
                            </span>
                        )}
                        <div className="flex gap-2 justify-end pt-2 mt-2 border-t border-slate-200">
                            {PRACTICE_FORMS[c.form_key]?.canReopen !== false && (
                                <Button variant="secondary" size="sm" onClick={() => onEdit(c)}>Open</Button>
                            )}
                            <Button variant="danger" size="sm" onClick={() => onDelete(c)}>Delete</Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-slate-100 text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">Training</th>
                            <th className="p-2">Form</th>
                            <th className="p-2">Date</th>
                            <th className="p-2">Day</th>
                            <th className="p-2">Score</th>
                            <th className="p-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ c, label, scoreText, tone }) => (
                            <tr key={c.id} className="border-b border-slate-200">
                                <td className="p-2 font-medium">{c.case_serial}</td>
                                <td className="p-2">{c.mentorship_service}</td>
                                <td className="p-2">
                                    {label}
                                    {c.status === 'draft' && (
                                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                                            Draft
                                        </span>
                                    )}
                                </td>
                                <td className="p-2">{c.encounter_date}</td>
                                <td className="p-2">{c.day_of_course}</td>
                                <td className={`p-2 font-semibold ${tone}`}>{scoreText}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {PRACTICE_FORMS[c.form_key]?.canReopen !== false && (
                                        <Button variant="secondary" size="sm" onClick={() => onEdit(c)}>Open</Button>
                                    )}
                                    <Button variant="danger" size="sm" className="ml-2" onClick={() => onDelete(c)}>
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// The result of the automatic check
// ---------------------------------------------------------------------------

function ScenarioCheckPanel({ check }) {
    const { kind, result, scenario } = check;
    const isEtat = kind === 'ETAT';
    const ok = isEtat
        ? result.checklistsCorrect && result.withinTolerance !== false
        : result.withinTolerance;

    return (
        <div className="mt-5 text-left">
            <div className={`p-3 rounded-lg border ${
                ok ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'
            }`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <h4 className="font-bold text-slate-800 min-w-0 break-words">
                        Case {scenario.id} — {scenario.title || scenario.childName}
                    </h4>
                    <span className={`self-start shrink-0 px-3 py-1 rounded-md text-white font-semibold text-sm ${
                        ok ? 'bg-green-600' : 'bg-amber-600'
                    }`}>
                        {isEtat
                            ? (result.mentorPct === null ? 'Recorded' : `${result.mentorPct}%`)
                            : `${result.agreementPct}% agreement`}
                    </span>
                </div>

                {isEtat ? (
                    <div className="mt-3 text-sm">
                        <div className="font-semibold text-slate-700">Checklists</div>
                        {result.checklistsCorrect ? (
                            <p className="text-green-800">
                                Correct — this case calls for {result.expected.join(' and ')}, and that is what you opened.
                            </p>
                        ) : (
                            <ul className="list-disc ml-5 text-amber-900">
                                {result.missing.length > 0 && (
                                    <li>Missed: {result.missing.join(', ')} — the case needed this and it was not opened.</li>
                                )}
                                {result.extra.length > 0 && (
                                    <li>Not needed: {result.extra.join(', ')} — this case does not call for it.</li>
                                )}
                            </ul>
                        )}
                        {result.mentorPct !== null && (
                            <p className="text-slate-600 mt-2">
                                You marked {result.score} of {result.max} applicable items done
                                ({result.mentorPct}%). The standard for this case is {result.standardPct}%.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3 text-sm mt-3">
                        <div>
                            <div className="text-slate-500 text-xs">You scored</div>
                            <div className="font-semibold">{result.mentorScore}/{result.mentorMax}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">Standard</div>
                            <div className="font-semibold">{result.standardScore}/{result.standardMax}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">Difference</div>
                            <div className={`font-semibold ${result.withinTolerance ? 'text-green-700' : 'text-amber-700'}`}>
                                {result.difference > 0 ? '+' : ''}{result.difference}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Released only now, so the session was worked without them. */}
            {(scenario.expectedRecognition || scenario.expectedManagement) && (
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                    {scenario.expectedRecognition && (
                        <p className="mb-2">
                            <span className="font-semibold text-slate-700">Expected recognition: </span>
                            <span className="text-slate-700">{scenario.expectedRecognition}</span>
                        </p>
                    )}
                    {Array.isArray(scenario.expectedManagement) ? (
                        <>
                            <div className="font-semibold text-slate-700">Expected management</div>
                            <ul className="list-disc ml-5 text-slate-700 mt-1 space-y-1">
                                {scenario.expectedManagement.map((line, i) => <li key={i}>{line}</li>)}
                            </ul>
                        </>
                    ) : scenario.expectedManagement ? (
                        <p>
                            <span className="font-semibold text-slate-700">Expected management: </span>
                            <span className="text-slate-700">{scenario.expectedManagement}</span>
                        </p>
                    ) : null}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------

export function MentorshipMonitoringView({
    course, participant, participants = [], onChangeParticipant, isPublicView = false,
}) {
    const subCourse = useMemo(() => {
        try {
            return getMentorshipSubType(course, participant);
        } catch {
            return null;
        }
    }, [course, participant]);

    // An ETAT course teaches ETAT, so offering IMNCI, EENC and IPC alongside it
    // is noise and an easy way to file a session under the wrong training. The
    // picker is therefore limited to what this course teaches, and only opens up
    // when nothing identifies the course at all.
    const courseService = useMemo(
        () => resolveCourseService(course, participant),
        [course, participant]
    );
    const applicableServices = useMemo(
        () => (courseService ? [courseService] : Object.keys(PRACTICE_SERVICES)),
        [courseService]
    );

    const [service, setService] = useState(() => courseService || 'IMNCI');

    // The standard case being worked. Only the skills assessment is marked
    // against one: a mothers interview and a visit report have no single correct
    // answer to compare with.
    const scenarios = useMemo(() => getScenariosForService(service), [service]);
    const [scenarioId, setScenarioId] = useState('');
    const scenario = useMemo(
        () => (scenarioId ? getServiceScenarioById(service, scenarioId) : null),
        [service, scenarioId]
    );
    // Held after a save so the result, and the expected answers withheld until
    // now, can be shown in the confirmation.
    const [savedCheck, setSavedCheck] = useState(null);
    const [formKey, setFormKey] = useState('skills_assessment');

    const [cases, setCases] = useState([]);
    const [observations, setObservations] = useState([]);
    const [editingCase, setEditingCase] = useState(null);
    const [dayOfCourse, setDayOfCourse] = useState(1);
    const [caseAgeMonths, setCaseAgeMonths] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

    // Sub-forms the IMNCI/EENC skills forms can open from their own toolbar. In
    // the field these are the mentor's shortcuts to the mothers interview and
    // visit report; here they open the same forms, still saving to the course.
    const [companionForm, setCompanionForm] = useState(null);

    // The record each open form is writing to, keyed by "<training>:<form>".
    //
    // The forms autosave every few seconds and track the saved id themselves. If
    // one of them ever loses that id — an autosave that overlaps the first save,
    // or a form whose own id bookkeeping is wrong — it would call back with no
    // id and a new course record would be created on every keystroke batch.
    // Holding the id here as well means the second save updates the first record
    // whatever the form believes. It is keyed per form because the skills form
    // can have a mothers interview open over it, and those are two records.
    const activeCaseIdsRef = React.useRef({});

    const availableForms = PRACTICE_SERVICES[service]?.forms || [];
    const form = PRACTICE_FORMS[formKey];
    const trainingFacility = useMemo(
        () => buildTrainingFacility(course, participant),
        [course, participant]
    );

    // Serials run per training and per form, so an IMNCI skills case is not
    // renumbered by an EENC interview recorded the same afternoon. Only the
    // numbering is scoped that way — the list below shows every session the
    // participant has recorded, whichever training is selected right now.
    const sameFormCases = useMemo(
        () => cases.filter(c =>
            (c.mentorship_service || 'IMNCI') === service &&
            (c.form_key || 'skills_assessment') === formKey),
        [cases, service, formKey]
    );

    const nextSerial = useMemo(
        () => sameFormCases.reduce((max, c) => Math.max(max, c.case_serial || 0), 0) + 1,
        [sameFormCases]
    );

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!course?.id || !participant?.id) return;
            setLoading(true);
            setError(null);
            try {
                const [obsData, casesData] = await Promise.all([
                    listObservationsForParticipant(course.id, participant.id),
                    listCasesForParticipant(course.id, participant.id),
                ]);
                if (cancelled) return;
                setObservations(obsData || []);
                setCases((casesData || []).filter(c => c.setting === 'MENTORSHIP'));
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to load course practice records:', err);
                setError("Could not load this participant's practice records. Check the connection and reload.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [course?.id, participant?.id]);

    // Switching participant closes whatever is open rather than carrying one
    // person's half-filled form onto another's record.
    useEffect(() => {
        activeCaseIdsRef.current = {};
        setShowForm(false);
        setEditingCase(null);
        setCompanionForm(null);
    }, [participant?.id]);

    // Default to the first case of whatever training is selected.
    useEffect(() => {
        setScenarioId(prev => (scenarios.some(s => s.id === prev) ? prev : (scenarios[0]?.id || '')));
    }, [scenarios]);

    // A training that does not own the selected form falls back to its first.
    useEffect(() => {
        if (!availableForms.some(f => f.key === formKey)) {
            setFormKey(availableForms[0]?.key || 'skills_assessment');
        }
    }, [service, availableForms, formKey]);

    // --- saving -------------------------------------------------------------

    // The forms capture `onSaveOverride` inside their own autosave callbacks,
    // which have narrow dependency lists and so keep the first version they were
    // given. A callback rebuilt on every render would therefore be read as a
    // stale one, holding a stale day, serial and case list. The override is
    // instead built once and reads everything it needs through this ref, which
    // is refreshed on each render.
    const saveContextRef = React.useRef(null);
    saveContextRef.current = {
        course, participant, cases, dayOfCourse, caseAgeMonths, subCourse, editingCase, nextSerial,
        scenario,
    };

    // Handed to every form as `onSaveOverride`. It has the same contract as
    // saveMentorshipSession — take a payload and an optional existing id, return
    // the id it saved under — so the forms need no other change, and their
    // autosave keeps working against the same course record.
    const makeSaveOverride = useCallback((targetFormKey, targetService) => async (payload, existingId) => {
        const ctx = saveContextRef.current;
        const slot = `${targetService}:${targetFormKey}`;
        const targetId = existingId || activeCaseIdsRef.current[slot] || null;
        const existing = targetId ? ctx.cases.find(c => c.id === targetId) : null;

        const { caseData, observations: newObservations } = buildCoursePracticeRecord(payload, {
            course: ctx.course,
            participant: ctx.participant,
            service: targetService,
            formKey: targetFormKey,
            dayOfCourse: ctx.dayOfCourse,
            caseSerial: existing?.case_serial ?? ctx.editingCase?.case_serial ?? ctx.nextSerial,
            caseAgeMonths: ctx.caseAgeMonths,
            subCourse: ctx.subCourse,
        });

        // The case identity and its automatic check ride on the same course
        // record. No extra observations are written: the check is a statement
        // about the mentor's own judgement, not a finding about the health
        // worker, and mixing the two would distort the course report totals.
        const check = ctx.scenario && targetFormKey === 'skills_assessment'
            ? runScenarioCheck(payload, ctx.scenario, targetService)
            : null;

        if (ctx.scenario && targetFormKey === 'skills_assessment') {
            caseData.scenario_id = ctx.scenario.id;
            caseData.scenario_title = ctx.scenario.title || ctx.scenario.childName || null;
        }
        if (check) Object.assign(caseData, check.caseFields);

        const { savedCase, savedObservations } = await upsertCaseAndObservations(
            caseData, newObservations, targetId
        );

        // Snapshot for the confirmation panel: `scenario` is about to point at
        // the next case once the form resets.
        if (check && payload?.status !== 'draft') {
            lastCheckRef.current = { ...check, scenario: ctx.scenario };
        }

        activeCaseIdsRef.current[slot] = savedCase.id;

        setCases(prev => (prev.some(c => c.id === savedCase.id)
            ? prev.map(c => (c.id === savedCase.id ? savedCase : c))
            : [...prev, savedCase]));
        setObservations(prev => [
            ...prev.filter(o => o.caseId !== savedCase.id),
            ...(savedObservations || []),
        ]);

        // The forms treat the return value as the session id and reuse it on the
        // next autosave, which is what keeps a draft on one record.
        return savedCase.id;
    }, []);

    // The forms hold on to whichever override function they were first handed,
    // so one is built per form and reused rather than rebuilt each render.
    const lastCheckRef = React.useRef(null);
    const overrideCacheRef = React.useRef({});
    const getSaveOverride = useCallback((key, svc) => {
        const slot = `${svc}:${key}`;
        if (!overrideCacheRef.current[slot]) {
            overrideCacheRef.current[slot] = makeSaveOverride(key, svc);
        }
        return overrideCacheRef.current[slot];
    }, [makeSaveOverride]);

    // Closing a form ends its claim on a record, so the next session it opens
    // starts a new one instead of overwriting the last.
    const releaseSlot = useCallback((key, svc) => {
        delete activeCaseIdsRef.current[`${svc}:${key}`];
    }, []);

    const handleSaveComplete = useCallback((status) => {
        if (status === 'draft') return;
        setSavedCheck(lastCheckRef.current);
        lastCheckRef.current = null;
        activeCaseIdsRef.current = {};
        setShowForm(false);
        setEditingCase(null);
        setCompanionForm(null);
        setShowSuccess(true);
    }, []);

    const handleExitForm = useCallback(() => {
        activeCaseIdsRef.current = {};
        setShowForm(false);
        setEditingCase(null);
        setCompanionForm(null);
    }, []);

    const startNewSession = () => {
        activeCaseIdsRef.current = {};
        setEditingCase(null);
        setDayOfCourse(1);
        setCaseAgeMonths('');
        setShowSetupModal(true);
    };

    const handleEditCase = (caseToEdit) => {
        const svc = caseToEdit.mentorship_service || 'IMNCI';
        const key = caseToEdit.form_key || 'skills_assessment';

        if (PRACTICE_FORMS[key]?.canReopen === false) {
            setToast({
                show: true,
                message: `A saved ${PRACTICE_FORMS[key].title} cannot be reopened for editing. `
                    + 'Record a new session to correct it, then delete this one.',
                type: 'info',
            });
            return;
        }

        // Seeded so the first autosave after reopening updates this record
        // rather than forking a copy of it.
        activeCaseIdsRef.current = { [`${svc}:${key}`]: caseToEdit.id };
        setService(svc);
        setFormKey(key);
        setEditingCase(caseToEdit);
        setDayOfCourse(caseToEdit.day_of_course || 1);
        setCaseAgeMonths(caseToEdit.case_age_months ?? '');
        setShowForm(true);
        window.scrollTo(0, 0);
    };

    const handleDeleteSession = async (caseToDelete) => {
        if (!window.confirm('Delete this practice session and everything recorded in it? This cannot be undone.')) return;

        const prevCases = [...cases];
        const prevObs = [...observations];
        setCases(prev => prev.filter(c => c.id !== caseToDelete.id));
        setObservations(prev => prev.filter(o => o.caseId !== caseToDelete.id));

        try {
            await deleteCaseAndObservations(caseToDelete.id);
        } catch (err) {
            console.error('Failed to delete practice session:', err);
            setCases(prevCases);
            setObservations(prevObs);
            alert(`Could not delete this session: ${err.message}. It has been restored in your view.`);
        }
    };

    // --- form rendering -----------------------------------------------------

    // `existingSessionData` is the untouched payload the form itself wrote, with
    // the course case id attached, so every form rehydrates through its own
    // normal editing path.
    const existingSessionData = useMemo(() => {
        if (!editingCase?.session_payload) return null;
        return { ...editingCase.session_payload, id: editingCase.id };
    }, [editingCase]);

    const commonProps = {
        facility: trainingFacility,
        setToast,
        onExit: handleExitForm,
        onSaveComplete: handleSaveComplete,
        existingSessionData,
        onSaveOverride: getSaveOverride(formKey, service),
        // A practice session is numbered by course day, not by facility visit,
        // so the visit number is pinned and the mentor cannot edit it.
        visitNumber: dayOfCourse,
        canEditVisitNumber: false,
        lockedVisitNumber: true,
        workerHistory: [],
    };

    const workerProps = {
        healthWorkerName: participant?.name || 'Participant',
        healthWorkerJobTitle: participant?.job_title || participant?.group || null,
        healthWorkerTrainingDate: course?.start_date || null,
        healthWorkerPhone: participant?.phone || null,
    };

    // The two skills forms carry a toolbar that jumps to the mothers interview
    // and the visit report. Wiring them keeps the tab behaving like the field
    // view instead of crashing on an undefined setter.
    const companionProps = {
        setIsMothersFormModalOpen: () => setCompanionForm('mothers_form'),
        setIsVisitReportModalOpen: () => setCompanionForm('visit_report'),
        setIsDashboardModalOpen: () => setToast({
            show: true,
            message: 'The mentorship dashboard covers facility visits, so it is not part of course practice.',
            type: 'info',
        }),
        draftCount: 0,
        onDraftCreated: () => {},
    };

    const renderForm = (key, forService) => {
        const props = {
            ...commonProps,
            onSaveOverride: getSaveOverride(key, forService),
        };

        if (key === 'skills_assessment') {
            if (forService === 'EENC') {
                return <EENCSkillsAssessmentForm {...props} {...workerProps} {...companionProps} />;
            }
            if (forService === 'ETAT') {
                return (
                    <ETATSkillsAssessmentForm
                        {...props}
                        {...workerProps}
                        setIsVisitReportModalOpen={companionProps.setIsVisitReportModalOpen}
                        setIsDashboardModalOpen={companionProps.setIsDashboardModalOpen}
                    />
                );
            }
            return <SkillsAssessmentForm {...props} {...workerProps} {...companionProps} />;
        }

        if (key === 'mothers_form') {
            const MothersComponent = forService === 'EENC' ? EENCMothersForm : IMNCIMothersForm;
            return (
                <MothersComponent
                    {...props}
                    onCancel={handleExitForm}
                    allSubmissions={[]}
                />
            );
        }

        if (key === 'visit_report') {
            const ReportComponent = forService === 'EENC' ? EENCVisitReport : IMNCIVisitReport;
            return (
                <ReportComponent
                    facility={trainingFacility}
                    visitNumber={dayOfCourse}
                    lockedVisitNumber
                    canEditVisitNumber={false}
                    allSubmissions={[]}
                    allVisitReports={[]}
                    existingReportData={editingCase?.session_payload
                        ? { ...editingCase.session_payload, id: editingCase.id }
                        : null}
                    onCancel={handleExitForm}
                    onSaveSuccess={() => handleSaveComplete('complete')}
                    setToast={setToast}
                    onSaveOverride={getSaveOverride('visit_report', forService)}
                />
            );
        }

        if (key === 'handwashing') {
            return <HandwashingAssessmentForm {...props} {...workerProps} />;
        }

        if (key === 'ipc_facility_assessment') {
            return <IPCAssessmentForm {...props} />;
        }

        if (key === 'ams_assessment') {
            return <AMSAssessmentForm {...props} />;
        }

        return (
            <EmptyState
                title="Form unavailable"
                message="This training has no practice form yet."
            />
        );
    };

    // --- render -------------------------------------------------------------

    return (
        <div className="grid gap-2">
            {/* The public course page draws its own "Course Monitoring" header with
                the training, the states and the participant picker, so repeating a
                header here would just push the form down the page. */}
            {!isPublicView && (
                <PageHeader
                    title="Mentorship Practice"
                    subtitle={`${PRACTICE_SERVICES[service]?.label || service} — ${participant?.name || ''}`}
                />
            )}
            {toast.show && (
                <div className={`p-3 rounded-md text-sm ${
                    toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300'
                        : toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-sky-100 text-sky-800 border border-sky-300'
                }`}>
                    <div className="flex justify-between items-start gap-3">
                        <span className="min-w-0 break-words">{toast.message}</span>
                        <button
                            type="button"
                            className="flex-shrink-0 font-semibold"
                            onClick={() => setToast({ show: false, message: '', type: 'info' })}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <Card><div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div></Card>
            )}

            <Modal
                isOpen={showSuccess}
                onClose={() => { setShowSuccess(false); setSavedCheck(null); }}
                title="Session recorded"
                size={savedCheck ? 'lg' : undefined}
            >
                <div className="p-6">
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Saved to the course report</h3>
                        <p className="text-gray-600">
                            This is now part of {participant?.name}'s course record. It stays inside the
                            course and is not added to the facility mentorship records.
                        </p>
                    </div>

                    {savedCheck && <ScenarioCheckPanel check={savedCheck} />}

                    <Button
                        onClick={() => { setShowSuccess(false); setSavedCheck(null); }}
                        className="w-full mt-6 bg-green-600 hover:bg-green-700 border-green-600"
                    >
                        Done
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} title="Session setup" size="lg">
                <div className="p-4">
                    {applicableServices.length === 1 ? (
                        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Training</div>
                            <div className="font-semibold text-slate-800 mt-0.5">
                                {PRACTICE_SERVICES[applicableServices[0]]?.label}
                            </div>
                            <div className="text-xs text-slate-500">
                                {PRACTICE_SERVICES[applicableServices[0]]?.subtitle}
                            </div>
                        </div>
                    ) : (
                        <FormGroup label="Which training?" className="mb-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {applicableServices.map(key => {
                                    const svc = PRACTICE_SERVICES[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setService(key)}
                                            className={`text-left p-3 rounded-lg border transition-colors ${
                                                service === key
                                                    ? 'bg-sky-600 border-sky-600 text-white'
                                                    : 'bg-white border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="font-semibold text-sm">{svc.label}</div>
                                            <div className={`text-xs mt-1 ${service === key ? 'text-sky-100' : 'text-slate-500'}`}>
                                                {svc.subtitle}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </FormGroup>
                    )}

                    {availableForms.length === 1 ? (
                        <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Form</div>
                            <div className="font-semibold text-slate-800 mt-0.5">
                                {PRACTICE_FORMS[availableForms[0].key]?.title}
                            </div>
                            <div className="text-xs text-slate-500">{availableForms[0].desc}</div>
                        </div>
                    ) : (
                        <FormGroup label="Which form?" className="mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {availableForms.map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setFormKey(opt.key)}
                                        className={`text-left p-3 rounded-lg border transition-colors ${
                                            formKey === opt.key
                                                ? 'bg-sky-600 border-sky-600 text-white'
                                                : 'bg-white border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="font-semibold text-sm">{PRACTICE_FORMS[opt.key]?.title}</div>
                                        <div className={`text-xs mt-1 ${formKey === opt.key ? 'text-sky-100' : 'text-slate-500'}`}>
                                            {opt.desc}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </FormGroup>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {participants.length > 0 && (
                            <FormGroup label="Select participant" className="sm:col-span-2">
                                <Select value={participant.id} onChange={(e) => onChangeParticipant(e.target.value)}>
                                    {participants.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} — {p.group}</option>
                                    ))}
                                </Select>
                            </FormGroup>
                        )}
                        {scenarios.length > 0 && formKey === 'skills_assessment' && (
                            <FormGroup label="Standard case" className="sm:col-span-2">
                                <Select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
                                    <option value="">No standard case — free practice</option>
                                    {scenarios.map(sc => (
                                        <option key={sc.id} value={sc.id}>
                                            {sc.id} · {sc.title || sc.childName}
                                        </option>
                                    ))}
                                </Select>
                            </FormGroup>
                        )}
                        <FormGroup label="Course day">
                            <Select value={dayOfCourse} onChange={(e) => setDayOfCourse(Number(e.target.value))}>
                                {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d}</option>)}
                            </Select>
                        </FormGroup>
                        {formKey === 'skills_assessment' && service === 'IMNCI' && (
                            <FormGroup label="Child age (months)">
                                <Input
                                    type="number"
                                    value={caseAgeMonths}
                                    onChange={(e) => setCaseAgeMonths(e.target.value === '' ? '' : Number(e.target.value))}
                                    placeholder="Optional"
                                />
                            </FormGroup>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 mt-4">
                        This opens the same form used during facility mentorship. The result is
                        saved to the course report for {participant?.name || 'this participant'} and
                        is not added to the facility mentorship records.
                    </p>
                </div>
                <div className="p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-gray-50 rounded-b-lg">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setShowSetupModal(false)}>
                        Close
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => { setShowSetupModal(false); setShowForm(true); }}
                    >
                        Start session
                    </Button>
                </div>
            </Modal>

            {/* Kept on the public link because it is the only way in to the form,
                but stripped to the button — the explanatory copy is for a mentor
                looking at their own course, not for someone opening a shared link
                to fill one form in. */}
            {!showForm && !loading && (isPublicView ? (
                <div className="mb-4">
                    <Button className="w-full sm:w-auto" onClick={startNewSession}>
                        + New session
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-800">Start a practice session</h3>
                        <p className="text-sm text-slate-500">
                            The same forms used in the field. Everything is saved to
                            {' '}{participant?.name || 'this participant'}'s course report.
                        </p>
                    </div>
                    <Button className="w-full sm:w-auto flex-shrink-0" onClick={startNewSession}>
                        + New session
                    </Button>
                </div>
            ))}

            {showForm && (
                <Card className="p-3 sm:p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold break-words">
                                {editingCase
                                    ? `Editing #${editingCase.case_serial} — ${form?.title}`
                                    : `New #${nextSerial} — ${form?.title}`}
                            </h3>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 mt-1">
                                <span><span className="font-semibold">Training:</span> {PRACTICE_SERVICES[service]?.label}</span>
                                <span><span className="font-semibold">Day:</span> {dayOfCourse}</span>
                                <span><span className="font-semibold">Sub-course:</span> {subCourse || '—'}</span>
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full sm:w-auto flex-shrink-0"
                            onClick={() => setShowSetupModal(true)}
                        >
                            Edit setup
                        </Button>
                    </div>

                    {/* The case being role-played, shown while the session runs.
                        The expected recognition and management are deliberately
                        withheld until the session is saved — a mentor who can see
                        the answer marks towards the answer, not towards the child
                        in front of them. */}
                    {scenario && formKey === 'skills_assessment' && (
                        <div className="mb-4 p-3 rounded-lg border border-sky-200 bg-sky-50">
                            <div className="flex flex-wrap items-baseline gap-2">
                                <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-xs font-semibold">
                                    Case {scenario.id}
                                </span>
                                <span className="font-semibold text-slate-800">
                                    {scenario.title || scenario.childName}
                                </span>
                            </div>
                            <p className="text-sm text-slate-700 mt-2">
                                {scenario.presentation || scenario.vignette}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                                Work the case as you would in the field. Your session is checked against the
                                standard answer once you save, and the answer is shown to you then.
                            </p>
                        </div>
                    )}

                    <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                        {renderForm(formKey, service)}
                    </Suspense>
                </Card>
            )}

            {/* The mothers interview and visit report the skills form links to. */}
            {companionForm && (
                <Modal
                    isOpen={!!companionForm}
                    onClose={() => { releaseSlot(companionForm, service); setCompanionForm(null); }}
                    title={PRACTICE_FORMS[companionForm]?.title || 'Form'}
                    size="full"
                >
                    <div className="p-0 sm:p-4 bg-gray-100">
                        <Suspense fallback={<div className="p-8"><Spinner /></div>}>
                            {renderForm(companionForm, service)}
                        </Suspense>
                    </div>
                </Modal>
            )}

            {/* The saved-session list is a mentor's review tool. On the public
                link the page is there to fill a form in, so the list — and its
                Delete buttons — are left off and only the form is shown. The
                records are still loaded, because the serial numbering needs them. */}
            {!isPublicView && (loading
                ? <Card><Spinner /></Card>
                : <SavedPracticeSessions
                    cases={cases}
                    observations={observations}
                    onEdit={handleEditCase}
                    onDelete={handleDeleteSession}
                />)}
        </div>
    );
}

export default MentorshipMonitoringView;
