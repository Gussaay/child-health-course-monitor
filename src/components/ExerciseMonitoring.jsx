// components/ExerciseMonitoring.jsx
// Exercise monitoring for the IMCI implementation operational guide course
// (Program Management). It is what course monitoring shows for that course —
// the Monitoring tab, the monitoring page and the shared /monitor/course link —
// in place of the clinical case grid, the same way the CPCM course shows its
// OSCE checklists. The participant's name is on top and every exercise is a
// row under its day (Done / Not done + score + note). Each exercise is saved like every
// other monitored case: one `cases` document plus its `observations`, through
// upsertCaseAndObservations (one case per participant and exercise; marking it
// again edits that case).
import React, { useEffect, useMemo, useState } from 'react';
import { listCasesForCourse, upsertCaseAndObservations } from '../data.js';
import { Pencil } from 'lucide-react';
import { confirmDialog } from './dialogs';
import { Button, EmptyState, Select, SkeletonCard, Spinner } from './CommonComponents';

export const OPERATIONAL_GUIDE_SUBCOURSE = 'IMNCI implementation operational Guide';
export const isOperationalGuideCourse = (course) => {
    if (!course || course.course_type !== 'Program Management') return false;
    const subs = [
        ...(course.facilitatorAssignments || []).map(a => a.imci_sub_type),
        course.director_imci_sub_type, course.clinical_instructor_imci_sub_type,
    ].filter(Boolean);
    // A Program Management course with no sub-course recorded is treated as the operational guide.
    return subs.length === 0 || subs.some(s => String(s).includes(OPERATIONAL_GUIDE_SUBCOURSE));
};

// max = full score from the facilitator guide's answer key; null = Done / Not done only.
export const OPERATIONAL_GUIDE_EXERCISES = [
    { id: '1-1', day: 1, max: 3, title: 'التصنيف والمكونات والأولويات' },
    { id: '1-2', day: 1, max: 6, title: 'سلسلة النتائج' },
    { id: '2-2', day: 1, max: 3, title: 'صياغة مستهدفات ذكية' },
    { id: '3-2', day: 1, max: 3, title: 'استخدام لوحة المنصة في التخطيط' },
    { id: '4-2', day: 1, max: 3, title: 'صياغة رسالة مناصرة' },
    { id: '1-3', day: 2, max: 6, title: 'حساب الاحتياج التدريبي' },
    { id: '2-3', day: 2, max: 3, title: 'جدولة المتابعة والإرشاد' },
    { id: '1-4', day: 3, max: null, title: 'مسار الطفل' },
    { id: '1-5', day: 3, max: 4, title: 'حساب طلبية الربع (الاستمارة 8)' },
    { id: '2-5', day: 3, max: 4, title: 'تقدير احتياج الأموكسيسيلين' },
    { id: '1-6', day: 4, max: null, title: 'خفض التكلفة' },
    { id: '2-6', day: 4, max: 14, title: 'إعداد ميزانية دورة' },
    { id: '1-7', day: 4, max: 3, title: 'حساب المؤشرات ومقارنتها بالمستهدف' },
    { id: '2-7', day: 4, max: null, title: 'تحليل مشكلة' },
];
export const EXERCISE_SETTING = 'EXERCISE';
export const TOTAL_MAX = OPERATIONAL_GUIDE_EXERCISES.reduce((s, e) => s + (e.max || 0), 0);
export const DAYS = [1, 2, 3, 4];

// byExercise: { [exerciseId]: case }
export const summarize = (byExercise = {}) => {
    const done = OPERATIONAL_GUIDE_EXERCISES.filter(e => byExercise[e.id]?.exercise_status === 'done');
    const score = done.reduce((s, e) => s + (Number(byExercise[e.id]?.exercise_score) || 0), 0);
    return { count: done.length, score, pct: Math.round((score / TOTAL_MAX) * 100) };
};

export const exNo = (id) => <span dir="ltr" className="inline-block">{id}</span>;
export const pctClass = (pct, count) => count === 0 ? 'text-slate-400' : pct >= 75 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600';

