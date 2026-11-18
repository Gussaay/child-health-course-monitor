// src/components/imnci/onlineCourses/practice.jsx
//
// Practice built the way a health worker meets the work: a named child, the
// chart booklet and the child's recording form one tap away, a decision, and
// feedback that says why in that child's terms.
//
//   scenario    a set of short cases ("Case 2 of 4"), each with its booklet
//               table and its filled recording form
//   spot        "find the error": a filled recording form where one entry is
//               wrong and the learner taps it
//   drill       a skill drill on a video (count the breaths), then a decision
//   classcards  the red, yellow and green rows of a classification table as
//               cards to open
//   reflect     questions to think over at the end of a module, kept on the
//               learner's device, with an optional 1 to 5 rating
//
// Every one reports "done" to the lesson (useActivity), and the ones with a
// right answer record whether the first try was right (useFirstTry), so the
// progress pages can show how often learners got it right first time.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2, XCircle, ArrowRight, BookOpen, ClipboardList, Users, Search, Timer, Palette, NotebookPen, Star, RotateCcw,
} from 'lucide-react';
import { NATIONAL_PROTOCOLS } from '../nationalProtocol';
import { BookletProtocolView } from '../bookletView';
import { Frame, Html, useActivity, useFirstTry, useChoice, ChoiceOptions, triesAllowed } from './interactive';
import { Overlay, VideoBlock, useLiveProtocols } from './blocks';

// -----------------------------------------------------------------------------
// Answers: one right option (`answer`) or several (`answers`), with an
// optional line of feedback for each option (`feedback`).
// -----------------------------------------------------------------------------

/** The right options of a question as a sorted list of indexes. */
export function rightOptions(q) {
    if (Array.isArray(q?.answers) && q.answers.length) return [...new Set(q.answers.map(Number))].sort((a, b) => a - b);
    return [Number(q?.answer ?? 0)];
}
export const isMulti = (q) => Array.isArray(q?.answers) && q.answers.length > 0;
/** Whether the picked options are exactly the right ones. */
export function pickedRight(q, picked) {
    const want = rightOptions(q);
    const got = [...new Set((picked || []).map(Number))].sort((a, b) => a - b);
    return want.length === got.length && want.every((x, i) => x === got[i]);
}

/**
 * The options of one question, answered once: a tap for a single answer, ticks
 * and Check for "select all that apply". After answering every option shows
 * whether it was right, the feedback for what was picked, and the general
 * explanation. `onAnswered(right)` is called on each answer; Try again clears it.
 */
export function AnswerOptions(props) {
    // One right answer: a wrong pick gives its feedback as a hint and the
    // learner tries again; the answer shows after a right pick or two wrong
    // ones (ChoiceOptions). onAnswered gets whether it was right first time.
    // With allowRetry false, or several right answers, it is answered at once.
    const { q, allowRetry = true } = props;
    return !isMulti(q) && allowRetry ? <SingleChoice {...props} /> : <AnswerAtOnce {...props} />;
}

// The result of the latest try, for the card around the question to show:
// 'right', 'wrong' or null before any try.
function useReportResult(result, onResult) {
    React.useEffect(() => { onResult?.(result); }, [result]); // eslint-disable-line react-hooks/exhaustive-deps
}

function SingleChoice({ q, onAnswered, onResult, compact = false }) {
    const { t } = useTranslation();
    // With two options, one wrong pick already gives the answer away.
    const maxTries = Math.min(triesAllowed(q), Math.max(1, (q.options || []).length - 1));
    const choice = useChoice(q.answer ?? 0, maxTries);
    const told = React.useRef(false);
    React.useEffect(() => {
        if (choice.shown && !told.current) { told.current = true; onAnswered?.(choice.firstTime, choice); }
    }, [choice.shown]); // eslint-disable-line react-hooks/exhaustive-deps
    useReportResult(choice.right ? 'right' : choice.wrong.length ? 'wrong' : null, onResult);
    return (
        <>
            <ChoiceOptions small={compact} options={q.options || []} answer={q.answer ?? 0} feedback={q.feedback || []}
                explanation={q.explanation} choice={choice} maxTries={maxTries} />
            {choice.shown && !choice.firstTime && (
                <button onClick={choice.reset}
                    className="text-xs text-sky-700 font-semibold mt-2 hover:underline inline-flex items-center gap-1">
                    <RotateCcw size={12} /> {t('imnci_ui.courses.question.try_again', 'try again')}
                </button>
            )}
        </>
    );
}

