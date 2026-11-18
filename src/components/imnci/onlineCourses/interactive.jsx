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
    Eye, RotateCcw, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Lightbulb, Layers, Shuffle, ListOrdered, BookOpenCheck, Calculator,
    Stethoscope, UserRound,
} from 'lucide-react';
import { RichText } from '../shared';
import { AnswerOptions } from './practice';
import { useAssetUrl } from './blocks';

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

/**
 * Records whether the learner's first answer to an activity (or to one part of
 * it, `sub`) was right, once: later tries change nothing. It is kept with the
 * lesson's done list as "<key>@1" or "<key>@0", which the progress pages read
 * as first-try accuracy. `.rate(n)` keeps a 1 to 5 rating the same way.
 */
export function useFirstTry(key) {
    const ctx = useContext(ActivityContext);
    const record = (right, sub) => {
        if (!ctx || key == null) return;
        const base = sub ? `${key}#${sub}` : key;
        if (ctx.isDone(`${base}@1`) || ctx.isDone(`${base}@0`)) return;
        ctx.markDone(`${base}@${right ? 1 : 0}`);
    };
    record.rate = (n) => {
        if (!ctx || key == null) return;
        if ([1, 2, 3, 4, 5].some((k) => ctx.isDone(`${key}@r${k}`))) return;
        ctx.markDone(`${key}@r${n}`);
    };
    return record;
}

export const Html = ({ html, className = '' }) => (
    /<[a-z][\s\S]*>/i.test(String(html || ''))
        ? <RichText html={html} className={`[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5 [&_li]:my-0.5 ${className}`} />
        : <span className={`whitespace-pre-line ${className}`}>{html}</span>
);

