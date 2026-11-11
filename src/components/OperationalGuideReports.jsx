// components/OperationalGuideReports.jsx
// Reports for the IMCI implementation operational guide course (Program
// Management): exercise KPIs for the course report, the exercise table for the
// individual participant report, and the daily evaluation results dashboard.
// Exercise results are the monitoring cases with setting 'EXERCISE' (see
// ExerciseMonitoring.jsx); evaluation answers are dailyEvalResponses.
import React, { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { ClipboardCheck, MessageSquareText, Users } from 'lucide-react';
import './chartSetup';
import { CHART_COLORS } from './chartSetup';
import { listDailyEvalForms, listDailyEvalResponses } from '../data.js';
import { Card, EmptyState, Select, SkeletonCard } from './CommonComponents';
import { DAYS, EXERCISE_SETTING, OPERATIONAL_GUIDE_EXERCISES, TOTAL_MAX, exNo, pctClass, summarize } from './ExerciseMonitoring.jsx';
import { DEFAULT_GENERAL } from './DailyEvaluation.jsx';

const Kpi = ({ label, value, sub, tone = 'text-slate-800' }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${tone}`} dir="ltr">{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
);

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// records[participantId][exerciseId] = case
export const exerciseRecords = (cases = []) => {
    const m = {};
    cases.filter(c => c.setting === EXERCISE_SETTING && c.isDeleted !== true).forEach(c => { (m[c.participant_id] ||= {})[c.exercise_id] = c; });
    return m;
};

// ---------------------------------------------------------------------------
// Course report: exercise KPIs
// ---------------------------------------------------------------------------
export function ExerciseKpiCard({ participants = [], cases = [] }) {
    const active = participants.filter(p => !p.isDeleted);
    const records = useMemo(() => exerciseRecords(cases), [cases]);
    const perParticipant = active.map(p => summarize(records[p.id]));
    const n = active.length;
    const totalDone = perParticipant.reduce((s, x) => s + x.count, 0);
    const avgScorePct = n ? Math.round(perParticipant.reduce((s, x) => s + x.pct, 0) / n) : 0;
    const allDone = perParticipant.filter(x => x.count === OPERATIONAL_GUIDE_EXERCISES.length).length;
    const recorded = Object.values(records).reduce((s, r) => s + Object.keys(r).length, 0);

    const perExercise = OPERATIONAL_GUIDE_EXERCISES.map(ex => {
        const recs = active.map(p => records[p.id]?.[ex.id]).filter(Boolean);
        const done = recs.filter(r => r.exercise_status === 'done');
        const scored = done.filter(r => r.exercise_score != null);
        const avg = ex.max && scored.length ? scored.reduce((s, r) => s + Number(r.exercise_score), 0) / scored.length : null;
        return { ex, done: done.length, recorded: recs.length, completion: pct(done.length, n), avgPct: avg != null ? Math.round((avg / ex.max) * 100) : null, avg };
    });

    const chartData = {
        labels: perExercise.map(r => r.ex.id),
        datasets: [
            { label: 'Completion %', data: perExercise.map(r => r.completion), backgroundColor: CHART_COLORS[0] },
            { label: 'Average score %', data: perExercise.map(r => r.avgPct ?? 0), backgroundColor: CHART_COLORS[1] },
        ],
    };

    return (
        <Card>
            <div id="operational-guide-exercise-kpis" className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-sky-600" />
                    <h3 className="text-xl font-bold">Exercise KPIs (operational guide)</h3>
                </div>
                {recorded === 0 ? (
                    <EmptyState message="No exercise has been recorded in course monitoring yet." />
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Kpi label="Exercises completed" value={`${pct(totalDone, n * OPERATIONAL_GUIDE_EXERCISES.length)}%`} sub={`${totalDone} of ${n * OPERATIONAL_GUIDE_EXERCISES.length}`} />
                            <Kpi label="Average score" value={`${avgScorePct}%`} sub={`of ${TOTAL_MAX} marks`} tone={pctClass(avgScorePct, totalDone)} />
                            <Kpi label="Completed all 14" value={allDone} sub={`of ${n} participants`} />
                            <Kpi label="Records entered" value={recorded} sub="in course monitoring" />
                        </div>
                        <div className="h-64">
                            <Bar data={chartData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } } }, plugins: { legend: { position: 'bottom' }, datalabels: { display: false } } }} />
                        </div>
                        <div className="overflow-x-auto border border-gray-200 rounded-lg" dir="rtl">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-100 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2 text-start font-semibold">التمرين</th>
                                        <th className="px-3 py-2 font-semibold">اليوم</th>
                                        <th className="px-3 py-2 font-semibold">نسبة الإنجاز</th>
                                        <th className="px-3 py-2 font-semibold">متوسط الدرجة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {perExercise.map(r => (
                                        <tr key={r.ex.id}>
                                            <td className="px-3 py-2"><span className="text-xs font-bold text-sky-700 me-2">{exNo(r.ex.id)}</span>{r.ex.title}</td>
                                            <td className="px-3 py-2 text-center">{r.ex.day}</td>
                                            <td className={`px-3 py-2 text-center font-semibold tabular-nums ${pctClass(r.completion, r.recorded)}`} dir="ltr">{r.completion}% <span className="text-xs font-normal text-slate-500">({r.done}/{n})</span></td>
                                            <td className="px-3 py-2 text-center tabular-nums" dir="ltr">{r.ex.max == null ? '—' : r.avg == null ? '–' : `${r.avg.toFixed(1)} / ${r.ex.max}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Individual participant report: every participant x every exercise
// ---------------------------------------------------------------------------
export function ExerciseParticipantReport({ participants = [], allCases = [] }) {
    const active = participants.filter(p => !p.isDeleted);
    const records = useMemo(() => exerciseRecords(allCases), [allCases]);
    if (active.length === 0) return <EmptyState message="Add participants to this course first." />;
    const cell = (r) => !r ? <span className="text-slate-300">—</span>
        : r.exercise_status === 'not_done' ? <span className="text-red-600 font-semibold">✗</span>
        : <span className="text-green-700 font-semibold" dir="ltr">{r.exercise_max != null && r.exercise_score != null ? r.exercise_score : '✓'}</span>;
    return (
        <div className="p-4 space-y-3">
            <h3 className="text-lg font-bold text-slate-800">Exercises by participant</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg no-scroll-wrapper" dir="rtl">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th rowSpan={2} className="px-3 py-2 text-start font-semibold sticky-col bg-gray-100">المشارك</th>
                            {DAYS.map(d => <th key={d} colSpan={OPERATIONAL_GUIDE_EXERCISES.filter(e => e.day === d).length} className="px-2 py-1 font-semibold border-s border-gray-200">اليوم {d}</th>)}
                            <th rowSpan={2} className="px-2 py-2 font-semibold border-s border-gray-200">المكتملة</th>
                            <th rowSpan={2} className="px-2 py-2 font-semibold">الدرجة</th>
                            <th rowSpan={2} className="px-2 py-2 font-semibold">%</th>
                        </tr>
                        <tr>
                            {OPERATIONAL_GUIDE_EXERCISES.map(e => <th key={e.id} title={e.title} className="px-2 py-1 text-xs font-semibold whitespace-nowrap">{exNo(e.id)}{e.max != null && <span className="block text-xs font-normal text-slate-500" dir="ltr">/{e.max}</span>}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {active.map(p => { const s = summarize(records[p.id]); return (
                            <tr key={p.id}>
                                <td className="px-3 py-2 text-gray-800 min-w-[9rem] sticky-col bg-white">{p.name}</td>
                                {OPERATIONAL_GUIDE_EXERCISES.map(e => <td key={e.id} className="px-2 py-2 text-center tabular-nums">{cell(records[p.id]?.[e.id])}</td>)}
                                <td className="px-2 py-2 text-center tabular-nums border-s border-gray-200" dir="ltr">{s.count}/{OPERATIONAL_GUIDE_EXERCISES.length}</td>
                                <td className="px-2 py-2 text-center tabular-nums" dir="ltr">{s.score}/{TOTAL_MAX}</td>
                                <td className={`px-2 py-2 text-center font-semibold tabular-nums ${pctClass(s.pct, s.count)}`} dir="ltr">{s.pct}%</td>
                            </tr>); })}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-slate-500">Score shown for done exercises that carry marks, ✓ done without marks, ✗ not done, — not recorded yet.</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Daily evaluation results dashboard
// ---------------------------------------------------------------------------
const CRITERIA = [['method', 'منهجية العرض'], ['info', 'معلومات جديدة'], ['practical', 'الاستفادة في العمل']];
const APPLY_LABELS = { very_high: 'كبيرة جدًا', high: 'كبيرة', medium: 'متوسطة', low: 'قليلة' };
const avg = (vals) => { const v = vals.filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const scoreTone = (a) => a == null ? 'text-slate-400' : a >= 4 ? 'text-emerald-600' : a >= 3 ? 'text-amber-600' : 'text-red-600';
const fmt = (a) => (a == null ? '–' : a.toFixed(1));

function ScoreBar({ value }) {
    const w = value == null ? 0 : (value / 5) * 100;
    const color = value == null ? 'bg-slate-200' : value >= 4 ? 'bg-emerald-500' : value >= 3 ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2 min-w-[7rem]">
            <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden"><div className={`h-2 ${color}`} style={{ width: `${w}%` }} /></div>
            <span className={`w-8 text-xs font-semibold tabular-nums ${scoreTone(value)}`} dir="ltr">{fmt(value)}</span>
        </div>
    );
}

export function DailyEvaluationDashboard({ course }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [formId, setFormId] = useState('');

    useEffect(() => {
        Promise.all([listDailyEvalForms(course.id), listDailyEvalResponses(course.id)])
            .then(([forms, responses]) => {
                forms.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                setData({ forms, responses });
                // Open on the latest day that already has answers.
                const withAnswers = forms.filter(f => responses.some(r => r.formId === f.id));
                const pick = withAnswers[withAnswers.length - 1] || forms[forms.length - 1];
                if (pick) setFormId(pick.id);
            })
            .catch(e => { setError(e?.message || 'Could not load the evaluation results.'); setData({ forms: [], responses: [] }); });
    }, [course.id]);

    const form = data?.forms.find(f => f.id === formId);
    const responses = useMemo(() => (data?.responses || []).filter(r => r.formId === formId), [data, formId]);

    const lectureRows = useMemo(() => (form?.lectures || []).map(l => {
        const per = CRITERIA.map(([k]) => avg(responses.map(r => r.lectures?.[l.id]?.[k])));
        return { l, per, overall: avg(per.filter(x => x != null)) };
    }), [form, responses]);
    const generalRows = useMemo(() => (form?.general || DEFAULT_GENERAL.map((t, i) => ({ id: `g${i + 1}`, text: t }))).map(g => ({ g, value: avg(responses.map(r => r.general?.[g.id])) })), [form, responses]);
    const applyCounts = useMemo(() => {
        const c = { very_high: 0, high: 0, medium: 0, low: 0 };
        responses.forEach(r => { if (c[r.applyLevel] != null) c[r.applyLevel] += 1; });
        return c;
    }, [responses]);
    const applyAnswered = Object.values(applyCounts).reduce((a, b) => a + b, 0);
    const overallLectures = avg(lectureRows.map(r => r.overall).filter(x => x != null));
    const overallGeneral = avg(generalRows.map(r => r.value).filter(x => x != null));
    const texts = (key) => responses.map(r => (r[key] || '').trim()).filter(Boolean);

    if (!data) return <SkeletonCard lines={6} />;
    if (error) return <Card><div className="p-4"><EmptyState message={error} /></div></Card>;
    if (data.forms.length === 0) return <Card><div className="p-4"><EmptyState message="No daily evaluation has been shared for this course yet. Share one from the course's Share button." /></div></Card>;

    return (
        <div className="space-y-4" dir="rtl">
            <Card>
                <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-end gap-3 justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">نتائج التقييم اليومي</h3>
                            <p className="text-sm text-slate-500">Daily evaluation results · answers are anonymous</p>
                        </div>
                        <div className="w-full sm:w-72">
                            <Select label="اليوم" value={formId} onChange={e => setFormId(e.target.value)}>
                                {data.forms.map(f => <option key={f.id} value={f.id}>اليوم {f.dayNumber} · {f.date} ({data.responses.filter(r => r.formId === f.id).length})</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <Kpi label="عدد الاستمارات" value={responses.length} sub={<span className="inline-flex items-center gap-1"><Users size={12} /> مجهولة الاسم</span>} />
                        <Kpi label="متوسط تقييم المحاضرات" value={overallLectures == null ? '—' : `${fmt(overallLectures)} / 5`} tone={scoreTone(overallLectures)} />
                        <Kpi label="متوسط التقييم العام" value={overallGeneral == null ? '—' : `${fmt(overallGeneral)} / 5`} tone={scoreTone(overallGeneral)} />
                        <Kpi label="استفادة كبيرة أو كبيرة جدًا" value={`${pct(applyCounts.very_high + applyCounts.high, applyAnswered)}%`} sub={`${applyAnswered} إجابة`} />
                    </div>
                </div>
            </Card>

            {responses.length === 0 ? (
                <Card><div className="p-4"><EmptyState message="لم تصل أي إجابة لهذا اليوم بعد." /></div></Card>
            ) : (
                <>
                    {lectureRows.length > 0 && (
                        <Card>
                            <div className="p-4 space-y-3">
                                <h4 className="font-bold text-slate-800">أولًا: تقييم المحاضرات (من 5)</h4>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 text-gray-700">
                                            <tr>
                                                <th className="px-3 py-2 text-start font-semibold">المحاضرة</th>
                                                {CRITERIA.map(([k, label]) => <th key={k} className="px-3 py-2 font-semibold whitespace-nowrap">{label}</th>)}
                                                <th className="px-3 py-2 font-semibold">المتوسط</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {lectureRows.map(({ l, per, overall }, i) => (
                                                <tr key={l.id}>
                                                    <td className="px-3 py-2 text-slate-800 min-w-[12rem]">{i + 1}. {l.text}</td>
                                                    {per.map((v, j) => <td key={j} className="px-3 py-2"><ScoreBar value={v} /></td>)}
                                                    <td className={`px-3 py-2 text-center font-bold tabular-nums ${scoreTone(overall)}`} dir="ltr">{fmt(overall)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <div className="p-4 space-y-3">
                                <h4 className="font-bold text-slate-800">ثانيًا: التقييم العام لليوم (من 5)</h4>
                                <div className="divide-y divide-slate-100">
                                    {generalRows.map(({ g, value }) => (
                                        <div key={g.id} className="flex items-center justify-between gap-3 py-2">
                                            <span className="text-sm text-slate-700 min-w-0 flex-1">{g.text}</span>
                                            <div className="w-40"><ScoreBar value={value} /></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="p-4 space-y-3">
                                <h4 className="font-bold text-slate-800">ثالثًا: الاستفادة في تطبيق العلاج المتكامل</h4>
                                <div className="space-y-2">
                                    {Object.entries(APPLY_LABELS).map(([k, label]) => (
                                        <div key={k} className="flex items-center gap-3">
                                            <span className="w-24 text-sm text-slate-700">{label}</span>
                                            <div className="flex-1 h-2.5 rounded bg-slate-100 overflow-hidden"><div className="h-2.5 bg-sky-500" style={{ width: `${pct(applyCounts[k], applyAnswered)}%` }} /></div>
                                            <span className="w-16 text-xs font-semibold tabular-nums text-slate-600" dir="ltr">{applyCounts[k]} ({pct(applyCounts[k], applyAnswered)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <div className="p-4 space-y-4">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquareText className="w-5 h-5 text-sky-600" /> رابعًا: ملاحظات ومقترحات</h4>
                            {[['applyText', 'شيء سيطبقه المشارك في عمله'], ['difficulty', 'أجزاء صعبة الفهم'], ['suggestions', 'مقترحات لتحسين الأيام القادمة']].map(([key, label]) => {
                                const list = texts(key);
                                return (
                                    <div key={key}>
                                        <div className="text-sm font-semibold text-slate-700 mb-1">{label} <span className="text-xs font-normal text-slate-500">({list.length})</span></div>
                                        {list.length === 0 ? <div className="text-sm text-slate-400">—</div> : (
                                            <ul className="space-y-1">
                                                {list.map((txt, i) => <li key={i} className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">{txt}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// One participant's report: KPIs + every exercise by day
// ---------------------------------------------------------------------------
export function ParticipantExerciseCard({ cases = [] }) {
    const byEx = useMemo(() => {
        const m = {};
        cases.filter(c => c.setting === EXERCISE_SETTING && c.isDeleted !== true).forEach(c => { m[c.exercise_id] = c; });
        return m;
    }, [cases]);
    const s = summarize(byEx);
    return (
        <div className="space-y-3" dir="rtl">
            <h3 className="text-lg font-bold text-slate-800">التمارين (الدليل التشغيلي)</h3>
            <div className="grid grid-cols-3 gap-3">
                <Kpi label="التمارين المكتملة" value={`${s.count} / ${OPERATIONAL_GUIDE_EXERCISES.length}`} />
                <Kpi label="الدرجة" value={`${s.score} / ${TOTAL_MAX}`} />
                <Kpi label="النسبة" value={`${s.pct}%`} tone={pctClass(s.pct, s.count)} />
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr><th className="px-3 py-2 text-start font-semibold">التمرين</th><th className="px-3 py-2 font-semibold">الحالة</th><th className="px-3 py-2 font-semibold">الدرجة</th><th className="px-3 py-2 text-start font-semibold">ملاحظات</th></tr>
                    </thead>
                    {DAYS.map(d => (
                        <tbody key={d} className="divide-y divide-gray-200 bg-white">
                            <tr className="bg-sky-50"><td colSpan={4} className="px-3 py-1.5 text-sm font-bold text-slate-700">اليوم {d}</td></tr>
                            {OPERATIONAL_GUIDE_EXERCISES.filter(e => e.day === d).map(e => { const r = byEx[e.id]; return (
                                <tr key={e.id}>
                                    <td className="px-3 py-2"><span className="text-xs font-bold text-sky-700 me-2">{exNo(e.id)}</span>{e.title}</td>
                                    <td className="px-3 py-2 text-center">{!r ? <span className="text-slate-400">—</span> : r.exercise_status === 'done' ? <span className="text-green-700 font-semibold">تم</span> : <span className="text-red-600 font-semibold">لم يتم</span>}</td>
                                    <td className="px-3 py-2 text-center tabular-nums" dir="ltr">{e.max == null ? '—' : r?.exercise_score != null ? `${r.exercise_score} / ${e.max}` : `– / ${e.max}`}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{r?.exercise_note || ''}</td>
                                </tr>); })}
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    );
}
