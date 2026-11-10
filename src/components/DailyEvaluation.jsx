// components/DailyEvaluation.jsx
// Anonymous daily evaluation form for the IMCI operational guide training.
// Staff set the day and the lectures / general items in the Share dialog, the
// setup is saved in `dailyEvalForms/{courseId}_{date}` and the public link
// /public/evaluation/{courseId}_{date} shows it to anyone, signed in or not.
import React, { useEffect, useState } from 'react';
import { getCourseById, getDailyEvalForm, saveDailyEvalForm, submitDailyEvalResponse } from '../data.js';
import { Button, Card, CardBody, CardFooter, Input, Spinner, Textarea } from './CommonComponents';
import { Plus, Trash2 } from 'lucide-react';

export const evalFormId = (courseId, date) => `${courseId}_${date}`;

const L = (id, text) => ({ id, text });
// Defaults come from the printed daily evaluation form of the operational guide workshop.
export const DEFAULT_LECTURES = {
    1: ['لماذا العلاج المتكامل؟', 'مراضة ووفيات الأطفال والتدخلات الفعالة', 'الحوكمة والأدوار وآليات التنسيق', 'التخطيط لتنفيذ الاستراتيجية', 'المناصرة وحشد الموارد وبناء الشراكات'],
    2: ['مسارات التدريب وسجل الاحتياج التدريبي', 'التحضير للدورة والدورات القياسية والمجتمعية', 'منصة معلومات صحة الطفل وإضافة دورة جديدة', 'المتابعة بعد التدريب والإرشاد السريري', 'التدريب قبل الخدمة والمطبوعات والشهادات'],
    3: ['جاهزية المرفق والإشراف الداعم', 'مسار الطفل المتكامل والإحالة', 'الإمداد بالأدوية والمستلزمات'],
    4: ['إدارة الموارد المالية وحساب التكلفة', 'الدورة المستندية والتقارير وجودة البيانات', 'المؤشرات واستخدام البيانات والاجتماع الشهري', 'خطط المتابعة بعد التدريب لكل ولاية'],
};
export const DEFAULT_GENERAL = ['القاعة (المساحة، الإضاءة، التهوية، الصوت)', 'الأكل والمشروبات', 'الزمن (الالتزام بالمواعيد وتوزيع الوقت)', 'الأمثلة', 'التمارين'];

export const makeDefaultConfig = (courseId, date, dayNumber = 1) => ({
    courseId, date, dayNumber,
    lectures: (DEFAULT_LECTURES[dayNumber] || []).map((t, i) => L(`l${i + 1}`, t)),
    general: DEFAULT_GENERAL.map((t, i) => L(`g${i + 1}`, t)),
});

const LECTURE_CRITERIA = [
    { key: 'method', label: 'منهجية العرض' },
    { key: 'info', label: 'معرفة معلومات جديدة' },
    { key: 'practical', label: 'مدى الاستفادة في عملي' },
];
const SCALE5 = [[5, 'ممتاز'], [4, 'جيد جدًا'], [3, 'جيد'], [2, 'مقبول'], [1, 'ضعيف']];
const APPLY = [['very_high', 'كبيرة جدًا'], ['high', 'كبيرة'], ['medium', 'متوسطة'], ['low', 'قليلة']];

const nextId = (items, p) => `${p}${items.reduce((m, x) => Math.max(m, parseInt(String(x.id).slice(1), 10) || 0), 0) + 1}`;