export function Frame({ icon: Icon, label, tone = 'sky', done, children, title, result = null }) {
    const { t } = useTranslation();
    const tones = {
        sky: 'bg-sky-700', violet: 'bg-violet-700', emerald: 'bg-emerald-700', amber: 'bg-amber-600', indigo: 'bg-indigo-700',
    };
    return (
        <div data-result={result || undefined} className={`not-prose rounded-xl shadow-sm my-4 overflow-hidden transition-colors duration-300 ${result === 'right' ? 'border-2 border-emerald-500 bg-emerald-50' : result === 'wrong' ? 'border-2 border-rose-500 bg-rose-50' : 'border border-slate-200 bg-white'}`}>
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

// A photograph for one step (a path in the course files, such as a page of the
// photograph booklet). The step reads without it while it loads.
function StepImage({ path, alt }) {
    const { url } = useAssetUrl(path);
    if (!url) return null;
    return <img src={url} alt={alt || ''} loading="lazy" className="mt-2 w-full max-h-72 object-contain rounded-lg border border-slate-200 bg-slate-50" />;
}

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
                    {step.image && <StepImage path={step.image} alt={step.title} />}
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

// -----------------------------------------------------------------------------
// Choosing with a second chance
//
// A wrong pick does not give the answer away. The option is struck out and its
// own hint is shown ("Does the child have an emergency sign?") so the learner
// thinks again; the answer and the explanation come with a right pick, or
// after `maxTries` wrong ones (2 unless the block says otherwise). This is how
// a drill on the ward works: the facilitator gives a clue, not the answer.
// -----------------------------------------------------------------------------

export const triesAllowed = (block) => Math.max(1, Number(block?.maxTries) || 2);

/** The state of one choice: picks so far, and whether the answer is shown. */
export function useChoice(answer, maxTries = 2) {
    const [wrong, setWrong] = useState([]);
    const [right, setRight] = useState(false);
    const shown = right || wrong.length >= maxTries;
    const pick = (i) => {
        if (shown || wrong.includes(i)) return;
        if (i === answer) setRight(true); else setWrong((w) => [...w, i]);
    };
    const reset = () => { setWrong([]); setRight(false); };
    return { wrong, right, shown, pick, reset, last: wrong[wrong.length - 1], firstTime: right && wrong.length === 0 };
}

/** The options of one choice and what is said after each pick. */
export function ChoiceOptions({ options = [], answer = 0, feedback = [], explanation, choice, maxTries = 2, small = false }) {
    const { t } = useTranslation();
    const { wrong, right, shown, pick, last } = choice;
    const hint = !shown && last !== undefined ? feedback[last] : null;
    const tries = maxTries - wrong.length;
    return (
        <>
            <div className={small ? 'space-y-1.5 mt-2' : 'space-y-2'}>
                {options.map((o, oi) => {
                    const isAns = oi === answer;
                    const struck = wrong.includes(oi);
                    const tone = shown && isAns ? 'border-emerald-500 bg-emerald-50 text-slate-900'
                        : struck ? 'border-rose-300 bg-rose-50 text-rose-900 line-through decoration-rose-400'
                            : shown ? 'border-slate-200 bg-slate-50 text-slate-500'
                                : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-white';
                    return (
                        <button key={oi} type="button" disabled={shown || struck} onClick={() => pick(oi)} data-testid="choice-option"
                            className={`w-full text-start ${small ? 'min-h-[40px] px-3 py-2 rounded-lg text-sm gap-2' : 'min-h-[44px] px-3 py-2.5 rounded-xl text-sm sm:text-base gap-3'} border flex items-center transition-colors ${tone}`}>
                            <span className={`${small ? 'w-6 h-6 text-[11px]' : 'w-7 h-7 text-xs'} rounded-full border border-slate-300 bg-white grid place-items-center font-bold shrink-0 no-underline`}>
                                {String.fromCharCode(65 + oi)}
                            </span>
                            <span className="flex-1"><Html html={o} /></span>
                            {shown && isAns && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                            {struck && <XCircle size={16} className="text-rose-600 shrink-0" />}
                        </button>
                    );
                })}
            </div>
            {!shown && wrong.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm flex gap-2" data-testid="choice-hint">
                    <Lightbulb size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold text-amber-900">{t('imnci_ui.courses.question.not_yet', 'Not quite. Think again.')}</span>{' '}
                        {hint && <span className="text-slate-800"><Html html={hint} /></span>}
                        <div className="text-xs text-amber-800 mt-1">
                            {t('imnci_ui.courses.question.tries_left', '{{n}} more try before the answer is shown.', { n: tries, count: tries })}
                        </div>
                    </div>
                </div>
            )}
            {shown && (
                <div className={`mt-2 rounded-lg border p-3 text-sm bg-white ${right ? 'border-emerald-300' : 'border-rose-300'}`} data-testid="choice-result">
                    <span className={`font-semibold ${right ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {right
                            ? (wrong.length ? t('imnci_ui.courses.question.correct_now', 'Correct, this time.') : t('imnci_ui.courses.question.correct', 'Correct.'))
                            : t('imnci_ui.courses.question.the_answer', 'The answer is {{letter}}.', { letter: String.fromCharCode(65 + answer) })}
                    </span>{' '}
                    {!right && last !== undefined && feedback[last] && <span className="text-slate-800 block mt-1"><Html html={feedback[last]} /></span>}
                    {explanation && <span className="text-slate-700 block mt-1"><Html html={explanation} /></span>}
                </div>
            )}
        </>
    );
}

// A line of the conversation: the health worker on one side, the mother (or
// anyone else) on the other, as a chat reads.
const SELF = ['you', 'health worker', 'أنت', 'العامل الصحي', 'الكادر الصحي'];
function Dialogue({ lines, self = [] }) {
    const mine = (who) => [...SELF, ...self.map((x) => String(x).toLowerCase())].includes(String(who || '').trim().toLowerCase());
    return (
        <div className="space-y-2 my-2">
            {lines.map((l, k) => {
                const me = mine(l.who);
                return (
                    <div key={k} className={`flex items-end gap-2 ${me ? 'flex-row-reverse' : ''}`}>
                        <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${me ? 'bg-sky-700 text-white' : 'bg-amber-200 text-amber-900'}`} aria-hidden="true">
                            {me ? <Stethoscope size={15} /> : <UserRound size={15} />}
                        </span>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:text-base ${me ? 'bg-sky-50 border border-sky-200 rounded-ee-sm' : 'bg-amber-50 border border-amber-200 rounded-es-sm'}`}>
                            {l.who && <div className={`text-[11px] font-bold ${me ? 'text-sky-800' : 'text-amber-800'}`}>{l.who}</div>}
                            <Html html={l.text} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function StoryBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const stages = block.stages || [];
    const [reached, setReached] = useState(0);
    // How each stage went: 'first' (right first time), 'later' or 'shown'.
    const [results, setResults] = useState({});
    const [done, markDone] = useActivity(activityKey);
    const firstTry = useFirstTry(activityKey);
    const next = (i) => { const n = i + 1; setReached(n); if (n >= stages.length) markDone(); };
    const asked = stages.map((s, i) => ({ s, i })).filter(({ s }) => (s.options || []).length > 0);
    const firstTime = asked.filter(({ i }) => results[i] === 'first').length;
    const finished = reached >= stages.length;
    return (
        <Frame icon={BookOpenCheck} tone="sky" done={done}
            label={block.label || t('imnci_ui.courses.activity.case', 'Case')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-800 mb-3"><Html html={block.text} /></div>}
            <ol className="space-y-4">
                {stages.slice(0, Math.min(reached + 1, stages.length)).map((s, i) => (
                    <StoryStage key={i} stage={s} last={i === stages.length - 1} current={i === reached} done={done}
                        maxTries={triesAllowed(s.maxTries ? s : block)}
                        self={block.self || []}
                        onResult={(r) => { firstTry(r === 'first', `s${i}`); setResults((x) => ({ ...x, [i]: r })); }} onNext={() => next(i)} />
                ))}
            </ol>
            {finished && asked.length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm" data-testid="story-summary">
                    <div className="font-semibold text-emerald-900">
                        {t('imnci_ui.courses.activity.case_summary', 'Right first time at {{n}} of {{total}} decisions.', { n: firstTime, total: asked.length })}
                    </div>
                    {asked.some(({ i }) => results[i] && results[i] !== 'first') && (
                        <>
                            <div className="text-slate-700 mt-1">{t('imnci_ui.courses.activity.case_review', 'Read these again:')}</div>
                            <ul className="list-disc ps-5 mt-1 text-slate-800">
                                {asked.filter(({ i }) => results[i] && results[i] !== 'first').map(({ s, i }) => (
                                    <li key={i}><Html html={s.question} />{' '}<span className="text-slate-600">({String(s.options[s.answer ?? 0]).replace(/<[^>]*>/g, '')})</span></li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </Frame>
    );
}

function StoryStage({ stage: s, last, current, done, maxTries, self, onResult, onNext }) {
    const { t } = useTranslation();
    const options = s.options || [];
    const hasQuestion = options.length > 0;
    const answer = s.answer ?? 0;
    const choice = useChoice(answer, maxTries);
    const reported = React.useRef(false);
    React.useEffect(() => {
        if (!multi && choice.shown && !reported.current) {
            reported.current = true;
            onResult(choice.firstTime ? 'first' : choice.right ? 'later' : 'shown');
        }
    }, [choice.shown, choice.firstTime, choice.right, onResult]);
    // Several right answers ("select all that apply"): answered at once.
    const [multiDone, setMultiDone] = useState(false);
    const multi = Array.isArray(s.answers) && s.answers.length > 0;
    const settled = !hasQuestion || (multi ? multiDone : choice.shown);
    return (
        <li className="relative ps-5 border-s-2 border-sky-200" data-testid="story-stage">
            <span className="absolute -start-[7px] top-1.5 w-3 h-3 rounded-full bg-sky-600" aria-hidden="true" />
            {s.text && <div className="text-sm sm:text-base text-slate-800"><Html html={s.text} /></div>}
            {(s.dialogue || []).length > 0 && <Dialogue lines={s.dialogue} self={self} />}
            {hasQuestion && multi && (
                <div className="mt-2">
                    <div className="font-semibold text-slate-900 text-sm sm:text-base mb-2"><Html html={s.question} /></div>
                    <AnswerOptions compact allowRetry={false} q={s} onAnswered={(right) => { setMultiDone(true); onResult(right ? 'first' : 'shown'); }} />
                </div>
            )}
            {hasQuestion && !multi && (
                <div className="mt-2">
                    <div className="font-semibold text-slate-900 text-sm sm:text-base"><Html html={s.question} /></div>
                    <ChoiceOptions small options={options} answer={answer} feedback={s.feedback || []}
                        explanation={s.explanation} choice={choice} maxTries={maxTries} />
                </div>
            )}
            {current && !last && settled && (
                <button type="button" onClick={onNext}
                    className="mt-3 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                    {t('imnci_ui.courses.activity.continue_case', 'Continue the case')} <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
            )}
            {last && current && settled && !done && (
                <button type="button" onClick={onNext}
                    className="mt-3 inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                    <CheckCircle2 size={16} /> {t('imnci_ui.courses.activity.finish_case', 'Finish the case')}
                </button>
            )}
        </li>
    );
}

// -----------------------------------------------------------------------------
// Work it out: a dose, a volume or a drip rate, typed as a number
//
//   { type: 'calc', title, text: 'Amina weighs 12 kg ...', question: 'How many ml?',
//     answer: 240, tolerance: 0, unit: 'ml', hint: 'Use 20 ml/kg.', explanation: '12 × 20 = 240 ml' }
//
// `answers` (a list) takes more than one right number, for a range printed in a
// table. A wrong number gives the hint; the answer comes after two tries.
// -----------------------------------------------------------------------------

const toNumber = (v) => {
    const n = Number(String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(',', '.').trim());
    return String(v ?? '').trim() === '' || Number.isNaN(n) ? null : n;
};
export const calcAnswers = (b) => (Array.isArray(b?.answers) && b.answers.length ? b.answers : [b?.answer]).map(Number).filter((n) => !Number.isNaN(n));
export function calcIsRight(b, value) {
    const n = toNumber(value);
    if (n === null) return false;
    const tol = Math.abs(Number(b?.tolerance) || 0);
    return calcAnswers(b).some((a) => Math.abs(n - a) <= tol + 1e-9);
}

export function CalcBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [tries, setTries] = useState([]);
    const [right, setRight] = useState(false);
    const [done, markDone] = useActivity(activityKey);
    const max = triesAllowed(block);
    const shown = right || tries.length >= max;
    const unit = block.unit || '';
    const check = () => {
        if (shown || toNumber(value) === null) return;
        if (calcIsRight(block, value)) { setRight(true); markDone(); return; }
        const next = [...tries, value];
        setTries(next);
        if (next.length >= max) markDone();
    };
    const answers = calcAnswers(block);
    return (
        <Frame icon={Calculator} tone="emerald" done={done}
            label={block.label || t('imnci_ui.courses.activity.calc', 'Work it out')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-800 mb-2"><Html html={block.text} /></div>}
            {block.question && <div className="font-semibold text-slate-900 text-sm sm:text-base mb-2"><Html html={block.question} /></div>}
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); check(); }}>
                <input type="text" inputMode="decimal" value={value} disabled={shown} data-testid="calc-input"
                    onChange={(e) => setValue(e.target.value)} aria-label={block.question || t('imnci_ui.courses.activity.calc', 'Work it out')}
                    className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-base font-semibold disabled:bg-slate-100" />
                {unit && <span className="text-sm text-slate-700">{unit}</span>}
                {!shown && (
                    <button type="submit" disabled={toNumber(value) === null} data-testid="calc-check"
                        className="min-h-[40px] px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                        {t('imnci_ui.courses.activity.calc_check', 'Check')}
                    </button>
                )}
            </form>
            {!shown && tries.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm" data-testid="calc-hint">
                    <span className="font-semibold text-amber-900">{t('imnci_ui.courses.activity.calc_wrong', '{{v}} {{unit}} is not right.', { v: tries[tries.length - 1], unit })}</span>{' '}
                    {block.hint && <span className="text-slate-800"><Html html={block.hint} /></span>}
                </div>
            )}
            {shown && (
                <div className={`mt-2 rounded-lg border p-3 text-sm ${right ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-200'}`} data-testid="calc-result">
                    <span className={`font-semibold ${right ? 'text-sky-900' : 'text-rose-900'}`}>
                        {right ? t('imnci_ui.courses.question.correct', 'Correct.')
                            : t('imnci_ui.courses.activity.calc_answer', 'The answer is {{a}} {{unit}}.', { a: answers.join(' or '), unit })}
                    </span>{' '}
                    {block.explanation && <span className="text-slate-700 block mt-1"><Html html={block.explanation} /></span>}
                    {!right && (
                        <button type="button" onClick={() => { setTries([]); setValue(''); }} className="block text-xs text-sky-700 font-semibold mt-2 hover:underline">
                            {t('imnci_ui.courses.question.try_again', 'try again')}
                        </button>
                    )}
                </div>
            )}
        </Frame>
    );
}