function AnswerAtOnce({ q, onAnswered, onResult, allowRetry = true, compact = false }) {
    const { t } = useTranslation();
    const multi = isMulti(q);
    const right = rightOptions(q);
    const [ticked, setTicked] = useState([]);
    const [answered, setAnswered] = useState(null); // the picked list once answered
    const options = q.options || [];
    const feedback = q.feedback || [];
    const answer = (list) => { setAnswered(list); onAnswered?.(pickedRight(q, list)); };
    const ok = answered && pickedRight(q, answered);
    const pad = compact ? 'min-h-[40px] px-3 py-2 text-sm' : 'min-h-[44px] px-3 py-2.5 text-sm sm:text-base';
    const said = (answered || []).map((i) => feedback[i]).filter((f) => f && String(f).trim());
    useReportResult(answered ? (ok ? 'right' : 'wrong') : null, onResult);
    return (
        <div>
            {multi && !answered && (
                <div className="text-xs font-semibold text-slate-500 mb-2">{t('imnci_ui.courses.practice.select_all', 'Select all that apply, then press Check.')}</div>
            )}
            <div className="space-y-2">
                {options.map((opt, i) => {
                    const isRight = right.includes(i);
                    const chosen = answered ? answered.includes(i) : ticked.includes(i);
                    const tone = answered
                        ? (isRight ? 'border-emerald-500 bg-emerald-50 text-slate-900' : chosen ? 'border-rose-400 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-500')
                        : chosen ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-white';
                    const onClick = () => {
                        if (answered) return;
                        if (multi) setTicked((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]));
                        else answer([i]);
                    };
                    return (
                        <button key={i} onClick={onClick} disabled={!!answered} aria-pressed={chosen}
                            className={`w-full text-start rounded-xl border flex items-center gap-3 transition-colors ${pad} ${tone}`}>
                            <span className={`w-7 h-7 ${multi ? 'rounded-md' : 'rounded-full'} border grid place-items-center text-xs font-bold shrink-0 ${chosen ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-300'}`}>
                                {multi && chosen && !answered ? '✓' : String.fromCharCode(65 + i)}
                            </span>
                            <span className="flex-1"><Html html={opt} /></span>
                            {answered && isRight && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
                            {answered && !isRight && <XCircle size={18} className={`shrink-0 ${chosen ? 'text-rose-600' : 'text-slate-300'}`} />}
                        </button>
                    );
                })}
            </div>
            {multi && !answered && (
                <button onClick={() => answer(ticked)} disabled={!ticked.length}
                    className="mt-3 inline-flex items-center gap-1 min-h-[40px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:opacity-40">
                    {t('imnci_ui.courses.practice.check', 'Check')}
                </button>
            )}
            {answered && (
                <div className={`mt-3 rounded-xl border p-3 sm:p-4 text-sm bg-white ${ok ? 'border-emerald-300' : 'border-rose-300'}`}>
                    <div className={`font-bold ${ok ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {ok ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}
                    </div>
                    {said.map((f, k) => <p key={k} className="text-slate-800 mt-1"><Html html={f} /></p>)}
                    {q.explanation && <p className="text-slate-700 mt-1"><Html html={q.explanation} /></p>}
                    {allowRetry && !ok && (
                        <button onClick={() => { setAnswered(null); setTicked([]); }}
                            className="text-xs text-sky-700 font-semibold mt-2 hover:underline inline-flex items-center gap-1">
                            <RotateCcw size={12} /> {t('imnci_ui.courses.question.try_again', 'try again')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// The child's recording form, filled in
// -----------------------------------------------------------------------------

// Handwriting, as on a real form: what the health worker wrote stands apart
// from the printed form.
const HAND = { fontFamily: '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Noto Sans Arabic", cursive' };

/**
 * A child's recording form as the health worker filled it: the header lines,
 * then each part of the form with what was found and how it was classified.
 * One column on a phone, the findings beside the classification on a wider
 * screen. `onPick(section, line)` makes each finding a button (find the error).
 */
export function FilledForm({ child = {}, record = [], part = 'child', onPick, picked, result }) {
    const { t } = useTranslation();
    const title = part === 'infant'
        ? t('imnci_ui.courses.practice.form_infant', 'Management of the sick young infant, up to 2 months')
        : t('imnci_ui.courses.practice.form_child', 'Management of the sick child, 2 months up to 5 years');
    const head = [
        [t('imnci_ui.courses.practice.name', 'Name'), child.name],
        [t('imnci_ui.courses.practice.age', 'Age'), child.age],
        [t('imnci_ui.courses.practice.weight', 'Weight'), child.weight && `${child.weight} kg`],
        [t('imnci_ui.courses.practice.length', 'Length or height'), child.length && `${child.length} cm`],
        [t('imnci_ui.courses.practice.temperature', 'Temperature'), child.temp && `${child.temp} °C`],
        [t('imnci_ui.courses.practice.muac', 'MUAC'), child.muac && `${child.muac} cm`],
    ].filter(([, v]) => v);
    return (
        <div className="not-prose rounded-xl border-2 border-slate-800 bg-white text-slate-900 text-sm">
            <div className="px-3 py-2 border-b-2 border-slate-800 font-extrabold uppercase tracking-wide text-[13px]">{title}</div>
            <div className="px-3 py-2 border-b border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {head.map(([k, v]) => (
                    <div key={k} className="min-w-0"><span className="text-slate-500 text-xs">{k}: </span><span className="text-blue-800" style={HAND}>{v}</span></div>
                ))}
                {child.problem && (
                    <div className="col-span-2 sm:col-span-3"><span className="text-slate-500 text-xs">{t('imnci_ui.courses.practice.problems', 'Ask: what are the child’s problems?')} </span><span className="text-blue-800" style={HAND}>{child.problem}</span></div>
                )}
                {child.visit && (
                    <div className="col-span-2 sm:col-span-3 text-xs text-slate-500">
                        {child.visit === 'follow-up' ? t('imnci_ui.courses.practice.follow_up_visit', 'Follow-up visit') : t('imnci_ui.courses.practice.initial_visit', 'Initial visit')}
                    </div>
                )}
            </div>
            {record.map((sec, si) => (
                <div key={si} className="border-b last:border-b-0 border-slate-300">
                    <div className="px-3 py-1.5 bg-slate-100 font-bold text-xs uppercase tracking-wide">{sec.title}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem]">
                        <ul className="px-3 py-2 space-y-1">
                            {(sec.lines || []).map((l, li) => {
                                const line = typeof l === 'string' ? { text: l } : l;
                                const here = picked && picked[0] === si && picked[1] === li;
                                const mark = here && result ? (result === 'right' ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'ring-2 ring-rose-400 bg-rose-50') : '';
                                const content = <span className="text-blue-800" style={HAND}>{line.text}</span>;
                                return (
                                    <li key={li}>
                                        {onPick ? (
                                            <button onClick={() => onPick(si, li)}
                                                className={`w-full text-start rounded-md px-2 py-1 border border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50 ${mark}`}>
                                                {content}
                                            </button>
                                        ) : content}
                                    </li>
                                );
                            })}
                        </ul>
                        {(sec.classify || []).length > 0 && (
                            <div className="px-3 py-2 border-t sm:border-t-0 sm:border-s border-slate-300">
                                <div className="text-[10px] font-bold uppercase text-slate-500">{t('imnci_ui.courses.practice.classify', 'Classify')}</div>
                                {sec.classify.map((c, ci) => {
                                    const line = typeof c === 'string' ? { text: c } : c;
                                    const si2 = `c${ci}`;
                                    const here = picked && picked[0] === si && picked[1] === si2;
                                    const mark = here && result ? (result === 'right' ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'ring-2 ring-rose-400 bg-rose-50') : '';
                                    const content = <span className="text-blue-800 uppercase" style={HAND}>{line.text}</span>;
                                    return onPick ? (
                                        <button key={ci} onClick={() => onPick(si, si2)}
                                            className={`block w-full text-start rounded-md px-2 py-1 mt-1 border border-dashed border-slate-300 hover:border-sky-500 hover:bg-sky-50 ${mark}`}>
                                            {content}
                                        </button>
                                    ) : <div key={ci}>{content}</div>;
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** The booklet tables a case needs, read live from the protocol, in an overlay. */
function BookletOverlay({ part, categories, onClose }) {
    const { t } = useTranslation();
    const live = useLiveProtocols();
    const p = part === 'infant' ? 'infant' : 'child';
    const protocol = live[p]?.categories ? live[p] : NATIONAL_PROTOCOLS[p];
    const doses = live[`dosages_${p}`]?.drugs || NATIONAL_PROTOCOLS[`dosages_${p}`]?.drugs || [];
    const cats = Object.fromEntries(Object.entries(protocol?.categories || {}).filter(([k]) => !(categories || []).length || categories.includes(k)));
    return (
        <Overlay title={t('imnci_ui.courses.practice.chart_table', 'Chart booklet: assess and classify')} onClose={onClose}>
            <BookletProtocolView formType={p} protocol={{ ...protocol, categories: cats }} doses={doses} heading={false} />
        </Overlay>
    );
}

const btn = 'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-sm font-semibold';

// -----------------------------------------------------------------------------
// Practice cases
// -----------------------------------------------------------------------------

export function ScenarioBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const cases = (block.cases || []).filter((c) => c && (c.question || c.text));
    const [at, setAt] = useState(0);
    const [answered, setAnswered] = useState(() => new Set());
    const [show, setShow] = useState(null); // 'chart' | 'form'
    const [result, setResult] = useState(null);
    const [done, markDone] = useActivity(activityKey);
    const firstTry = useFirstTry(activityKey);
    const c = cases[at];
    if (!c) return null;
    const onAnswered = (right) => {
        firstTry(right, `c${at}`);
        const next = new Set(answered).add(at);
        setAnswered(next);
        if (next.size >= cases.length) markDone();
    };
    const hasForm = (c.record || []).length > 0;
    const who = c.child?.name || c.name;
    return (
        <Frame icon={Users} tone="indigo" done={done} result={result} label={block.label || t('imnci_ui.courses.practice.cases', 'Test your skill')} title={block.title}>
            {block.text && at === 0 && <div className="text-sm sm:text-base text-slate-700 mb-3"><Html html={block.text} /></div>}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                    {t('imnci_ui.courses.practice.case_n', 'Case {{n}} of {{total}}', { n: at + 1, total: cases.length })}
                </span>
                <div className="flex gap-1 flex-1">
                    {cases.map((_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${answered.has(i) ? 'bg-indigo-600' : i === at ? 'bg-indigo-300' : 'bg-slate-200'}`} />
                    ))}
                </div>
            </div>
            {c.text && <div className="text-sm sm:text-base text-slate-800 rounded-lg bg-slate-50 border border-slate-200 p-3"><Html html={c.text} /></div>}
            <div className="flex flex-wrap gap-2 mt-3">
                {(block.categories || []).length > 0 && (
                    <button onClick={() => setShow('chart')} className={`${btn} bg-pink-700 text-white hover:bg-pink-800`}>
                        <BookOpen size={15} /> {t('imnci_ui.courses.practice.see_chart', 'See the chart booklet table')}
                    </button>
                )}
                {hasForm && (
                    <button onClick={() => setShow('form')} className={`${btn} bg-pink-700 text-white hover:bg-pink-800`}>
                        <ClipboardList size={15} /> {who ? t('imnci_ui.courses.practice.see_form_of', 'See {{name}}’s recording form', { name: who }) : t('imnci_ui.courses.practice.see_form', 'See the recording form')}
                    </button>
                )}
            </div>
            {c.question && (
                <div className="mt-4">
                    <div className="font-semibold text-slate-900 mb-2"><Html html={c.question} /></div>
                    <AnswerOptions key={at} q={c} onResult={setResult} onAnswered={onAnswered} />
                </div>
            )}
            {answered.has(at) && at < cases.length - 1 && (
                <button onClick={() => setAt(at + 1)} className={`${btn} mt-3 bg-indigo-700 text-white hover:bg-indigo-800`}>
                    {t('imnci_ui.courses.practice.next_case', 'Next case')} <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
            )}
            {at > 0 && (
                <button onClick={() => setAt(at - 1)} className="ms-2 text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2">
                    {t('imnci_ui.courses.practice.prev_case', 'Previous case')}
                </button>
            )}
            {show === 'chart' && <BookletOverlay part={block.part} categories={block.categories} onClose={() => setShow(null)} />}
            {show === 'form' && (
                <Overlay title={who ? t('imnci_ui.courses.practice.form_of', '{{name}}’s recording form', { name: who }) : t('imnci_ui.courses.practice.the_form', 'Recording form')} onClose={() => setShow(null)}>
                    <FilledForm child={c.child || {}} record={c.record} part={block.part} />
                </Overlay>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Find the error
// -----------------------------------------------------------------------------

/** Where the error is: [section, line] of the line marked `error`, or of a classification ("c0"). */
export function errorAt(record = []) {
    for (let si = 0; si < record.length; si += 1) {
        const li = (record[si].lines || []).findIndex((l) => l && typeof l === 'object' && l.error);
        if (li >= 0) return [si, li];
        const ci = (record[si].classify || []).findIndex((l) => l && typeof l === 'object' && l.error);
        if (ci >= 0) return [si, `c${ci}`];
    }
    return null;
}

export function SpotBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const [done, markDone] = useActivity(activityKey);
    const firstTry = useFirstTry(activityKey);
    const [picked, setPicked] = useState(null);
    const [found, setFound] = useState(false);
    const [tries, setTries] = useState(0);
    const target = useMemo(() => errorAt(block.record), [block.record]);
    const lineAt = (si, li) => {
        const sec = (block.record || [])[si] || {};
        const l = String(li).startsWith('c') ? (sec.classify || [])[Number(String(li).slice(1))] : (sec.lines || [])[li];
        return typeof l === 'string' ? { text: l } : (l || {});
    };
    const pick = (si, li) => {
        if (found) return;
        const right = !!target && target[0] === si && String(target[1]) === String(li);
        if (tries === 0) firstTry(right);
        setTries(tries + 1);
        setPicked([si, li]);
        if (right) { setFound(true); markDone(); }
    };
    const chosen = picked ? lineAt(picked[0], picked[1]) : null;
    return (
        <Frame icon={Search} tone="amber" done={done} label={block.label || t('imnci_ui.courses.practice.spot', 'Find the error')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-700 mb-3"><Html html={block.text} /></div>}
            <div className="text-xs font-semibold text-slate-500 mb-2">{t('imnci_ui.courses.practice.tap_error', 'Tap the entry that is wrong.')}</div>
            <FilledForm child={block.child || {}} record={block.record || []} part={block.part} onPick={pick} picked={picked}
                result={picked ? (found ? 'right' : 'wrong') : null} />
            {chosen && (
                <div className={`mt-3 rounded-xl border p-3 sm:p-4 text-sm ${found ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className={`font-bold ${found ? 'text-emerald-900' : 'text-rose-900'}`}>
                        {found ? t('imnci_ui.courses.practice.found_it', 'You found it.') : t('imnci_ui.courses.practice.not_this', 'This entry is correct. Look again.')}
                    </div>
                    {chosen.why && <p className="text-slate-800 mt-1"><Html html={chosen.why} /></p>}
                    {found && block.explanation && <p className="text-slate-700 mt-1"><Html html={block.explanation} /></p>}
                </div>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Skill drill on a video
// -----------------------------------------------------------------------------

export function DrillBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const [done, markDone] = useActivity(activityKey);
    const firstTry = useFirstTry(activityKey);
    const count = block.count || null;
    const needCount = !!(block.url && count && Number.isFinite(Number(count.answer)));
    const [typed, setTyped] = useState('');
    const [counted, setCounted] = useState(null); // 'ok' | 'off'
    const tolerance = Number(count?.tolerance ?? 2);
    const checkCount = () => {
        const n = Number(String(typed).replace(',', '.'));
        if (!Number.isFinite(n)) return;
        const ok = Math.abs(n - Number(count.answer)) <= tolerance;
        if (counted === null) firstTry(ok, 'count');
        setCounted(ok ? 'ok' : 'off');
    };
    const canAsk = !needCount || counted !== null;
    const [result, setResult] = useState(null);
    return (
        <Frame icon={Timer} tone="emerald" done={done} result={result} label={block.label || t('imnci_ui.courses.practice.drill', 'Skill drill')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-700 mb-2"><Html html={block.text} /></div>}
            <VideoBlock block={{ url: block.url, title: block.videoTitle || block.title, script: block.script }} activityKey={null} />
            {!block.url && block.given && (
                <div className="text-sm rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3">
                    <Html html={block.given} />
                </div>
            )}
            {needCount && (
                <div className="mt-3">
                    <label className="block font-semibold text-slate-900 mb-1">
                        {count.question || t('imnci_ui.courses.practice.how_many', 'How many did you count?')}
                    </label>
                    <div className="flex items-center gap-2">
                        <input type="number" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)}
                            className="w-28 border rounded-lg px-3 min-h-[40px]" aria-label={count.unit || ''} />
                        <span className="text-sm text-slate-600">{count.unit}</span>
                        <button onClick={checkCount} disabled={!typed} className={`${btn} bg-emerald-700 text-white disabled:opacity-40`}>
                            {t('imnci_ui.courses.practice.check', 'Check')}
                        </button>
                    </div>
                    {counted && (
                        <div className={`mt-2 text-sm rounded-lg border p-3 ${counted === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                            {counted === 'ok'
                                ? t('imnci_ui.courses.practice.count_ok', 'Good counting. The count is {{n}} {{unit}}.', { n: count.answer, unit: count.unit || '' })
                                : t('imnci_ui.courses.practice.count_off', 'The count is {{n}} {{unit}}. Watch again and count for one full minute.', { n: count.answer, unit: count.unit || '' })}
                        </div>
                    )}
                </div>
            )}
            {canAsk && block.question && (
                <div className="mt-4">
                    <div className="font-semibold text-slate-900 mb-2"><Html html={block.question} /></div>
                    <AnswerOptions q={block} onResult={setResult} onAnswered={(ok) => { firstTry(ok); markDone(); }} />
                </div>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Classification cards
// -----------------------------------------------------------------------------

const CARD_TONES = {
    pink: { card: 'bg-pink-200 border-pink-400 text-pink-950', bar: 'bg-pink-600' },
    red: { card: 'bg-pink-200 border-pink-400 text-pink-950', bar: 'bg-pink-600' },
    yellow: { card: 'bg-yellow-100 border-yellow-400 text-yellow-950', bar: 'bg-yellow-500' },
    green: { card: 'bg-emerald-100 border-emerald-400 text-emerald-950', bar: 'bg-emerald-600' },
};

export function ClassCardsBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const cards = block.cards || [];
    const [open, setOpen] = useState(null);
    const [seen, setSeen] = useState(() => new Set());
    const [done, markDone] = useActivity(activityKey);
    const openCard = (i) => {
        setOpen(open === i ? null : i);
        const next = new Set(seen).add(i);
        setSeen(next);
        if (next.size >= cards.length) markDone();
    };
    const c = open !== null ? cards[open] : null;
    return (
        <Frame icon={Palette} tone="sky" done={done} label={block.label || t('imnci_ui.courses.practice.classcards', 'Classifications')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-700 mb-3"><Html html={block.text} /></div>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {cards.map((card, i) => {
                    const tone = CARD_TONES[card.colour] || CARD_TONES.green;
                    return (
                        <button key={i} onClick={() => openCard(i)} aria-expanded={open === i}
                            className={`rounded-xl border-2 p-3 min-h-[84px] text-center font-extrabold uppercase text-sm leading-snug ${tone.card} ${open === i ? 'ring-2 ring-offset-1 ring-slate-700' : ''}`}>
                            <div>{card.label}</div>
                            {card.action && <div className="mt-1 text-[11px] font-bold opacity-80">{card.action}</div>}
                            {seen.has(i) && <CheckCircle2 size={14} className="mx-auto mt-1 opacity-60" />}
                        </button>
                    );
                })}
            </div>
            {c && (
                <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
                    <div className={`h-1.5 ${(CARD_TONES[c.colour] || CARD_TONES.green).bar}`} />
                    <div className="p-3 sm:p-4 text-sm space-y-2">
                        <div className="font-extrabold uppercase">{c.label}</div>
                        {c.signs && <div><span className="font-semibold">{t('imnci_ui.courses.practice.signs', 'Signs')}: </span><Html html={c.signs} /></div>}
                        {c.treat && <div><span className="font-semibold">{t('imnci_ui.courses.practice.treat', 'Treatment')}: </span><Html html={c.treat} /></div>}
                    </div>
                </div>
            )}
        </Frame>
    );
}

// -----------------------------------------------------------------------------
// Reflect (and rate)
// -----------------------------------------------------------------------------

const noteKey = (key) => `oc-reflect-${key}`;

export function ReflectBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const [done, markDone] = useActivity(activityKey);
    const record = useFirstTry(activityKey);
    const prompts = block.prompts || [];
    const [notes, setNotes] = useState(() => {
        try { return JSON.parse(localStorage.getItem(noteKey(activityKey)) || '{}'); } catch { return {}; }
    });
    const [rating, setRating] = useState(0);
    useEffect(() => {
        try { localStorage.setItem(noteKey(activityKey), JSON.stringify(notes)); } catch { /* private mode */ }
    }, [notes, activityKey]);
    const rate = (n) => { setRating(n); record.rate?.(n); };
    const ready = (!block.rating || rating > 0 || done);
    return (
        <Frame icon={NotebookPen} tone="violet" done={done} label={block.label || t('imnci_ui.courses.practice.reflect', 'Reflect')} title={block.title}>
            {block.text && <div className="text-sm sm:text-base text-slate-700 mb-3"><Html html={block.text} /></div>}
            <div className="space-y-3">
                {prompts.map((p, i) => (
                    <label key={i} className="block">
                        <span className="block text-sm font-semibold text-slate-800 mb-1"><Html html={p} /></span>
                        <textarea rows={2} dir="auto" value={notes[i] || ''} onChange={(e) => setNotes({ ...notes, [i]: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </label>
                ))}
            </div>
            {prompts.length > 0 && (
                <div className="text-[11px] text-slate-500 mt-1">{t('imnci_ui.courses.practice.kept_here', 'Your notes stay on this device. Nobody else reads them.')}</div>
            )}
            {block.rating && (
                <div className="mt-3">
                    <div className="text-sm font-semibold text-slate-800 mb-1">{block.ratingText || t('imnci_ui.courses.practice.rate', 'How useful was this module for your work?')}</div>
                    <div className="flex gap-1" role="radiogroup">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} onClick={() => rate(n)} role="radio" aria-checked={rating === n} title={String(n)}
                                className="p-1"><Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} /></button>
                        ))}
                    </div>
                    <div className="text-[11px] text-slate-500">{t('imnci_ui.courses.practice.rating_shared', 'Only the number of stars is shared with the course managers.')}</div>
                </div>
            )}
            {!done && (
                <button onClick={markDone} disabled={!ready} className={`${btn} mt-3 bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-40`}>
                    <CheckCircle2 size={16} /> {t('imnci_ui.courses.practice.reflect_done', 'Done')}
                </button>
            )}
        </Frame>
    );
}
