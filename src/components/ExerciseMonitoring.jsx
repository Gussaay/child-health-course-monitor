// components/ExerciseMonitoring.jsx
// Exercise monitoring for the IMCI implementation operational guide course
// (Program Management). It is what course monitoring shows for that course —
// the Monitoring tab, the monitoring page and the shared /monitor/course link —
// in place of the clinical case grid, the same way the CPCM course shows its
// OSCE checklists. The facilitator picks the day and the exercise, marks Done /
// Not done, enters the score and a note. Each exercise is saved like every
// other monitored case: one `cases` document plus its `observations`, through
// upsertCaseAndObservations (one case per participant and exercise; marking it
// again edits that case).
import React, { useEffect, useMemo, useState } from 'react';
import { listCasesForCourse, upsertCaseAndObservations } from '../data.js';
import { Button, Card, CardBody, EmptyState, Input, Spinner, Textarea } from './CommonComponents';

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
const TOTAL_MAX = OPERATIONAL_GUIDE_EXERCISES.reduce((s, e) => s + (e.max || 0), 0);
const DAYS = [1, 2, 3, 4];

// byExercise: { [exerciseId]: case }
export const summarize = (byExercise = {}) => {
    const done = OPERATIONAL_GUIDE_EXERCISES.filter(e => byExercise[e.id]?.exercise_status === 'done');
    const score = done.reduce((s, e) => s + (Number(byExercise[e.id]?.exercise_score) || 0), 0);
    return { count: done.length, score, pct: Math.round((score / TOTAL_MAX) * 100) };
};

const chip = (on) => `px-3 py-1.5 rounded-lg border text-sm ${on ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-700 border-gray-300'}`;