// ---------- Editor used inside the Share dialog ----------
export const DailyEvaluationShare = ({ course, onShare, canEdit = true }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [cfg, setCfg] = useState(() => makeDefaultConfig(course.id, date, 1));
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Reload an existing setup when the date changes.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const saved = await getDailyEvalForm(evalFormId(course.id, date));
                if (cancelled) return;
                if (saved) setCfg({ ...saved, date });
                else setCfg(c => ({ ...c, date, courseId: course.id }));
            } catch { /* new form */ }
        })();
        return () => { cancelled = true; };
    }, [course.id, date]);

    const setDay = (n) => setCfg(makeDefaultConfig(course.id, date, n));
    const upd = (key, id, text) => setCfg(c => ({ ...c, [key]: c[key].map(x => x.id === id ? { ...x, text } : x) }));
    const del = (key, id) => setCfg(c => ({ ...c, [key]: c[key].filter(x => x.id !== id) }));
    const add = (key, p) => setCfg(c => ({ ...c, [key]: [...c[key], L(nextId(c[key], p), '')] }));

    const share = async () => {
        setBusy(true); setError('');
        try {
            const clean = {
                courseId: course.id, date, dayNumber: Number(cfg.dayNumber) || 1,
                lectures: cfg.lectures.filter(x => x.text.trim()).map(x => ({ id: x.id, text: x.text.trim() })),
                general: cfg.general.filter(x => x.text.trim()).map(x => ({ id: x.id, text: x.text.trim() })),
                courseType: course.course_type || '', state: course.state || '', locality: course.locality || '',
            };
            await saveDailyEvalForm(evalFormId(course.id, date), clean);
            onShare(evalFormId(course.id, date), clean.dayNumber);
        } catch (e) {
            setError(e?.message || 'Could not save the form');
        } finally { setBusy(false); }
    };

    const rows = (key, p, title) => (
        <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-600">{title}</div>
            {cfg[key].map(x => (
                <div key={x.id} className="flex gap-2">
                    <Input value={x.text} onChange={e => upd(key, x.id, e.target.value)} className="py-1 text-sm flex-1" dir="auto" />
                    <button type="button" onClick={() => del(key, x.id)} className="text-red-500 p-1" aria-label="Remove"><Trash2 size={14} /></button>
                </div>
            ))}
            <Button variant="secondary" size="sm" className="flex items-center gap-1" onClick={() => add(key, p)}><Plus size={14} /> Add</Button>
        </div>
    );

    return (
        <div className="bg-gray-50 p-3 rounded border space-y-3">
            <span className="text-sm font-semibold block">Daily Evaluation Form (anonymous)</span>
            <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">Date
                    <Input type="date" value={date} min={undefined} onChange={e => setDate(e.target.value)} className="py-1 text-sm" />
                </label>
                <label className="text-xs text-gray-600">Day
                    <select value={cfg.dayNumber} onChange={e => setDay(Number(e.target.value))} className="w-full border rounded py-1.5 px-2 text-sm bg-white">
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>Day {n}</option>)}
                    </select>
                </label>
            </div>
            <button type="button" className="text-xs text-sky-700 underline" onClick={() => setOpen(o => !o)}>
                {open ? 'Hide' : 'Edit'} lectures and general items ({cfg.lectures.length} + {cfg.general.length})
            </button>
            {open && (
                <div className="space-y-4">
                    {rows('lectures', 'l', 'Lectures of the day')}
                    {rows('general', 'g', 'General evaluation items')}
                </div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <Button variant="secondary" size="sm" disabled={busy || !canEdit} onClick={share}>{busy ? 'Saving…' : 'Save & share link'}</Button>
        </div>
    );
};

