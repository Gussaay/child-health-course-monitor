// src/components/exercises/ExercisePlayer.jsx
//
// The shared exercise engine. Mounted by BOTH the facilitator view
// (CourseExercisesView) and the public participant link (PublicExerciseView).
//
// Props
//   exercise      object from imnciExercises.js
//   participant   { id, name }  — used only for the header and the saved attempt
//   onSubmit      async ({ responses, results, summary, durationSeconds }) => void
//   onExit        () => void
//   previousBest  number | null — best previous percent, shown in the header
//   readOnlyAttempt  optional saved attempt to render in review mode
//
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button, Card, Spinner } from '../CommonComponents';
import {
    CheckCircle, XCircle, ChevronLeft, ChevronRight, RotateCcw,
    Award, AlertTriangle, Languages, ClipboardList,
} from 'lucide-react';
import { CLASSIFICATION_COLOURS, flattenSteps } from './imnciExercises';
import { gradeStep, isAnswered, summariseAttempt } from './exerciseGrading';

// --------------------------------------------------------------------------- helpers

const useLang = () => {
    const [lang, setLang] = useState('en');
    const t = useCallback((en, ar) => (lang === 'ar' && ar ? ar : en), [lang]);
    return { lang, setLang, t, rtl: lang === 'ar' };
};