// Same segmented toggle as the monitoring / OSCE steps.
function StatusToggle({ value, onChange }) {
    const options = [['تم', 'done', 'bg-green-600 border-green-600'], ['لم يتم', 'not_done', 'bg-red-600 border-red-600']];
    return (
        <div className="relative z-0 flex w-full sm:inline-flex sm:w-auto shadow-sm rounded-md sm:flex-shrink-0">
            {options.map(([label, val, activeClass], idx) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`relative inline-flex flex-1 sm:flex-none items-center justify-center px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium touch-manipulation focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 transition border border-gray-300 ${idx === 0 ? 'rounded-s-md' : '-ms-px rounded-e-md'} ${value === val ? `${activeClass} text-white` : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}

const StatusChip = ({ rec }) => {
    if (!rec) return <span className="text-xs text-slate-400">لم يُسجّل</span>;
    if (rec.exercise_status === 'not_done') return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700">لم يتم</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 tabular-nums">تم{rec.exercise_max != null && rec.exercise_score != null ? <> · <span dir="ltr">{rec.exercise_score}/{rec.exercise_max}</span></> : ''}</span>;
};

const blankRow = (rec) => ({ status: rec?.exercise_status || '', score: rec?.exercise_score ?? '', note: rec?.exercise_note || '' });
const sameRow = (a, b) => a.status === b.status && String(a.score ?? '') === String(b.score ?? '') && (a.note || '') === (b.note || '');

// The monitoring form for the operational guide course: the participant's
// name on top, then every exercise as a row under its day. A saved exercise
// shows its result with an Edit link; Save writes every changed row at once.
// Each exercise is still its own monitoring case (cases + observations).
export default function OperationalGuideExerciseMonitoring({ course, participant, participants = [], onChangeParticipant }) {
    const active = useMemo(() => participants.filter(p => !p.isDeleted), [participants]);
    const [cases, setCases] = useState(null);
    const [localPid, setLocalPid] = useState(participant?.id || active[0]?.id || '');
    const pid = participant?.id || localPid;
    const [rows, setRows] = useState({});       // exerciseId -> { status, score, note }
    const [editing, setEditing] = useState({}); // exerciseId -> true when a saved row is open for editing
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ text: '', ok: true });

    useEffect(() => {
        listCasesForCourse(course.id)
            .then(list => setCases(list.filter(c => c.setting === EXERCISE_SETTING)))
            .catch(() => setCases([]));
    }, [course.id]);

    const saved = useMemo(() => {
        const m = {};
        (cases || []).filter(c => c.participant_id === pid).forEach(c => { m[c.exercise_id] = c; });
        return m;
    }, [cases, pid]);

    // Fresh rows whenever the participant (or their saved data) changes.
    useEffect(() => {
        const r = {};
        OPERATIONAL_GUIDE_EXERCISES.forEach(e => { r[e.id] = blankRow(saved[e.id]); });
        setRows(r); setEditing({});
    }, [saved]);
    useEffect(() => { setMsg({ text: '', ok: true }); }, [pid]);

    const person = active.find(p => p.id === pid);
    const changed = OPERATIONAL_GUIDE_EXERCISES.filter(e => rows[e.id]?.status && !sameRow(rows[e.id], blankRow(saved[e.id])));
    const setRow = (id, patch) => setRows(r => ({ ...r, [id]: { ...r[id], ...patch } }));
    const pickParticipant = async (id) => {
        if (changed.length && !(await confirmDialog('توجد تعديلات غير محفوظة. هل تريد المتابعة بدون حفظ؟'))) return;
        if (onChangeParticipant) onChangeParticipant(id); else setLocalPid(id);
    };

    const saveAll = async () => {
        if (!person || changed.length === 0) return;
        setBusy(true); setMsg({ text: '', ok: true });
        const today = new Date().toISOString().slice(0, 10);
        const newCases = [];
        const merge = () => setCases(cs => [...(cs || []).filter(c => !newCases.some(n => n.id === c.id)), ...newCases]);
        try {
            for (const ex of changed) {
                const row = rows[ex.id];
                const done = row.status === 'done';
                const score = done && ex.max != null && row.score !== '' ? Math.min(Math.max(Number(row.score) || 0, 0), ex.max) : null;
                const prev = saved[ex.id];
                const encounter = prev?.encounter_date || today;
                const serial = OPERATIONAL_GUIDE_EXERCISES.findIndex(e => e.id === ex.id) + 1;
                const caseData = {
                    courseId: course.id, participant_id: person.id, encounter_date: encounter,
                    setting: EXERCISE_SETTING, age_group: 'OPERATIONAL_GUIDE', record_type: 'EXERCISE',
                    case_serial: serial, day_of_course: ex.day, allCorrect: done,
                    exercise_id: ex.id, exercise_title: ex.title, exercise_status: row.status,
                    exercise_score: score, exercise_max: ex.max, exercise_note: (row.note || '').slice(0, 1000),
                };
                const observation = {
                    courseId: course.id, course_type: course.course_type, encounter_date: encounter,
                    day_of_course: ex.day, setting: EXERCISE_SETTING, participant_id: person.id,
                    domain: 'operational_guide_exercise', item_recorded: ex.id, item_correct: done ? 1 : 0,
                    case_serial: serial, age_group: 'OPERATIONAL_GUIDE', score, max_score: ex.max,
                };
                const { savedCase } = await upsertCaseAndObservations(caseData, [observation], prev?.id || null);
                newCases.push(savedCase);
            }
            merge();
            setMsg({ text: `تم حفظ ${newCases.length} تمرين`, ok: true });
        } catch (e) {
            if (newCases.length) merge();
            setMsg({ text: `تعذر الحفظ: ${e?.message || ''}`, ok: false });
        } finally { setBusy(false); }
    };

    if (cases === null) return <SkeletonCard lines={6} />;
    if (active.length === 0) return <EmptyState message="Add participants to this course first." />;

    return (
        <div className="space-y-4 pb-28">
            {!participant && (
                <div className="max-w-md">
                    <Select label="Participant" value={pid} onChange={e => pickParticipant(e.target.value)}>
                        {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                </div>
            )}

            <div dir="rtl" className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="text-xs text-slate-500">استمارة متابعة تمارين المشارك — ورشة الدليل التشغيلي</div>
                    <h3 className="text-lg font-bold text-slate-800 mt-0.5">{person?.name}</h3>
                    {person?.job_title && <div className="text-sm text-slate-500">{person.job_title}</div>}
                </div>

                {DAYS.map(day => {
                    const list = OPERATIONAL_GUIDE_EXERCISES.filter(e => e.day === day);
                    const recorded = list.filter(e => saved[e.id]).length;
                    return (
                        <div key={day} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-sky-50 border-b border-sky-100">
                                <h4 className="text-sm sm:text-base font-bold text-slate-800">اليوم {day}</h4>
                                <span className={`text-xs font-semibold tabular-nums ${recorded === list.length ? 'text-green-700' : 'text-slate-500'}`} dir="ltr">{recorded}/{list.length}</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {list.map(ex => {
                                    const rec = saved[ex.id];
                                    const row = rows[ex.id] || blankRow(rec);
                                    const open = !rec || editing[ex.id];
                                    const pending = row.status && !sameRow(row, blankRow(rec));
                                    return (
                                        <div key={ex.id} className={`p-3 sm:px-5 ${pending ? 'bg-amber-50/70' : ''}`}>
                                            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-xs font-bold text-sky-700 me-2">تمرين {exNo(ex.id)}</span>
                                                    <span className="font-medium text-slate-700 break-words">{ex.title}</span>
                                                    <div className="text-xs text-slate-500">{ex.max != null ? `الدرجة الكاملة ${ex.max}` : 'بدون درجة'}</div>
                                                </div>
                                                {open ? (
                                                    <div className="flex items-center gap-2">
                                                        <StatusToggle value={row.status} onChange={v => setRow(ex.id, { status: v, score: v === 'done' ? row.score : '' })} />
                                                        {ex.max != null && (
                                                            <input type="number" inputMode="decimal" min="0" max={ex.max} placeholder={`من ${ex.max}`}
                                                                aria-label={`الدرجة من ${ex.max}`}
                                                                disabled={row.status !== 'done'} value={row.score}
                                                                onChange={e => setRow(ex.id, { score: e.target.value })}
                                                                className="w-20 shrink-0 border border-gray-300 rounded-md p-2 text-center focus:ring-2 focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-400" />
                                                        )}
                                                        {rec && (
                                                            <button type="button" className="shrink-0 text-sm font-semibold text-slate-500 hover:text-slate-700 px-1"
                                                                onClick={() => { setRow(ex.id, blankRow(rec)); setEditing(e => ({ ...e, [ex.id]: false })); }}>إلغاء</button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <StatusChip rec={rec} />
                                                        <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
                                                            onClick={() => setEditing(e => ({ ...e, [ex.id]: true }))}><Pencil size={14} /> تعديل</button>
                                                    </div>
                                                )}
                                            </div>
                                            {open && row.status && (
                                                <input value={row.note} onChange={e => setRow(ex.id, { note: e.target.value })} placeholder="ملاحظات الميسّر (اختياري)"
                                                    className="mt-2 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                                            )}
                                            {!open && rec?.exercise_note && <div className="mt-1 text-xs text-slate-500">ملاحظة: {rec.exercise_note}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
                <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3" dir="rtl">
                    <div className="text-sm">
                        <div className="font-bold text-slate-800">{changed.length ? `${changed.length} تمرين بانتظار الحفظ` : 'لا توجد تعديلات'}</div>
                        {msg.text && <div className={`text-xs font-semibold ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</div>}
                    </div>
                    <div className="ms-auto">
                        <Button onClick={saveAll} disabled={busy || !person || changed.length === 0}>{busy ? <Spinner size="sm" /> : 'Save'}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
