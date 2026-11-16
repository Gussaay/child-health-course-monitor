// src/components/imnci/onlineCourses/interactive.jsx
//
// The blocks a learner does something with, rather than reads: a think-first
// prompt, flip cards, sorting signs into groups, a procedure walked through a
// step at a time, and a case told in stages with a decision at each stage.
//
// Each one tells the section when it has been done (useActivity), so the
// section can show "3 of 5 activities done" and the learner can see their
// progress as they go. Nothing here is scored or stored on the server: this
// is practice. Graded work stays in the exercises.
import React, { createContext, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Eye, RotateCcw, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Lightbulb, Layers, Shuffle, ListOrdered, BookOpenCheck,
} from 'lucide-react';
import { RichText } from '../shared';

// -----------------------------------------------------------------------------
// Activity tracking
// -----------------------------------------------------------------------------

export const ActivityContext = createContext(null);

/** [done, markDone] for the activity at `key` in the open section. */
export function useActivity(key) {
    const ctx = useContext(ActivityContext);
    if (!ctx || key == null) return [false, () => {}];
    return [ctx.isDone(key), () => ctx.markDone(key)];
}

export const Html = ({ html, className = '' }) => (
    /<[a-z][\s\S]*>/i.test(String(html || ''))
        ? <RichText html={html} className={`[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5 [&_li]:my-0.5 ${className}`} />
        : <span className={`whitespace-pre-line ${className}`}>{html}</span>
);

