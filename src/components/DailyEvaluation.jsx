// components/DailyEvaluation.jsx
// Anonymous daily evaluation form for the IMCI operational guide training.
// Staff set the day and the lectures / general items from the course Share
// dialog; the set-up is saved in `dailyEvalForms/{courseId}_{date}` and the
// public link /public/evaluation/{courseId}_{date} shows it to anyone, signed
// in or not. Answers go to `dailyEvalResponses`.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, Copy, Download, ExternalLink, Info, Pencil, Plus, QrCode, Send, Share2, Trash2 } from 'lucide-react';
import { notify } from './dialogs';
import { publicBaseUrl } from '../utils/publicLink';
import { getCourseById, getDailyEvalForm, listDailyEvalForms, listDailyEvalResponses, saveDailyEvalForm, submitDailyEvalResponse } from '../data.js';
import { Button, Card, CardBody, CardFooter, EmptyState, Input, Modal, PageSkeleton, Select, Spinner, Textarea } from './CommonComponents';
import FormPdfButton from './FormPdfButton';

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
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6];

const nextId = (items, p) => `${p}${items.reduce((m, x) => Math.max(m, parseInt(String(x.id).slice(1), 10) || 0), 0) + 1}`;
const today = () => new Date().toISOString().split('T')[0];

// ---------------------------------------------------------------------------
// Share dialog: one row like the other public links. Share opens a window
// listing the days already shared (answers so far, Edit, Share) with a New
// day button; saving a day goes straight to its QR code, link and WhatsApp.
// ---------------------------------------------------------------------------
function ItemListEditor({ title, items, onChange, onRemove, onAdd, addLabel }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                <span className="text-sm font-semibold text-slate-700">{title}</span>
                <span className="text-xs text-slate-500 tabular-nums">{items.length}</span>
            </div>
            <div className="divide-y divide-slate-100" dir="rtl">
                {items.map((x, i) => (
                    <div key={x.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="w-6 text-xs font-semibold text-slate-400 tabular-nums text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                            <input value={x.text} onChange={e => onChange(x.id, e.target.value)} dir="auto"
                                className="border border-gray-300 rounded-md px-2 py-1.5 w-full text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                        </div>
                        <button type="button" onClick={() => onRemove(x.id)} aria-label="Remove"
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                ))}
                {items.length === 0 && <div className="px-3 py-3 text-sm text-slate-400 text-center">—</div>}
            </div>
            <div className="px-3 py-2 border-t border-slate-100">
                <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800">
                    <Plus size={16} /> {addLabel}
                </button>
            </div>
        </div>
    );
}