const ColourChip = ({ colour }) => {
    const c = CLASSIFICATION_COLOURS[colour];
    if (!c) return null;
    return <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${c.text}`}>
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />{c.label}
    </span>;
};

const FeedbackBanner = ({ result, explain }) => {
    if (!result) return null;
    const good = result.correct;
    const partial = !good && result.earned > 0;
    return (
        <div className={`mt-4 rounded-lg border p-4 ${good ? 'bg-emerald-50 border-emerald-300' : partial ? 'bg-amber-50 border-amber-300' : 'bg-rose-50 border-rose-300'}`}>
            <div className="flex items-start gap-3">
                {good ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
                <div>
                    <p className={`font-semibold text-sm ${good ? 'text-emerald-800' : partial ? 'text-amber-800' : 'text-rose-800'}`}>
                        {good ? 'Correct' : partial ? `Partly correct — ${result.earned} of ${result.possible}` : 'Not correct'}
                    </p>
                    {explain && <p className="text-sm text-slate-700 mt-1 leading-relaxed">{explain}</p>}
                </div>
            </div>
        </div>
    );
};

// --------------------------------------------------------------------------- step renderers

function FormStep({ step, value = {}, onChange, result, t, locked }) {
    return (
        <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-2 text-xs text-slate-600">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                Management of the sick child age 2 months up to 5 years — recording form
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                {step.fields.map(f => {
                    const d = result?.detail?.[f.id];
                    const ring = !d ? 'border-slate-300' : d.ok ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50';
                    return (
                        <div key={f.id}>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                {t(f.label, f.labelAr)}{f.unit ? <span className="text-slate-400"> ({f.unit})</span> : null}
                            </label>
                            {f.type === 'select' ? (
                                <select
                                    disabled={locked}
                                    className={`w-full rounded-md border px-3 py-2 text-sm disabled:opacity-70 ${ring}`}
                                    value={value[f.id] ?? ''}
                                    onChange={(e) => onChange({ ...value, [f.id]: e.target.value })}
                                >
                                    <option value="">—</option>
                                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            ) : (
                                <input
                                    disabled={locked}
                                    type={f.type === 'number' ? 'number' : 'text'}
                                    step="any"
                                    className={`w-full rounded-md border px-3 py-2 text-sm disabled:opacity-70 ${ring}`}
                                    value={value[f.id] ?? ''}
                                    onChange={(e) => onChange({ ...value, [f.id]: e.target.value })}
                                />
                            )}
                            {d && !d.ok && (
                                <p className="text-[11px] text-rose-600 mt-1">Correct answer: <strong>{String(d.expected)}</strong></p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ChecklistStep({ step, value = {}, onChange, result, t, locked }) {
    const set = (id, present) => onChange({ ...value, [id]: present });
    return (
        <div className="space-y-2">
            {step.signs.map(s => {
                const d = result?.detail?.[s.id];
                const chosen = value[s.id];
                const border = !d ? 'border-slate-200' : d.ok ? 'border-emerald-300 bg-emerald-50/50' : 'border-rose-300 bg-rose-50/50';
                return (
                    <div key={s.id} className={`border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 ${border}`}>
                        <div className="flex items-start gap-2 min-w-[55%]">
                            {d && (d.ok ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                        : <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />)}
                            <div>
                                <p className="text-sm text-slate-800">{t(s.label, s.labelAr)}</p>
                                {d && !d.ok && (
                                    <p className="text-[11px] text-rose-600 mt-0.5">
                                        Correct: <strong>{d.expected ? 'Present' : 'Not present'}</strong>{d.why ? ` — ${d.why}` : ''}
                                    </p>
                                )}
                                {d && d.ok && d.why && <p className="text-[11px] text-emerald-700 mt-0.5">{d.why}</p>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {[{ v: true, l: 'Present' }, { v: false, l: 'Not present' }].map(opt => (
                                <button
                                    key={opt.l}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => set(s.id, opt.v)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-60
                                        ${chosen === opt.v
                                            ? (opt.v ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-600 text-white border-slate-600')
                                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                                >
                                    {opt.l}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ClassifyStep({ step, value = [], onChange, result, t, locked }) {
    const toggle = (id) => {
        if (step.multi) onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
        else onChange([id]);
    };
    return (
        <div className="space-y-2">
            {step.multi && <p className="text-xs text-slate-500 mb-1">Select all that apply.</p>}
            {step.options.map(o => {
                const d = result?.detail?.[o.id];
                const chosen = value.includes(o.id);
                const c = CLASSIFICATION_COLOURS[o.colour] || {};
                let state = 'border-slate-200 bg-white hover:border-slate-400';
                if (chosen && !d) state = 'border-sky-500 bg-sky-50 ring-1 ring-sky-500';
                if (d?.expected) state = 'border-emerald-400 bg-emerald-50';
                if (d && d.chosen && !d.expected) state = 'border-rose-400 bg-rose-50';
                return (
                    <button
                        key={o.id}
                        type="button"
                        disabled={locked}
                        onClick={() => toggle(o.id)}
                        className={`w-full text-left border rounded-lg p-3 transition-all disabled:cursor-default ${state}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${c.dot || 'bg-slate-300'}`} />
                                <span className="text-sm font-medium text-slate-800">{t(o.label, o.labelAr)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <ColourChip colour={o.colour} />
                                {d?.expected && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                                {d && d.chosen && !d.expected && <XCircle className="w-4 h-4 text-rose-600" />}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function McqStep({ step, value = [], onChange, result, locked }) {
    const multi = (step.correct || []).length > 1;
    const toggle = (i) => {
        if (multi) onChange(value.includes(i) ? value.filter(x => x !== i) : [...value, i]);
        else onChange([i]);
    };
    return (
        <div className="space-y-3">
            {step.media?.src && (
                step.media.type === 'video'
                    ? <video controls className="w-full rounded-lg border border-slate-200 bg-black" src={step.media.src} />
                    : <img alt={step.media.alt || ''} src={step.media.src} className="w-full rounded-lg border border-slate-200" />
            )}
            {step.media && !step.media.src && (
                <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                    Media not set — add a URL in <code className="text-xs">imnciExercises.js</code>
                    <p className="text-xs mt-1">{step.media.alt}</p>
                </div>
            )}
            {step.question && <p className="text-sm font-medium text-slate-800">{step.question}</p>}
            {multi && <p className="text-xs text-slate-500">Select all that apply.</p>}
            <div className="space-y-2">
                {step.options.map((o, i) => {
                    const d = result?.detail?.[i];
                    const chosen = value.includes(i);
                    let state = 'border-slate-200 bg-white hover:border-slate-400';
                    if (chosen && !d) state = 'border-sky-500 bg-sky-50 ring-1 ring-sky-500';
                    if (d?.expected) state = 'border-emerald-400 bg-emerald-50';
                    if (d && d.chosen && !d.expected) state = 'border-rose-400 bg-rose-50';
                    return (
                        <button key={i} type="button" disabled={locked} onClick={() => toggle(i)}
                            className={`w-full text-left border rounded-lg p-3 flex items-center justify-between gap-3 transition-all disabled:cursor-default ${state}`}>
                            <span className="text-sm text-slate-800">
                                <span className="text-slate-400 font-mono text-xs mr-2">{String.fromCharCode(65 + i)}</span>{o}
                            </span>
                            {d?.expected && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                            {d && d.chosen && !d.expected && <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Drag-and-drop with a tap-to-place fallback so it works inside the Capacitor app. */
function MatchStep({ step, value = {}, onChange, result, locked }) {
    const [picked, setPicked] = useState(null);
    const placedLeftIds = Object.keys(value);

    const place = (leftId, rightId) => {
        if (locked) return;
        onChange({ ...value, [leftId]: rightId });
        setPicked(null);
    };
    const clear = (leftId) => { if (!locked) { const n = { ...value }; delete n[leftId]; onChange(n); } };

    return (
        <div className="space-y-4">
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Signs</p>
                <div className="flex flex-wrap gap-2">
                    {step.left.filter(l => !placedLeftIds.includes(l.id)).map(l => (
                        <button
                            key={l.id}
                            type="button"
                            disabled={locked}
                            draggable={!locked}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}
                            onClick={() => setPicked(picked === l.id ? null : l.id)}
                            className={`px-3 py-2 rounded-lg border text-sm text-left transition-all cursor-grab active:cursor-grabbing disabled:opacity-60
                                ${picked === l.id ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300' : 'border-slate-300 bg-white hover:border-slate-400'}`}
                        >
                            {l.label}
                        </button>
                    ))}
                    {step.left.every(l => placedLeftIds.includes(l.id)) && (
                        <p className="text-xs text-slate-400 italic">All signs placed.</p>
                    )}
                </div>
                {picked && <p className="text-xs text-sky-600 mt-2">Now tap the classification it belongs to.</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
                {step.right.map(r => {
                    const assigned = step.left.filter(l => value[l.id] === r.id);
                    const c = CLASSIFICATION_COLOURS[r.colour] || {};
                    return (
                        <div
                            key={r.id}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) place(id, r.id); }}
                            onClick={() => picked && place(picked, r.id)}
                            className={`border-2 border-dashed rounded-lg p-3 min-h-[84px] transition-colors
                                ${picked ? 'border-sky-400 bg-sky-50/40 cursor-pointer' : 'border-slate-300'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${c.dot || 'bg-slate-300'}`} />
                                <span className="text-xs font-semibold text-slate-700">{r.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {assigned.map(l => {
                                    const d = result?.detail?.[l.id];
                                    const tone = !d ? 'bg-slate-100 text-slate-700 border-slate-300'
                                        : d.ok ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                               : 'bg-rose-100 text-rose-800 border-rose-300';
                                    return (
                                        <span key={l.id}
                                            onClick={(e) => { e.stopPropagation(); clear(l.id); }}
                                            className={`text-xs px-2 py-1 rounded border ${tone} ${locked ? '' : 'cursor-pointer'}`}>
                                            {l.label}
                                            {d && !d.ok && <span className="ml-1 font-semibold">✕</span>}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {result && !result.correct && (
                <div className="text-xs text-slate-600 border-t pt-3">
                    <p className="font-semibold mb-1">Correct matches:</p>
                    <ul className="space-y-0.5">
                        {Object.entries(step.correct).map(([lid, rid]) => (
                            <li key={lid}>
                                {step.left.find(l => l.id === lid)?.label} → <strong>{step.right.find(r => r.id === rid)?.label}</strong>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// --------------------------------------------------------------------------- main component

export function ExercisePlayer({ exercise, participant, onSubmit, onExit, previousBest = null, readOnlyAttempt = null }) {
    const { lang, setLang, t, rtl } = useLang();
    const steps = useMemo(() => flattenSteps(exercise), [exercise]);
    const startedAt = useRef(Date.now());

    const [index, setIndex] = useState(0);
    const [responses, setResponses] = useState(readOnlyAttempt?.responses || {});
    const [results, setResults] = useState(readOnlyAttempt?.results || {});
    const [finished, setFinished] = useState(!!readOnlyAttempt);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const review = !!readOnlyAttempt;
    const step = steps[index];
    const result = results[step?.id];
    const locked = review || !!result;
    const answered = step ? isAnswered(step, responses[step.id]) : false;
    const immediate = exercise.feedbackMode !== 'end';

    const scrollRef = useRef(null);
    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [index, finished]);

    const setResponse = (val) => setResponses(prev => ({ ...prev, [step.id]: val }));

    const check = () => {
        const r = gradeStep(step, responses[step.id]);
        setResults(prev => ({ ...prev, [step.id]: r }));
    };

    const next = () => {
        if (step.type !== 'brief' && !results[step.id]) {
            // 'end' feedback mode: grade silently and move on
            setResults(prev => ({ ...prev, [step.id]: gradeStep(step, responses[step.id]) }));
        }
        if (index < steps.length - 1) setIndex(i => i + 1);
        else setFinished(true);
    };

    const summary = useMemo(() => summariseAttempt(steps, results), [steps, results]);

    const handleSubmit = async () => {
        if (!onSubmit) return;
        setSaving(true); setSaveError('');
        try {
            await onSubmit({
                responses,
                results,
                summary,
                durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
            });
        } catch (e) {
            setSaveError(e?.message || 'Could not save your attempt.');
        } finally {
            setSaving(false);
        }
    };

    const restart = () => {
        setResponses({}); setResults({}); setIndex(0); setFinished(false);
        startedAt.current = Date.now();
    };

    // ------------------------------------------------------------------ results screen
    if (finished) {
        const passed = summary.percent >= (exercise.passMark ?? 80);
        return (
            <Card className="max-w-3xl mx-auto">
                <div ref={scrollRef} className="p-6 sm:p-8">
                    <div className="text-center">
                        <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${passed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                            {passed ? <Award className="w-10 h-10 text-emerald-600" /> : <RotateCcw className="w-10 h-10 text-amber-600" />}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">{passed ? 'Exercise passed' : 'Almost there'}</h2>
                        <p className="text-slate-600 mt-1">{exercise.title}</p>
                        {participant?.name && <p className="text-sm text-slate-500 mt-1">{participant.name}</p>}

                        <div className="flex items-center justify-center gap-8 my-8">
                            <div>
                                <p className={`text-5xl font-bold ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>{summary.percent}%</p>
                                <p className="text-xs text-slate-500 mt-1">Score</p>
                            </div>
                            <div className="h-14 w-px bg-slate-200" />
                            <div>
                                <p className="text-5xl font-bold text-slate-700">{summary.stepsCorrect}<span className="text-2xl text-slate-400">/{summary.stepsScored}</span></p>
                                <p className="text-xs text-slate-500 mt-1">Steps fully correct</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">Pass mark {exercise.passMark ?? 80}%{previousBest != null && ` · previous best ${previousBest}%`}</p>
                    </div>

                    <div className="mt-8 border-t pt-6">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Step breakdown</p>
                        <div className="space-y-1.5">
                            {steps.filter(s => s.type !== 'brief').map(s => {
                                const r = results[s.id];
                                return (
                                    <button key={s.id} onClick={() => { setIndex(steps.findIndex(x => x.id === s.id)); setFinished(false); }}
                                        className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 rounded-md hover:bg-slate-50 border border-slate-100">
                                        <span className="text-sm text-slate-700 truncate">
                                            <span className="text-slate-400 text-xs mr-2">{s.caseTitle?.split('—')[0]?.trim()}</span>{s.title}
                                        </span>
                                        <span className={`text-xs font-semibold flex-shrink-0 ${r?.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {r ? `${r.earned}/${r.possible}` : '—'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {saveError && (
                        <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{saveError}</p>
                    )}

                    <div className="mt-8 flex flex-wrap gap-3 justify-center">
                        {!review && onSubmit && (
                            <Button onClick={handleSubmit} disabled={saving}>
                                {saving ? <Spinner size="sm" /> : 'Save my result'}
                            </Button>
                        )}
                        {!review && <Button variant="secondary" onClick={restart}>Try again</Button>}
                        {onExit && <Button variant="secondary" onClick={onExit}>Back to exercises</Button>}
                    </div>
                </div>
            </Card>
        );
    }

    // ------------------------------------------------------------------ step screen
    const progress = Math.round(((index) / steps.length) * 100);

    return (
        <Card className="max-w-3xl mx-auto" >
            <div dir={rtl ? 'rtl' : 'ltr'}>
                {/* header */}
                <div className="border-b border-slate-200 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                            <h2 className="font-semibold text-slate-900 truncate">{t(exercise.title, exercise.titleAr)}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {step.caseTitle} · Step {index + 1} of {steps.length}
                                {participant?.name ? ` · ${participant.name}` : ''}
                            </p>
                        </div>
                        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2 py-1 flex-shrink-0">
                            <Languages className="w-3.5 h-3.5" />{lang === 'en' ? 'عربي' : 'EN'}
                        </button>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* body */}
                <div ref={scrollRef} className="p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{step.title}</h3>
                    {step.instruction && <p className="text-sm text-slate-600 mb-4">{step.instruction}</p>}

                    {step.type === 'brief' && (
                        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
                            {(t(step.body, step.bodyAr) || []).map((p, i) => (
                                <p key={i} className="text-sm text-slate-800 leading-relaxed">{p}</p>
                            ))}
                        </div>
                    )}
                    {step.type === 'form' && <FormStep step={step} value={responses[step.id]} onChange={setResponse} result={result} t={t} locked={locked} />}
                    {step.type === 'checklist' && <ChecklistStep step={step} value={responses[step.id]} onChange={setResponse} result={result} t={t} locked={locked} />}
                    {step.type === 'classify' && <ClassifyStep step={step} value={responses[step.id]} onChange={setResponse} result={result} t={t} locked={locked} />}
                    {(step.type === 'mcq' || step.type === 'media') && <McqStep step={step} value={responses[step.id]} onChange={setResponse} result={result} locked={locked} />}
                    {step.type === 'match' && <MatchStep step={step} value={responses[step.id]} onChange={setResponse} result={result} locked={locked} />}

                    {immediate && result && <FeedbackBanner result={result} explain={step.explain} />}
                </div>

                {/* footer */}
                <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-3">
                    <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
                        <ChevronLeft className="w-4 h-4" /> Back
                    </Button>
                    <div className="flex items-center gap-2">
                        {step.type !== 'brief' && immediate && !result && !review && (
                            <Button onClick={check} disabled={!answered}>Check answer</Button>
                        )}
                        {(step.type === 'brief' || result || review || !immediate) && (
                            <Button onClick={next} disabled={!review && !immediate && step.type !== 'brief' && !answered}>
                                {index === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default ExercisePlayer;