export function Frame({ icon: Icon, label, tone = 'sky', done, children, title }) {
    const { t } = useTranslation();
    const tones = {
        sky: 'bg-sky-700', violet: 'bg-violet-700', emerald: 'bg-emerald-700', amber: 'bg-amber-600', indigo: 'bg-indigo-700',
    };
    return (
        <div className="not-prose rounded-xl border border-slate-200 bg-white shadow-sm my-4 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-[11px] font-bold uppercase tracking-wider ${tones[tone] || tones.sky}`}>
                    <Icon size={12} /> {label}
                </span>
                {done && (
                    <span className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={14} /> {t('imnci_ui.courses.activity.done', 'Done')}
                    </span>
                )}
            </div>
            {title && <div className="px-4 pt-2 font-semibold text-slate-900 text-base sm:text-lg leading-snug"><Html html={title} /></div>}
            <div className="p-4 pt-3">{children}</div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Think first, then reveal
// -----------------------------------------------------------------------------

export function RevealBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [done, markDone] = useActivity(activityKey);
    return (
        <Frame icon={Lightbulb} tone="amber" done={done}
            label={block.label || t('imnci_ui.courses.activity.think', 'Think first')} title={block.text}>
            {open ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-slate-800 text-sm sm:text-base">
                    <Html html={block.answer} />
                </div>
            ) : (
                <button onClick={() => { setOpen(true); markDone(); }}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700">
                    <Eye size={16} /> {t('imnci_ui.courses.activity.show_answer', 'Show the answer')}
                </button>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Flip cards
// -----------------------------------------------------------------------------

export function FlipBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const cards = block.cards || [];
    const [flipped, setFlipped] = useState(() => cards.map(() => false));
    const [seen, setSeen] = useState(() => new Set());
    const [done, markDone] = useActivity(activityKey);
    const flip = (i) => {
        setFlipped((p) => p.map((x, j) => (j === i ? !x : x)));
        setSeen((p) => {
            const n = new Set(p); n.add(i);
            if (n.size >= cards.length) markDone();
            return n;
        });
    };
    return (
        <Frame icon={Layers} tone="violet" done={done}
            label={t('imnci_ui.courses.activity.cards', 'Flip cards')} title={block.title}>
            <p className="text-xs text-slate-500 mb-3">
                {t('imnci_ui.courses.activity.cards_hint', 'Tap a card to turn it over. {{n}} of {{total}} turned.', { n: seen.size, total: cards.length })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.map((c, i) => (
                    <button key={i} onClick={() => flip(i)} aria-pressed={flipped[i]}
                        className={`text-start min-h-[96px] rounded-xl border-2 p-3 transition-colors ${flipped[i]
                            ? 'border-violet-300 bg-violet-50 text-slate-800'
                            : 'border-slate-200 bg-slate-50 hover:border-violet-400 text-slate-900'}`}>
                        <div className="flex items-start gap-2">
                            <span className="flex-1 text-sm sm:text-base">
                                {flipped[i] ? <Html html={c.back} /> : <span className="font-semibold"><Html html={c.front} /></span>}
                            </span>
                            <RotateCcw size={14} className="text-slate-400 shrink-0 mt-1" />
                        </div>
                    </button>
                ))}
            </div>
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Sort into groups
// -----------------------------------------------------------------------------

export function SortBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const groups = block.groups || [];
    const items = block.items || [];
    const [picks, setPicks] = useState({});
    const [done, markDone] = useActivity(activityKey);
    const answered = Object.keys(picks).length;
    const right = items.filter((it, i) => picks[i] === Number(it.group)).length;
    const pick = (i, g) => setPicks((p) => {
        if (p[i] !== undefined) return p;
        const n = { ...p, [i]: g };
        if (Object.keys(n).length >= items.length) markDone();
        return n;
    });
    const groupTone = ['bg-rose-600', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-700', 'bg-violet-700'];
    return (
        <Frame icon={Shuffle} tone="indigo" done={done}
            label={t('imnci_ui.courses.activity.sort', 'Sort it')} title={block.text}>
            <ul className="space-y-2">
                {items.map((it, i) => {
                    const chosen = picks[i];
                    const ok = chosen === Number(it.group);
                    return (
                        <li key={i} className={`rounded-lg border p-3 ${chosen === undefined ? 'border-slate-200 bg-slate-50'
                            : ok ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                            <div className="flex items-start gap-2 text-sm sm:text-base text-slate-900">
                                <span className="flex-1"><Html html={it.text} /></span>
                                {chosen !== undefined && (ok
                                    ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                    : <XCircle size={18} className="text-rose-600 shrink-0" />)}
                            </div>
                            {chosen === undefined ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {groups.map((g, gi) => (
                                        <button key={gi} onClick={() => pick(i, gi)}
                                            className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700">
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-1.5 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-block px-2 py-0.5 rounded text-white font-semibold ${groupTone[Number(it.group)] || 'bg-slate-600'}`}>
                                        {groups[Number(it.group)]}
                                    </span>
                                    {!ok && <span>{t('imnci_ui.courses.activity.you_chose', 'you chose {{g}}', { g: groups[chosen] })}</span>}
                                    {it.why && <span className="text-slate-600">· <Html html={it.why} /></span>}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {answered >= items.length && items.length > 0 && (
                <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm flex flex-wrap items-center gap-2">
                    <span className="font-bold text-indigo-900">
                        {t('imnci_ui.courses.activity.score', '{{n}} of {{total}} right', { n: right, total: items.length })}
                    </span>
                    {block.explanation && <span className="text-slate-700 basis-full"><Html html={block.explanation} /></span>}
                    <button onClick={() => setPicks({})} className="text-xs text-indigo-700 font-semibold hover:underline">
                        {t('imnci_ui.courses.question.try_again', 'try again')}
                    </button>
                </div>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Step by step
// -----------------------------------------------------------------------------

export function StepsBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const steps = block.steps || [];
    const [at, setAt] = useState(0);
    const [done, markDone] = useActivity(activityKey);
    const step = steps[at] || {};
    const go = (i) => { setAt(i); if (i >= steps.length - 1) markDone(); };
    if (!steps.length) return null;
    return (
        <Frame icon={ListOrdered} tone="emerald" done={done}
            label={t('imnci_ui.courses.activity.steps', 'Step by step')} title={block.title}>
            <div className="flex gap-1.5 mb-3" role="tablist">
                {steps.map((s, i) => (
                    <button key={i} onClick={() => go(i)} role="tab" aria-selected={i === at}
                        title={s.title}
                        className={`h-2 flex-1 rounded-full transition-colors ${i <= at ? 'bg-emerald-600' : 'bg-slate-200 hover:bg-slate-300'}`} />
                ))}
            </div>
            <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-full bg-emerald-700 text-white grid place-items-center font-bold shrink-0">{at + 1}</span>
                <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900"><Html html={step.title} /></div>
                    {step.text && <div className="text-sm sm:text-base text-slate-700 mt-1"><Html html={step.text} /></div>}
                </div>
            </div>
            <div className="flex items-center justify-between mt-4">
                <button onClick={() => go(Math.max(0, at - 1))} disabled={at === 0}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40">
                    <ArrowLeft size={16} className="rtl:rotate-180" /> {t('imnci_ui.courses.main.previous', 'Previous')}
                </button>
                <span className="text-xs text-slate-500 tabular-nums">{at + 1} / {steps.length}</span>
                {at < steps.length - 1 ? (
                    <button onClick={() => go(at + 1)}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800">
                        {t('imnci_ui.courses.activity.next_step', 'Next step')} <ArrowRight size={16} className="rtl:rotate-180" />
                    </button>
                ) : (
                    <button onClick={() => go(0)}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-emerald-300 text-sm font-semibold text-emerald-700">
                        <RotateCcw size={14} /> {t('imnci_ui.courses.activity.again', 'From the start')}
                    </button>
                )}
            </div>
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// A case in stages
// -----------------------------------------------------------------------------

export function StoryBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const stages = block.stages || [];
    const [reached, setReached] = useState(0);
    const [picks, setPicks] = useState({});
    const [done, markDone] = useActivity(activityKey);
    const next = (i) => { const n = i + 1; setReached(n); if (n >= stages.length) markDone(); };
    return (
        <Frame icon={BookOpenCheck} tone="sky" done={done}
            label={block.label || t('imnci_ui.courses.activity.case', 'Case')} title={block.title}>
            <ol className="space-y-4">
                {stages.slice(0, Math.min(reached + 1, stages.length)).map((s, i) => {
                    const options = s.options || [];
                    const picked = picks[i];
                    const hasQuestion = options.length > 0;
                    const answered = picked !== undefined;
                    const right = picked === (s.answer ?? 0);
                    return (
                        <li key={i} className="relative ps-5 border-s-2 border-sky-200">
                            <span className="absolute -start-[7px] top-1.5 w-3 h-3 rounded-full bg-sky-600" aria-hidden="true" />
                            {s.text && <div className="text-sm sm:text-base text-slate-800"><Html html={s.text} /></div>}
                            {hasQuestion && (
                                <div className="mt-2">
                                    <div className="font-semibold text-slate-900 text-sm sm:text-base"><Html html={s.question} /></div>
                                    <div className="space-y-1.5 mt-2">
                                        {options.map((o, oi) => {
                                            const isAns = oi === (s.answer ?? 0);
                                            const tone = answered && isAns ? 'border-sky-500 bg-sky-50'
                                                : answered && picked === oi ? 'border-rose-400 bg-rose-50'
                                                    : 'border-slate-200 bg-slate-50 hover:border-sky-400';
                                            return (
                                                <button key={oi} disabled={answered}
                                                    onClick={() => setPicks((p) => ({ ...p, [i]: oi }))}
                                                    className={`w-full text-start min-h-[40px] px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${tone}`}>
                                                    <span className="w-6 h-6 rounded-full border border-slate-300 bg-white grid place-items-center text-[11px] font-bold shrink-0">
                                                        {String.fromCharCode(65 + oi)}
                                                    </span>
                                                    <span className="flex-1"><Html html={o} /></span>
                                                    {answered && isAns && <CheckCircle2 size={16} className="text-sky-700" />}
                                                    {answered && picked === oi && !isAns && <XCircle size={16} className="text-rose-600" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {answered && (
                                        <div className={`mt-2 rounded-lg border p-3 text-sm ${right ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'}`}>
                                            <span className={`font-semibold ${right ? 'text-sky-900' : 'text-rose-900'}`}>
                                                {right ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}
                                            </span>{' '}
                                            {s.explanation && <span className="text-slate-700"><Html html={s.explanation} /></span>}
                                        </div>
                                    )}
                                </div>
                            )}
                            {i === reached && i < stages.length - 1 && (!hasQuestion || answered) && (
                                <button onClick={() => next(i)}
                                    className="mt-3 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                                    {t('imnci_ui.courses.activity.continue_case', 'Continue the case')} <ArrowRight size={16} className="rtl:rotate-180" />
                                </button>
                            )}
                            {i === stages.length - 1 && (!hasQuestion || answered) && !done && (
                                <button onClick={() => next(i)}
                                    className="mt-3 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                                    <CheckCircle2 size={16} /> {t('imnci_ui.courses.activity.finish_case', 'Finish the case')}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
        </Frame>
    );
}