export const DailyEvaluationShare = ({ course, canEdit = true }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState('list'); // list | edit | share
    const [forms, setForms] = useState(null);
    const [counts, setCounts] = useState({});
    const [date, setDate] = useState(today());
    const [cfg, setCfg] = useState(() => makeDefaultConfig(course.id, today(), 1));
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [shared, setShared] = useState(null); // { formId, dayNumber, date, url }
    const qrRef = useRef(null);

    const linkFor = (formId) => `${publicBaseUrl()}/public/evaluation/${formId}`;

    // The days already shared for this course, with how many answers each has.
    const loadList = () => {
        setForms(null);
        listDailyEvalForms(course.id)
            .then(list => setForms(list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))))
            .catch(() => setForms([]));
        listDailyEvalResponses(course.id)
            .then(rs => { const c = {}; rs.forEach(r => { c[r.formId] = (c[r.formId] || 0) + 1; }); setCounts(c); })
            .catch(() => setCounts({}));
    };
    const openDialog = () => { setOpen(true); setError(''); setStep('list'); loadList(); };

    // Load the saved set-up of the chosen date (or that day's defaults).
    useEffect(() => {
        if (!open || step !== 'edit') return undefined;
        let cancelled = false;
        setLoading(true);
        getDailyEvalForm(evalFormId(course.id, date))
            .then(saved => {
                if (cancelled) return;
                if (saved) setCfg({ ...saved, date });
                else setCfg(c => ({ ...c, date, courseId: course.id }));
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, step, course.id, date]);

    const startNew = () => {
        const used = new Set((forms || []).map(f => Number(f.dayNumber)));
        const nextDay = DAY_OPTIONS.find(n => !used.has(n)) || 1;
        const d = today();
        setDate(d); setCfg(makeDefaultConfig(course.id, d, nextDay)); setError(''); setStep('edit');
    };
    const editForm = (f) => { setDate(f.date); setCfg({ ...f }); setError(''); setStep('edit'); };
    const showShare = (f) => setShared({ formId: f.id, dayNumber: f.dayNumber, date: f.date, url: linkFor(f.id) });

    const setDay = (n) => setCfg(makeDefaultConfig(course.id, date, n));
    const upd = (key) => (id, text) => setCfg(c => ({ ...c, [key]: c[key].map(x => x.id === id ? { ...x, text } : x) }));
    const del = (key) => (id) => setCfg(c => ({ ...c, [key]: c[key].filter(x => x.id !== id) }));
    const add = (key, p) => () => setCfg(c => ({ ...c, [key]: [...c[key], L(nextId(c[key], p), '')] }));

    const save = async () => {
        setBusy(true); setError('');
        try {
            const formId = evalFormId(course.id, date);
            const clean = {
                courseId: course.id, date, dayNumber: Number(cfg.dayNumber) || 1,
                lectures: cfg.lectures.filter(x => x.text.trim()).map(x => ({ id: x.id, text: x.text.trim() })),
                general: cfg.general.filter(x => x.text.trim()).map(x => ({ id: x.id, text: x.text.trim() })),
                courseType: course.course_type || '', state: course.state || '',
            };
            await saveDailyEvalForm(formId, clean);
            setForms(fs => [{ id: formId, ...clean }, ...(fs || []).filter(f => f.id !== formId)].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
            setStep('list');
            showShare({ id: formId, ...clean });
        } catch (e) {
            setError(e?.message || t('daily_eval.save_failed', 'Could not save the form.'));
        } finally { setBusy(false); }
    };

    const message = (s) => `*استمارة التقييم اليومي — اليوم ${s.dayNumber}*\nورشة الدليل التشغيلي لتطبيق العلاج المتكامل${course.state ? ` - ${course.state}` : ''}\n${s.date}\n\nلا تكتب اسمك، التقييم مجهول:\n${s.url}`;
    const copy = async (text, note) => {
        try { await navigator.clipboard.writeText(text); notify(note); } catch { notify(t('course_page.share.copy_failed', 'Failed to copy link.')); }
    };
    const whatsapp = (s) => window.open(`https://wa.me/?text=${encodeURIComponent(message(s))}`, '_blank');
    const nativeShare = async (s) => {
        if (navigator.share) {
            try { await navigator.share({ title: `Daily evaluation - Day ${s.dayNumber}`, text: message(s) }); } catch (e) { if (e?.name !== 'AbortError') copy(message(s), t('daily_eval.copied', 'Message copied')); }
        } else copy(message(s), t('daily_eval.copied', 'Message copied'));
    };
    const downloadQr = (s) => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas) return;
        const out = document.createElement('canvas');
        const pad = 32;
        out.width = canvas.width + pad * 2; out.height = canvas.height + pad * 2 + 40;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, pad, pad);
        ctx.fillStyle = '#334155'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Daily evaluation · Day ${s.dayNumber} · ${s.date}`, out.width / 2, canvas.height + pad + 28);
        const a = document.createElement('a');
        a.href = out.toDataURL('image/png'); a.download = `daily-evaluation-day-${s.dayNumber}.png`; a.click();
    };

    return (
        <>
            <div className="bg-gray-50 p-3 rounded border">
                <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                        <span className="text-sm font-semibold block">{t('daily_eval.title', 'Daily Evaluation')}</span>
                        <span className="text-xs text-gray-500">{t('daily_eval.row_hint', 'Anonymous · choose the day and lectures before sharing')}</span>
                    </div>
                    <Button variant="secondary" className="flex items-center gap-1 shrink-0" disabled={!canEdit} onClick={openDialog}>
                        <QrCode size={14} /> {t('course_page.buttons.share', 'Share')}
                    </Button>
                </div>
            </div>

            <Modal isOpen={open && !shared} onClose={() => setOpen(false)} title={step === 'edit' ? t('daily_eval.setup_title_day', 'Daily Evaluation · Day {{n}}', { n: cfg.dayNumber }) : t('daily_eval.title', 'Daily Evaluation')}>
                {step === 'list' ? (
                    <>
                        <CardBody className="space-y-4">
                            <div className="flex gap-2 items-start rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{t('daily_eval.list_hint', 'Each training day gets its own anonymous link. Participants open it without signing in; results appear in the course report under Daily Evaluation.')}</span>
                            </div>
                            {forms === null ? <div className="flex justify-center py-6"><Spinner /></div> : forms.length === 0 ? (
                                <EmptyState message={t('daily_eval.none_yet', 'No day has been shared yet.')} />
                            ) : (
                                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                                    {forms.map(f => (
                                        <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                                            <div className="w-12 h-12 shrink-0 rounded-lg bg-sky-100 text-sky-800 flex flex-col items-center justify-center leading-none">
                                                <span className="text-[11px]">{t('daily_eval.day', 'Day')}</span>
                                                <span className="text-lg font-bold">{f.dayNumber}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-slate-800 tabular-nums">{f.date}</div>
                                                <div className="text-xs text-slate-500">
                                                    {t('daily_eval.n_lectures', '{{n}} lectures', { n: (f.lectures || []).length })} · <span className={counts[f.id] ? 'text-emerald-700 font-semibold' : ''}>{t('daily_eval.n_answers', '{{n}} answers', { n: counts[f.id] || 0 })}</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => editForm(f)} className="p-2 rounded-md text-slate-500 hover:text-sky-700 hover:bg-sky-50" aria-label="Edit"><Pencil size={16} /></button>
                                            <Button variant="secondary" className="shrink-0" onClick={() => showShare(f)}><QrCode size={14} /> {t('course_page.buttons.share', 'Share')}</Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setOpen(false)}>{t('course_page.buttons.close', 'Close')}</Button>
                            <Button onClick={startNew}><Plus size={16} /> {t('daily_eval.new_day', 'New day')}</Button>
                        </CardFooter>
                    </>
                ) : (
                    <>
                        <CardBody className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="date" label={t('daily_eval.date', 'Date')} value={date} onChange={e => setDate(e.target.value)} />
                                <Select label={t('daily_eval.day', 'Day')} value={cfg.dayNumber} onChange={e => setDay(Number(e.target.value))}>
                                    {DAY_OPTIONS.map(n => <option key={n} value={n}>{t('daily_eval.day_n', 'Day {{n}}', { n })}</option>)}
                                </Select>
                            </div>
                            <p className="text-xs text-slate-500">{t('daily_eval.day_hint', 'Changing the day loads that day\'s lectures from the workshop form. Edit, remove or add items below.')}</p>
                            {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
                                <>
                                    <ItemListEditor title={t('daily_eval.lectures', 'Lectures of the day')} items={cfg.lectures}
                                        onChange={upd('lectures')} onRemove={del('lectures')} onAdd={add('lectures', 'l')} addLabel={t('daily_eval.add_lecture', 'Add lecture')} />
                                    <ItemListEditor title={t('daily_eval.general', 'General evaluation of the day')} items={cfg.general}
                                        onChange={upd('general')} onRemove={del('general')} onAdd={add('general', 'g')} addLabel={t('daily_eval.add_item', 'Add item')} />
                                </>
                            )}
                            {error && <div className="text-sm text-red-600">{error}</div>}
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setStep('list')}>{t('course_page.buttons.back', 'Back')}</Button>
                            <Button onClick={save} disabled={busy || loading}>
                                {busy ? <Spinner size="sm" /> : <QrCode size={16} />} {t('daily_eval.save_share', 'Save and share')}
                            </Button>
                        </CardFooter>
                    </>
                )}
            </Modal>

            <Modal isOpen={open && !!shared} onClose={() => setShared(null)} title={shared ? t('daily_eval.share_title', 'Share · Day {{n}}', { n: shared.dayNumber }) : ''}>
                {shared && (
                    <>
                        <CardBody className="flex flex-col items-center gap-4">
                            <div className="text-center">
                                <div className="text-sm font-semibold text-slate-800">{t('daily_eval.title', 'Daily Evaluation')} · {t('daily_eval.day_n', 'Day {{n}}', { n: shared.dayNumber })}</div>
                                <div className="text-xs text-slate-500 tabular-nums">{shared.date}{course.state ? ` · ${course.state}` : ''} · {t('daily_eval.n_answers', '{{n}} answers', { n: counts[shared.formId] || 0 })}</div>
                            </div>
                            <div ref={qrRef} className="bg-white p-4 rounded-xl border border-slate-200">
                                <QRCodeCanvas value={shared.url} size={200} level="M" includeMargin={false} />
                            </div>
                            <div className="w-full flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="flex-1 min-w-0 truncate text-xs text-slate-600" dir="ltr">{shared.url}</span>
                                <button type="button" onClick={() => copy(shared.url, t('course_page.share.link_copied_clipboard', 'Link copied to clipboard!'))} className="p-1 rounded text-slate-500 hover:text-sky-700" aria-label="Copy link"><Copy size={16} /></button>
                            </div>
                            <div className="w-full grid grid-cols-2 gap-2">
                                <Button onClick={() => whatsapp(shared)} className="!bg-emerald-600 hover:!bg-emerald-700"><Send size={16} /> WhatsApp</Button>
                                <Button variant="secondary" onClick={() => nativeShare(shared)}><Share2 size={16} /> {t('daily_eval.share_other', 'Share…')}</Button>
                                <Button variant="secondary" onClick={() => downloadQr(shared)}><Download size={16} /> {t('daily_eval.save_qr', 'Save QR')}</Button>
                                <Button variant="secondary" onClick={() => window.open(shared.url, '_blank')}><ExternalLink size={16} /> {t('course_page.share.open_link', 'Open Link')}</Button>
                            </div>
                        </CardBody>
                        <CardFooter>
                            <Button variant="secondary" onClick={() => setShared(null)}>{t('daily_eval.all_days', 'All days')}</Button>
                        </CardFooter>
                    </>
                )}
            </Modal>
        </>
    );
};

// ---------------------------------------------------------------------------
// Public form
// ---------------------------------------------------------------------------
// Segmented choice, same look as the monitoring toggles.
function Segmented({ options, value, onChange }) {
    return (
        <div className="relative z-0 flex w-full sm:w-auto sm:inline-flex shadow-sm rounded-md">
            {options.map(([val, label], idx) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`relative inline-flex flex-1 sm:flex-none items-center justify-center px-1.5 sm:px-3 py-2 min-h-[44px] sm:min-h-[36px] text-xs sm:text-sm font-medium leading-tight touch-manipulation focus:z-10 focus:outline-none focus:ring-1 focus:ring-sky-500 transition border border-gray-300 ${idx === 0 ? 'rounded-s-md' : '-ms-px'} ${idx === options.length - 1 ? 'rounded-e-md' : ''} ${value === val ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}

function Section({ title, hint, done, total, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-3 p-4 text-start transition-colors ${open ? 'bg-sky-50 border-b border-sky-100' : 'bg-white hover:bg-slate-50'}`}>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 break-words">{title}</h3>
                    {hint && open && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
                </div>
                {total > 0 && <span className={`text-xs font-semibold tabular-nums ${done === total ? 'text-green-700' : 'text-slate-500'}`}>{done}/{total}</span>}
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="divide-y divide-slate-100">{children}</div>}
        </div>
    );
}

const Row = ({ label, children, sub = false }) => (
    <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-2 p-3 sm:px-5 ${sub ? 'ps-6 sm:ps-8' : ''}`}>
        <span className={`min-w-0 flex-1 break-words ${sub ? 'text-sm text-slate-600' : 'font-medium text-slate-700'}`}>{label}</span>
        {children}
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

    const { cfg, course } = state;
    const progress = useMemo(() => {
        if (!cfg) return { done: 0, total: 0, lec: 0, lecTotal: 0, gen: 0 };
        const lecTotal = (cfg.lectures || []).length * LECTURE_CRITERIA.length;
        const lec = (cfg.lectures || []).reduce((s, l) => s + LECTURE_CRITERIA.filter(c => ans.lectures[l.id]?.[c.key]).length, 0);
        const gen = (cfg.general || []).filter(g => ans.general[g.id]).length;
        const total = lecTotal + (cfg.general || []).length + 1;
        return { lec, lecTotal, gen, done: lec + gen + (meta.applyLevel ? 1 : 0), total };
    }, [cfg, ans, meta.applyLevel]);

    if (state.loading) return <PageSkeleton />;
    if (!cfg) return <Card><CardBody><EmptyState message="هذا النموذج غير متاح — This form is not available." /></CardBody></Card>;

    if (sent) return (
        <div className="max-w-xl mx-auto" dir="rtl">
            <Card><CardBody className="text-center space-y-3 py-10">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                <h2 className="text-lg font-bold text-slate-800">شكرًا لمشاركتك</h2>
                <p className="text-sm text-slate-600">تم إرسال تقييم اليوم {cfg.dayNumber}. إجاباتك تساعدنا في تحسين الورشة.</p>
            </CardBody></Card>
        </div>
    );

    const setL = (id, k, v) => setAns(a => ({ ...a, lectures: { ...a.lectures, [id]: { ...a.lectures[id], [k]: v } } }));
    const setG = (id, v) => setAns(a => ({ ...a, general: { ...a.general, [id]: v } }));

    const submit = async () => {
        if (progress.done === 0) { setError('الرجاء تقييم بند واحد على الأقل.'); return; }
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
            window.scrollTo?.(0, 0);
        } catch {
            setError('تعذر الإرسال، حاول مرة أخرى.');
        } finally { setBusy(false); }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-28" dir="rtl" data-pdf-root="">
            <Card>
                <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-slate-500">وزارة الصحة الاتحادية · البرنامج القومي لصحة الطفل</div>
                        <FormPdfButton formName={`Daily Evaluation Form - Day ${cfg.dayNumber}`} subtitle="استمارة التقييم اليومي" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">استمارة التقييم اليومي</h1>
                    <p className="text-sm text-slate-600">ورشة التدريب على الدليل التشغيلي لتطبيق العلاج المتكامل لأمراض الطفولة وحديثي الولادة</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-800 font-semibold">اليوم {cfg.dayNumber}</span>
                        <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 tabular-nums">{cfg.date}</span>
                        {(course?.state || cfg.state) && <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700">{[course?.state || cfg.state, course?.locality || cfg.locality].filter(Boolean).join(' - ')}</span>}
                    </div>
                    <div className="flex gap-2 items-start rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>لا تكتب اسمك. إجاباتك تساعدنا في تحسين الورشة في الأيام القادمة. شكرًا لمشاركتك.</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="الولاية / المحلية (اختياري)" value={meta.stateLocality} onChange={e => setMeta({ ...meta, stateLocality: e.target.value })} />
                        <Input label="الوظيفة (اختياري)" value={meta.job} onChange={e => setMeta({ ...meta, job: e.target.value })} />
                    </div>
                </CardBody>
            </Card>

            {cfg.lectures?.length > 0 && (
                <Section title="أولًا: تقييم محاضرات اليوم" hint="اختر تقييمك لكل محاضرة في كل بند." done={progress.lec} total={progress.lecTotal}>
                    {cfg.lectures.map((lec, i) => (
                        <div key={lec.id} className="py-1">
                            <div className="px-3 sm:px-5 pt-3 pb-1 font-semibold text-slate-800">{i + 1}. {lec.text}</div>
                            {LECTURE_CRITERIA.map(c => (
                                <Row key={c.key} label={c.label} sub>
                                    <Segmented options={SCALE5} value={ans.lectures[lec.id]?.[c.key]} onChange={v => setL(lec.id, c.key, v)} />
                                </Row>
                            ))}
                        </div>
                    ))}
                </Section>
            )}

            {cfg.general?.length > 0 && (
                <Section title="ثانيًا: التقييم العام لليوم" done={progress.gen} total={cfg.general.length}>
                    {cfg.general.map(g => (
                        <Row key={g.id} label={g.text}>
                            <Segmented options={SCALE5} value={ans.general[g.id]} onChange={v => setG(g.id, v)} />
                        </Row>
                    ))}
                </Section>
            )}

            <Section title="ثالثًا: الاستفادة في تطبيق العلاج المتكامل" done={meta.applyLevel ? 1 : 0} total={1}>
                <Row label="إلى أي مدى سيساعدك ما تعلمته اليوم في تطبيق العلاج المتكامل في ولايتك أو محليتك؟">
                    <Segmented options={APPLY} value={meta.applyLevel} onChange={v => setMeta({ ...meta, applyLevel: v })} />
                </Row>
                <div className="p-3 sm:px-5">
                    <Textarea label="اذكر شيئًا واحدًا ستطبقه في عملك مما تعلمته اليوم" rows={2} value={meta.applyText} onChange={e => setMeta({ ...meta, applyText: e.target.value })} />
                </div>
            </Section>

            <Section title="رابعًا: ملاحظات ومقترحات">
                <div className="p-3 sm:px-5 space-y-3">
                    <Textarea label="أي جزء وجدت فيه صعوبة في الفهم اليوم؟ ولماذا؟" rows={2} value={meta.difficulty} onChange={e => setMeta({ ...meta, difficulty: e.target.value })} />
                    <Textarea label="مقترحاتك لتحسين الأيام القادمة" rows={2} value={meta.suggestions} onChange={e => setMeta({ ...meta, suggestions: e.target.value })} />
                </div>
            </Section>

            <div className="fixed bottom-[var(--bottom-nav,0px)] inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-3" dir="rtl">
                    <div className="text-sm">
                        <div className="font-bold tabular-nums text-slate-800">{progress.done} / {progress.total}</div>
                        <div className="text-xs text-slate-500">{error ? <span className="text-red-600">{error}</span> : 'بنود تم تقييمها'}</div>
                    </div>
                    <div className="ms-auto">
                        <Button onClick={submit} disabled={busy}>{busy ? <Spinner size="sm" /> : 'إرسال التقييم'}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