// ---------- Public form ----------
const Choice = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-1.5">
        {options.map(([v, label]) => (
            <button key={v} type="button" onClick={() => onChange(v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs ${value === v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                {label}
            </button>
        ))}
    </div>
);

export const PublicDailyEvaluationView = ({ formId }) => {
    const [state, setState] = useState({ loading: true, cfg: null, course: null });
    const [ans, setAns] = useState({ lectures: {}, general: {} });
    const [meta, setMeta] = useState({ stateLocality: '', job: '', applyLevel: '', applyText: '', difficulty: '', suggestions: '' });
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const cfg = await getDailyEvalForm(formId);
                if (!cfg) { setState({ loading: false, cfg: null }); return; }
                let course = null;
                try { course = await getCourseById(cfg.courseId); } catch { /* optional */ }
                setState({ loading: false, cfg, course });
            } catch { setState({ loading: false, cfg: null }); }
        })();
    }, [formId]);

    if (state.loading) return <div className="p-10 flex justify-center"><Spinner /></div>;
    const { cfg, course } = state;
    if (!cfg) return <Card><div className="p-4 text-center text-red-600 font-semibold">النموذج غير متاح / Form not found</div></Card>;
    if (sent) return <Card><div className="p-8 text-center"><div className="text-3xl mb-2">✅</div><div className="font-bold text-gray-800">شكرًا لمشاركتك — تم إرسال التقييم</div><div className="text-sm text-gray-500 mt-1">Thank you, your evaluation was sent.</div></div></Card>;

    const setL = (id, k, v) => setAns(a => ({ ...a, lectures: { ...a.lectures, [id]: { ...a.lectures[id], [k]: v } } }));
    const setG = (id, v) => setAns(a => ({ ...a, general: { ...a.general, [id]: v } }));

    const submit = async () => {
        setBusy(true); setError('');
        try {
            await submitDailyEvalResponse({
                formId, courseId: cfg.courseId, date: cfg.date, dayNumber: cfg.dayNumber || 1,
                lectures: ans.lectures, general: ans.general,
                stateLocality: meta.stateLocality.slice(0, 200), job: meta.job.slice(0, 200),
                applyLevel: meta.applyLevel, applyText: meta.applyText.slice(0, 2000),
                difficulty: meta.difficulty.slice(0, 2000), suggestions: meta.suggestions.slice(0, 2000),
            });
            setSent(true);
        } catch (e) {
            setError('تعذر الإرسال، حاول مرة أخرى / Could not send, please try again.');
        } finally { setBusy(false); }
    };

    return (
        <div className="max-w-2xl mx-auto p-3" dir="rtl">
            <Card>
                <CardBody className="space-y-5">
                    <div className="text-center">
                        <div className="text-xs text-gray-500">وزارة الصحة الاتحادية · البرنامج القومي لصحة الطفل</div>
                        <h1 className="text-lg font-bold text-gray-900 mt-1">استمارة التقييم اليومي — اليوم {cfg.dayNumber}</h1>
                        <div className="text-sm text-gray-600">ورشة التدريب على الدليل التشغيلي لتطبيق العلاج المتكامل لأمراض الطفل وحديثي الولادة</div>
                        <div className="text-xs text-gray-500 mt-1">{cfg.date}{course?.state ? ` · ${course.state}` : ''}</div>
                        <div className="text-xs text-sky-700 mt-2">لا تكتب اسمك. إجاباتك تساعدنا في تحسين الورشة في الأيام القادمة. شكرًا لمشاركتك.</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-gray-600">الولاية / المحلية<Input value={meta.stateLocality} onChange={e => setMeta({ ...meta, stateLocality: e.target.value })} className="text-sm" /></label>
                        <label className="text-xs text-gray-600">الوظيفة<Input value={meta.job} onChange={e => setMeta({ ...meta, job: e.target.value })} className="text-sm" /></label>
                    </div>

                    {cfg.lectures?.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="font-bold text-gray-800">أولًا: تقييم محاضرات اليوم</h2>
                            <p className="text-xs text-gray-500">ضع تقييمك في كل خانة: ممتاز · جيد جدًا · جيد · مقبول · ضعيف</p>
                            {cfg.lectures.map((lec, i) => (
                                <div key={lec.id} className="border rounded-lg p-3 space-y-2">
                                    <div className="font-semibold text-sm">{i + 1}. {lec.text}</div>
                                    {LECTURE_CRITERIA.map(c => (
                                        <div key={c.key}>
                                            <div className="text-xs text-gray-600 mb-1">{c.label}</div>
                                            <Choice options={SCALE5} value={ans.lectures[lec.id]?.[c.key]} onChange={v => setL(lec.id, c.key, v)} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </section>
                    )}

                    {cfg.general?.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="font-bold text-gray-800">ثانيًا: التقييم العام لليوم</h2>
                            {cfg.general.map(g => (
                                <div key={g.id} className="space-y-1">
                                    <div className="text-sm">{g.text}</div>
                                    <Choice options={SCALE5} value={ans.general[g.id]} onChange={v => setG(g.id, v)} />
                                </div>
                            ))}
                        </section>
                    )}

                    <section className="space-y-3">
                        <h2 className="font-bold text-gray-800">ثالثًا: الاستفادة في تطبيق العلاج المتكامل</h2>
                        <div className="text-sm">إلى أي مدى سيساعدك ما تعلمته اليوم في تطبيق العلاج المتكامل في ولايتك أو محليتك؟</div>
                        <Choice options={APPLY} value={meta.applyLevel} onChange={v => setMeta({ ...meta, applyLevel: v })} />
                        <label className="text-sm block">اذكر شيئًا واحدًا ستطبقه في عملك مما تعلمته اليوم:
                            <Textarea rows={2} value={meta.applyText} onChange={e => setMeta({ ...meta, applyText: e.target.value })} />
                        </label>
                    </section>

                    <section className="space-y-3">
                        <h2 className="font-bold text-gray-800">رابعًا: ملاحظات ومقترحات</h2>
                        <label className="text-sm block">أي جزء وجدت فيه صعوبة في الفهم اليوم؟ ولماذا؟
                            <Textarea rows={2} value={meta.difficulty} onChange={e => setMeta({ ...meta, difficulty: e.target.value })} />
                        </label>
                        <label className="text-sm block">مقترحاتك لتحسين الأيام القادمة:
                            <Textarea rows={2} value={meta.suggestions} onChange={e => setMeta({ ...meta, suggestions: e.target.value })} />
                        </label>
                    </section>
                    {error && <div className="text-sm text-red-600">{error}</div>}
                </CardBody>
                <CardFooter>
                    <Button onClick={submit} disabled={busy} className="w-full">{busy ? '…' : 'إرسال التقييم'}</Button>
                </CardFooter>
            </Card>
        </div>
    );
};