export default function OperationalGuideExerciseMonitoring({ course, participant, participants = [], onChangeParticipant }) {
    const active = useMemo(() => participants.filter(p => !p.isDeleted), [participants]);
    const [cases, setCases] = useState(null);
    const [tab, setTab] = useState('enter');
    const [day, setDay] = useState(1);
    const [exId, setExId] = useState(OPERATIONAL_GUIDE_EXERCISES[0].id);
    const [localPid, setLocalPid] = useState(participant?.id || active[0]?.id || '');
    const pid = participant?.id || localPid;
    const [form, setForm] = useState({ status: '', score: '', note: '' });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    const load = () => listCasesForCourse(course.id)
        .then(list => setCases(list.filter(c => c.setting === EXERCISE_SETTING)))
        .catch(() => setCases([]));
    useEffect(() => { load(); }, [course.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // records[participantId][exerciseId] = case
    const records = useMemo(() => {
        const m = {};
        (cases || []).forEach(c => { (m[c.participant_id] ||= {})[c.exercise_id] = c; });
        return m;
    }, [cases]);

    const ex = OPERATIONAL_GUIDE_EXERCISES.find(e => e.id === exId);
    const current = records[pid]?.[exId];
    const person = active.find(p => p.id === pid);

    useEffect(() => {
        setForm({ status: current?.exercise_status || '', score: current?.exercise_score ?? '', note: current?.exercise_note || '' });
        setMsg('');
    }, [pid, exId, current]);

    const pickParticipant = (id) => { if (onChangeParticipant) onChangeParticipant(id); else setLocalPid(id); };
    const pickDay = (d) => { setDay(d); setExId(OPERATIONAL_GUIDE_EXERCISES.find(e => e.day === d).id); };

    const save = async () => {
        if (!person || !form.status) { setMsg('اختر المشارك وحالة التمرين'); return; }
        const done = form.status === 'done';
        const score = done && ex.max != null && form.score !== '' ? Math.min(Math.max(Number(form.score) || 0, 0), ex.max) : null;
        const today = new Date().toISOString().slice(0, 10);
        const serial = OPERATIONAL_GUIDE_EXERCISES.findIndex(e => e.id === ex.id) + 1;
        const caseData = {
            courseId: course.id, participant_id: person.id, encounter_date: current?.encounter_date || today,
            setting: EXERCISE_SETTING, age_group: 'OPERATIONAL_GUIDE', record_type: 'EXERCISE',
            case_serial: serial, day_of_course: ex.day, allCorrect: done,
            exercise_id: ex.id, exercise_title: ex.title, exercise_status: form.status,
            exercise_score: score, exercise_max: ex.max, exercise_note: form.note.slice(0, 1000),
        };
        const observation = {
            courseId: course.id, course_type: course.course_type, encounter_date: caseData.encounter_date,
            day_of_course: ex.day, setting: EXERCISE_SETTING, participant_id: person.id,
            domain: 'operational_guide_exercise', item_recorded: ex.id, item_correct: done ? 1 : 0,
            case_serial: serial, age_group: 'OPERATIONAL_GUIDE', score, max_score: ex.max,
        };
        setBusy(true); setMsg('');
        try {
            const { savedCase } = await upsertCaseAndObservations(caseData, [observation], current?.id || null);
            setCases(cs => [...(cs || []).filter(c => c.id !== savedCase.id), { ...savedCase }]);
            setMsg('✅ تم الحفظ');
        } catch (e) {
            setMsg(`تعذر الحفظ: ${e?.message || ''}`);
        } finally { setBusy(false); }
    };

    if (cases === null) return <div className="p-10 flex justify-center"><Spinner /></div>;
    if (active.length === 0) return <EmptyState message="Add participants to this course first." />;

    return (
        <div className="max-w-2xl mx-auto" dir="rtl">
            <Card>
                <CardBody className="space-y-4">
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-gray-900">متابعة تمارين المشاركين</h2>
                        <div className="text-sm text-gray-600">ورشة التدريب على الدليل التشغيلي لتطبيق العلاج المتكامل</div>
                    </div>
                    <div className="flex gap-2 justify-center">
                        <button type="button" className={chip(tab === 'enter')} onClick={() => setTab('enter')}>تسجيل</button>
                        <button type="button" className={chip(tab === 'summary')} onClick={() => setTab('summary')}>الملخص</button>
                    </div>

                    {tab === 'enter' && (
                        <>
                            {!participant && (
                                <label className="text-xs text-gray-600 block">المشارك
                                    <select value={pid} onChange={e => pickParticipant(e.target.value)} className="w-full border rounded py-2 px-2 text-sm bg-white">
                                        {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </label>
                            )}
                            {person && <div className="font-semibold text-sm">{person.name} <span className="text-xs text-gray-500">{[person.job_title, person.state, person.locality].filter(Boolean).join(' · ')}</span></div>}
                            <div>
                                <div className="text-xs text-gray-600 mb-1">اليوم</div>
                                <div className="flex gap-2 flex-wrap">{DAYS.map(d => <button key={d} type="button" className={chip(day === d)} onClick={() => pickDay(d)}>اليوم {d}</button>)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-600 mb-1">التمرين</div>
                                <div className="flex gap-2 flex-wrap">
                                    {OPERATIONAL_GUIDE_EXERCISES.filter(e => e.day === day).map(e => {
                                        const st = records[pid]?.[e.id]?.exercise_status;
                                        return <button key={e.id} type="button" className={chip(exId === e.id)} onClick={() => setExId(e.id)}>تمرين {e.id}{st === 'done' ? ' ✓' : st === 'not_done' ? ' ✗' : ''}</button>;
                                    })}
                                </div>
                                <div className="text-sm mt-1 text-gray-800">{ex.title}{ex.max != null ? ` — الدرجة الكاملة ${ex.max}` : ' — بدون درجة'}</div>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" className={chip(form.status === 'done')} onClick={() => setForm({ ...form, status: 'done' })}>تم</button>
                                <button type="button" className={chip(form.status === 'not_done')} onClick={() => setForm({ ...form, status: 'not_done', score: '' })}>لم يتم</button>
                            </div>
                            {form.status === 'done' && ex.max != null && (
                                <label className="text-xs text-gray-600 block">الدرجة (من {ex.max})
                                    <Input type="number" min="0" max={ex.max} value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} className="text-sm" />
                                </label>
                            )}
                            <label className="text-xs text-gray-600 block">ملاحظات الميسّر<Textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
                            <Button onClick={save} disabled={busy} className="w-full">{busy ? '…' : 'حفظ'}</Button>
                            {msg && <div className="text-sm text-center">{msg}</div>}
                            <div className="text-xs text-gray-600 border-t pt-2">
                                {(() => { const s = summarize(records[pid]); return `التمارين المكتملة ${s.count} من ${OPERATIONAL_GUIDE_EXERCISES.length} · المجموع ${s.score} من ${TOTAL_MAX} · ${s.pct}%`; })()}
                            </div>
                        </>
                    )}

                    {tab === 'summary' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border">
                                <thead className="bg-gray-50"><tr><th className="p-2 text-start">المشارك</th><th className="p-2">المكتملة</th><th className="p-2">المجموع/{TOTAL_MAX}</th><th className="p-2">%</th></tr></thead>
                                <tbody>
                                    {active.map(p => { const s = summarize(records[p.id]); return (
                                        <tr key={p.id} className="border-t cursor-pointer" onClick={() => { pickParticipant(p.id); setTab('enter'); }}>
                                            <td className="p-2">{p.name}</td><td className="p-2 text-center">{s.count}/{OPERATIONAL_GUIDE_EXERCISES.length}</td><td className="p-2 text-center">{s.score}</td><td className="p-2 text-center">{s.pct}%</td>
                                        </tr>); })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
