// src/components/imnci/onlineCourses/blocks.jsx
//
// How a section's content is shown to the learner: text, figures, captured
// book pages, videos, questions and links to practice cases.
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpenText, MonitorPlay, Stethoscope, CheckCircle2, XCircle, GraduationCap, X, Lightbulb, ClipboardCheck,
    Play, Pencil, Film, BookOpen, Syringe,
} from 'lucide-react';
import { severityById } from '../../constants';
import { videoSource, blockHtml } from '../book';
import { RichText, useImnci } from '../shared';
import { useInPageBack } from '../../CommonComponents';
import { assetUrl } from './assets';
import { useDataCache } from '../../../DataContext';
import { NATIONAL_PROTOCOLS } from '../nationalProtocol';
import { NATIONAL_FORMS } from '../recordingForms';
import { BookletProtocolView } from '../bookletView';
import { RecordingFormView } from '../recordingFormView';
import { useCourseScreen } from './screen';
import { useActivity, RevealBlock, FlipBlock, SortBlock, StepsBlock, StoryBlock } from './interactive';

// The exercise players are heavy (the whole recording form), so they load
// only when a learner starts an exercise from a section.
const CasePlayer = lazy(() => import('../exercises.jsx').then((m) => ({ default: m.CasePlayer })));
const QuizPlayer = lazy(() => import('../exercises.jsx').then((m) => ({ default: m.QuizPlayer })));

// =============================================================================
// Readable content
//
// A section that has been converted from its book renders as text here. The
// PDF link stays as a fallback for anything not converted yet, so the two can
// coexist while modules are done one at a time.
// =============================================================================

import { activityKeyList, activityAnchor } from './activityKeys';

export { activityKeyList, activityKeys, activityOutline, activityAnchor } from './activityKeys';

// An icon per tab. Practise is a stethoscope rather than a pencil: what is
// being practised is examining a child, not writing.
export const TAB_ICONS = { read: BookOpenText, see: MonitorPlay, practise: Stethoscope };

export function BookImage({ block }) {
    const { t } = useTranslation();
    const { url, missing } = useAssetUrl(block.path);
    const [zoomed, setZoomed] = useState(false);
    // A whole page captured from the book, as opposed to a figure lifted out of
    // one. The classification charts are drawn as vectors, so their grid and
    // their colour — which is the clinical meaning — cannot be rebuilt from the
    // extracted text. The page picture is where they survive intact.
    const isPage = block.type === 'page';
    // A picture an author uploaded has no page behind it, so it is described as
    // a picture rather than as "Figure from page undefined".
    const what = !block.page ? t('imnci_ui.courses.image.picture', 'Picture')
        : isPage ? t('imnci_ui.courses.image.page_of_book', 'Page {{page}} of the book', { page: block.page })
            : t('imnci_ui.courses.image.figure_from_page', 'Figure from page {{page}}', { page: block.page });

    if (!block.path) {
        return (
            <div className="p-3 border border-dashed rounded text-xs text-slate-500 text-center">
                {t('imnci_ui.courses.image.not_uploaded', '{{what}} — not uploaded.', { what })}
            </div>
        );
    }
    if (missing) {
        // Offline, a picture that cannot be fetched is one that was not saved,
        // not one that is missing.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        return (
            <div className="p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-800 text-center">
                {offline
                    ? t('imnci_ui.courses.image.not_saved', '{{what}} is not saved on this device. Save the module for offline to see it without a connection.', { what })
                    : t('imnci_ui.courses.image.missing', '{{what}} is missing from storage.', { what })}
            </div>
        );
    }
    return url ? (
        <figure className={isPage ? 'my-4' : 'my-3'}>
            {/* Tapping opens the picture full screen: a captured chart page is
                unreadable at phone width, and pinching the whole page also
                enlarges the text around it. */}
            <button type="button" onClick={() => setZoomed(true)} className="block w-full cursor-zoom-in"
                title={t('imnci_ui.courses.image.open_full', 'open full size')}>
                <img src={url} alt={block.alt || what}
                    className={`max-w-full h-auto mx-auto ${isPage
                        ? 'rounded-lg border border-slate-300 shadow-sm w-full'
                        : 'rounded border'}`} loading="lazy" />
            </button>
            {(block.caption || isPage) && (
                <figcaption className="text-xs text-slate-500 text-center mt-1">
                    {block.caption || what}
                </figcaption>
            )}
            {zoomed && <ImageViewer url={url} alt={block.alt || what} onClose={() => setZoomed(false)} />}
        </figure>
    ) : <div className={`${isPage ? 'h-72' : 'h-24'} bg-slate-100 rounded animate-pulse`} />;
}

// One picture over the whole screen, at its own size so it can be scrolled and
// pinched. Escape, the close button or the phone's back step closes it.
function ImageViewer({ url, alt, onClose }) {
    const { t } = useTranslation();
    useInPageBack(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" role="dialog" aria-modal="true" aria-label={alt}>
            <div className="flex justify-end p-2 shrink-0">
                <button type="button" onClick={onClose} title={t('imnci_ui.courses.main.close', 'Close')}
                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
                    <X size={22} />
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto" onClick={onClose}>
                <img src={url} alt={alt} onClick={(e) => e.stopPropagation()}
                    className="max-w-none mx-auto my-2 bg-white" style={{ width: 'min(1400px, 200vw)' }} />
            </div>
        </div>
    );
}

// A question is answered in place rather than in a separate quiz screen: the
// learner picks, sees straight away whether they were right, and reads why.
// Nothing is scored or stored — this is self-assessment, and a health worker
// checking themselves should not feel they are being marked.
export function QuestionBlock({ block, number, total, activityKey }) {
    const { t } = useTranslation();
    const [picked, setPickedState] = useState(null);
    const [, markDone] = useActivity(activityKey);
    const setPicked = (v) => { setPickedState(v); if (v !== null) markDone(); };
    const options = block.options || [];
    const answer = block.answer ?? 0;
    const show = picked !== null;
    const right = picked === answer;
    return (
        <div className="not-prose rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm my-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded bg-sky-700 text-white text-[11px] font-bold uppercase tracking-wider">
                    {t('imnci_ui.courses.look.checkpoint', 'Checkpoint')}
                </span>
                {total > 1 && (
                    <span className="text-xs font-semibold text-slate-500">
                        {t('imnci_ui.courses.look.question_n', 'Question {{n}} of {{total}}', { n: number, total })}
                    </span>
                )}
                <ClipboardCheck size={18} className="ms-auto text-slate-400" />
            </div>
            <div className="font-semibold text-slate-900 text-base sm:text-lg leading-snug mb-3">{block.text}</div>
            <div className="space-y-2">
                {options.map((opt, i) => {
                    const chosen = picked === i;
                    const correct = i === answer;
                    const tone = show && correct ? 'border-sky-500 bg-sky-50 text-slate-900'
                        : show && chosen ? 'border-rose-400 bg-rose-50 text-rose-900'
                            : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-white';
                    const dot = show && correct ? 'bg-sky-700 text-white border-sky-700'
                        : show && chosen ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-600 border-slate-300';
                    return (
                        <button key={i} onClick={() => setPicked(i)} disabled={show}
                            className={`w-full text-start min-h-[44px] px-3 py-2.5 rounded-xl border text-sm sm:text-base flex items-center gap-3 transition-colors ${tone}`}>
                            <span className={`w-7 h-7 rounded-full border grid place-items-center text-xs font-bold shrink-0 ${dot}`}>
                                {String.fromCharCode(65 + i)}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {show && correct && <CheckCircle2 size={18} className="text-sky-700 shrink-0" />}
                            {show && chosen && !correct && <XCircle size={18} className="text-rose-600 shrink-0" />}
                        </button>
                    );
                })}
            </div>
            {show && (
                <div className={`mt-3 rounded-xl border p-3 sm:p-4 text-sm flex gap-3 ${right ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'}`}>
                    <Lightbulb size={18} className={`shrink-0 mt-0.5 ${right ? 'text-sky-700' : 'text-rose-700'}`} />
                    <div className="min-w-0">
                        <div className={`text-[11px] font-bold uppercase tracking-wider ${right ? 'text-sky-800' : 'text-rose-800'}`}>
                            {t('imnci_ui.courses.look.explanation', 'Explanation')}
                        </div>
                        <div className={`font-semibold mt-0.5 ${right ? 'text-sky-900' : 'text-rose-900'}`}>
                            {right ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}
                        </div>
                        {block.explanation && <p className="text-slate-700 mt-1">{block.explanation}</p>}
                        <button onClick={() => setPicked(null)}
                            className="text-xs text-sky-700 font-semibold mt-2 hover:underline">{t('imnci_ui.courses.question.try_again', 'try again')}</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Video is embedded where the address is a YouTube or Vimeo link and played
// directly otherwise, so a file in Storage and a link to a WHO recording both
// work without the author having to know which is which.
//
// A video that has not been recorded yet keeps its place in the section: the
// learner sees the player's frame and what it will show, and the narration
// script lives in a separate file for whoever records it. Chapters jump to a
// moment; stops pause a video file at a moment and ask a question before it
// goes on.
const clock = (sec) => `${Math.floor((Number(sec) || 0) / 60)}:${String(Math.floor((Number(sec) || 0) % 60)).padStart(2, '0')}`;

export function VideoBlock({ block, activityKey }) {
    const { t } = useTranslation();
    const screen = useCourseScreen();
    const src = videoSource(block.url);
    const [done, markDone] = useActivity(activityKey);
    const [startAt, setStartAt] = useState(null);
    const [stop, setStop] = useState(null);       // index of the stop being asked
    const [passed, setPassed] = useState(() => new Set());
    const [picked, setPicked] = useState(null);
    const videoRef = React.useRef(null);
    const chapters = (block.chapters || []).filter((c) => c && c.label);
    const stops = (block.stops || []).filter((q) => q && q.text);
    const title = block.title || block.caption;

    if (!src) {
        return (
            <figure className="my-4 not-prose">
                <div className="relative w-full rounded-xl overflow-hidden border border-slate-300 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm grid place-items-center text-center p-6"
                    style={{ aspectRatio: '16 / 9' }}>
                    <div className="space-y-2 max-w-md">
                        <span className="mx-auto w-14 h-14 rounded-full bg-white/10 grid place-items-center"><Film size={26} /></span>
                        {title && <div className="font-bold text-base sm:text-lg leading-snug">{title}</div>}
                        <div className="text-xs sm:text-sm text-slate-300">{t('imnci_ui.courses.video.coming', 'This video is being recorded. It will play here.')}</div>
                        {screen?.isAdmin && block.script && (
                            <div className="text-[11px] text-amber-300">{t('imnci_ui.courses.video.script_ref', 'Narration script {{id}} is in the video scripts file.', { id: block.script })}</div>
                        )}
                    </div>
                </div>
                {block.caption && block.caption !== title && <figcaption className="text-xs text-slate-500 text-center mt-1">{block.caption}</figcaption>}
            </figure>
        );
    }

    const seek = (sec) => {
        if (src.kind === 'embed') { setStartAt(Math.floor(Number(sec) || 0)); return; }
        const v = videoRef.current;
        if (v) { v.currentTime = Number(sec) || 0; v.play?.().catch(() => {}); }
    };
    // YouTube starts at ?start=; Vimeo takes a #t= timecode instead.
    const embedSrc = src.kind === 'embed' && startAt != null
        ? (/vimeo\.com/.test(src.src)
            ? `${src.src.split('#')[0]}${src.src.includes('?') ? '&' : '?'}autoplay=1#t=${startAt}s`
            : `${src.src}${src.src.includes('?') ? '&' : '?'}start=${startAt}&autoplay=1`)
        : src.src;
    const onTime = (e) => {
        const now = e.currentTarget.currentTime;
        const i = stops.findIndex((q, k) => !passed.has(k) && now >= (Number(q.at) || 0));
        if (i >= 0 && stop === null) { e.currentTarget.pause(); setStop(i); setPicked(null); }
    };
    const resume = () => {
        setPassed((p) => new Set(p).add(stop));
        setStop(null);
        videoRef.current?.play?.().catch(() => {});
    };
    const q = stop !== null ? stops[stop] : null;

    return (
        <figure className="my-4 not-prose">
            {title && (
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-800">
                    <Film size={16} className="text-sky-700" /> <span className="flex-1">{title}</span>
                    {done && <CheckCircle2 size={16} className="text-emerald-600" />}
                </div>
            )}
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-black shadow-sm"
                style={{ aspectRatio: '16 / 9' }}>
                {src.kind === 'embed' ? (
                    <iframe key={embedSrc} src={embedSrc} title={title || t('imnci_ui.courses.video.video', 'Video')} allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
                ) : (
                    <video ref={videoRef} src={src.src} controls playsInline className="absolute inset-0 w-full h-full"
                        onTimeUpdate={stops.length ? onTime : undefined} onEnded={markDone} />
                )}
                {q && (
                    <div className="absolute inset-0 bg-slate-900/90 text-white p-4 overflow-y-auto">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300 mb-1">{t('imnci_ui.courses.video.pause_question', 'Pause and answer')}</div>
                        <div className="font-semibold text-sm sm:text-base mb-2">{q.text}</div>
                        <div className="space-y-1.5">
                            {(q.options || []).map((o, oi) => {
                                const isAns = oi === (q.answer ?? 0);
                                const tone = picked === null ? 'border-white/30 hover:border-sky-300'
                                    : isAns ? 'border-sky-300 bg-sky-500/20' : picked === oi ? 'border-rose-300 bg-rose-500/20' : 'border-white/20 opacity-70';
                                return (
                                    <button key={oi} disabled={picked !== null} onClick={() => setPicked(oi)}
                                        className={`w-full text-start px-3 py-2 rounded-lg border text-sm ${tone}`}>{o}</button>
                                );
                            })}
                        </div>
                        {picked !== null && (
                            <div className="mt-2 text-sm">
                                <span className="font-semibold">{picked === (q.answer ?? 0) ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}</span>{' '}
                                {q.explanation}
                                <div>
                                    <button onClick={resume} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-semibold text-sm">
                                        <Play size={14} /> {t('imnci_ui.courses.video.continue', 'Continue watching')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {chapters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {chapters.map((c, i) => (
                        <button key={i} onClick={() => seek(c.at)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs text-slate-700 hover:border-sky-400 hover:text-sky-700">
                            <span className="font-mono text-slate-400">{clock(c.at)}</span> {c.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                {block.caption && block.caption !== title ? <figcaption className="text-xs text-slate-500">{block.caption}</figcaption> : <span />}
                {activityKey != null && !done && src.kind === 'embed' && (
                    <button onClick={markDone} className="text-xs text-sky-700 font-semibold hover:underline">
                        {t('imnci_ui.courses.video.watched', 'I have watched it')}
                    </button>
                )}
            </div>
        </figure>
    );
}

// A card for one of the exercises. The scenario is shown from the exercise's
// own definition, and the learner works it here, in the same player Online
// Exercises uses, without leaving the section. An author opens the same
// exercise in the case builder from the card, so it is edited in one place
// and the correction reaches every course that links to it.
export function ExerciseLinkBlock({ block, activityKey }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const { exercises } = useImnci();
    const screen = useCourseScreen();
    const [playing, setPlaying] = useState(false);
    const [done, markDone] = useActivity(activityKey);
    if (!exercises) return <div className="not-prose h-28 bg-slate-100 rounded-xl animate-pulse my-4" />;
    const ex = exercises.find((x) => x.id === block.exerciseId);
    if (!ex) {
        return (
            <div className="not-prose p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-900">
                {t('imnci_ui.courses.exlink.gone', 'This section points at an exercise ({{id}}) that is no longer in Online Exercises.', { id: block.exerciseId || t('imnci_ui.courses.exlink.none_chosen', 'none chosen') })}
            </div>
        );
    }
    const isQuiz = ex.kind === 'quiz';
    const lines = isArabic && ex.narrativeAr?.length ? ex.narrativeAr : ex.narrative || [];
    // Done once the learner has had the case or quiz marked, not on opening it.
    const open = () => setPlaying(true);
    const Player = isQuiz ? QuizPlayer : CasePlayer;
    return (
        <div className="not-prose border border-slate-200 rounded-xl overflow-hidden my-4 bg-white shadow-sm">
            <div className="px-4 py-2.5 bg-slate-800 text-white flex flex-wrap items-center gap-2">
                <GraduationCap size={16} className="shrink-0" />
                <span className="font-bold text-sm flex-1">{ex.title}</span>
                {done && <CheckCircle2 size={16} className="text-emerald-300" />}
                <span className="text-xs text-slate-300">
                    {isQuiz ? t('imnci_ui.courses.exlink.questions', '{{n}} questions · ', { n: (ex.questions || []).length }) : ''}
                    {ex.estimatedMinutes ? t('imnci_ui.courses.exlink.minutes', '{{n}} min · ', { n: ex.estimatedMinutes }) : ''}{t('imnci_ui.courses.exlink.pass', 'pass {{n}}%', { n: ex.passMark ?? 80 })}
                </span>
            </div>
            <div className="p-4 space-y-3">
                {block.note && <p className="text-sm text-slate-600">{block.note}</p>}
                {lines.length > 0 && (
                    <ul className="space-y-1.5 text-sm text-slate-700">
                        {lines.slice(0, 6).map((line, i) => (
                            <li key={i} className="flex gap-2">
                                <span className="text-slate-400 mt-0.5">•</span><span>{line}</span>
                            </li>
                        ))}
                        {lines.length > 6 && <li className="text-slate-400 text-xs">…</li>}
                    </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={open}
                        className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                        <Play size={16} /> {done ? t('imnci_ui.courses.exlink.again', 'Do it again') : isQuiz ? t('imnci_ui.courses.exlink.start_quiz', 'Start') : t('imnci_ui.courses.exlink.start_case', 'Work this case')}
                    </button>
                    {screen?.isAdmin && screen?.setBuilder && (
                        <button onClick={() => screen.setBuilder({ kind: 'exercises', id: ex.id })}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700">
                            <Pencil size={14} /> {t('imnci_ui.courses.exlink.edit', 'Edit in the case builder')}
                        </button>
                    )}
                    {ex.draft && <span className="text-xs text-amber-700">{t('imnci_ui.courses.exlink.draft', 'Draft: only authors see it until it is published in the case builder.')}</span>}
                </div>
            </div>
            {playing && (
                <Overlay title={ex.title} onClose={() => setPlaying(false)}>
                    <Suspense fallback={<div className="h-40 bg-slate-100 rounded-xl animate-pulse" />}>
                        <Player exercise={ex} participant={null} onExit={() => setPlaying(false)} onChecked={markDone} />
                    </Suspense>
                    <p className="text-xs text-slate-500 text-center mt-4">
                        {t('imnci_ui.courses.exlink.practice_note', 'Practice in the course is marked but not recorded. Scored attempts for a training course are taken in Online Exercises.')}
                    </p>
                </Overlay>
            )}
        </div>
    );
}

// A full-screen pane over the section, with one scrolling area, closed by its
// button, Escape or the phone's back step.
export function Overlay({ title, onClose, children }) {
    const { t } = useTranslation();
    useInPageBack(onClose);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
            <div className="mx-auto w-full max-w-6xl bg-white sm:rounded-xl flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
                    <h2 className="font-bold text-slate-800 truncate">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={t('imnci_ui.courses.main.close', 'Close')}>
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">{children}</div>
            </div>
        </div>
    );
}

// =============================================================================
// Chart booklet and recording form, read live from the protocol
//
// A course does not keep its own copy of a classification table or of the
// recording form. It names the booklet tables (`categories`) or the form rows
// (`sections`) it wants, and they are drawn from the saved national protocol,
// so a change made in Protocol management shows in the course too. Until the
// saved protocol has loaded, or on a device that never loaded it, the national
// text that ships with the app is shown.
// =============================================================================

function useLiveProtocols() {
    const cache = useDataCache() || {};
    const { protocols, fetchProtocols } = cache;
    useEffect(() => { if (fetchProtocols) fetchProtocols(false).catch(() => {}); }, [fetchProtocols]);
    return protocols && !Array.isArray(protocols) ? protocols : {};
}

const pick = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys?.length || keys.includes(k)));

export function BookletBlock({ block }) {
    const { t } = useTranslation();
    const live = useLiveProtocols();
    const part = block.part === 'infant' ? 'infant' : 'child';
    const protocol = live[part]?.categories ? live[part] : NATIONAL_PROTOCOLS[part];
    const doses = live[`dosages_${part}`]?.drugs || NATIONAL_PROTOCOLS[`dosages_${part}`]?.drugs || [];
    const shown = { ...protocol, categories: pick(protocol?.categories, block.categories) };
    const screen = useCourseScreen();
    const [whole, setWhole] = useState(false);
    const canEdit = screen?.isAdmin && screen?.permissions?.canManageProtocols && screen?.setBuilder;
    return (
        <figure className="not-prose my-4">
            <BookletProtocolView formType={part} protocol={shown} doses={doses} heading={false} />
            <figcaption className="text-xs text-slate-500 text-center mt-1">
                {block.caption || t('imnci_ui.courses.booklet.caption', 'From the chart booklet')}
            </figcaption>
            {/* The table is the Sudan protocol itself, read live; the learner
                can open the whole booklet around it, and an author can correct
                the protocol without leaving the section. */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
                <button onClick={() => setWhole(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700">
                    <BookOpen size={14} /> {t('imnci_ui.courses.booklet.open_whole', 'Open the whole chart booklet')}
                </button>
                {canEdit && (
                    <button onClick={() => screen.setBuilder('protocol')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700">
                        <Syringe size={14} /> {t('imnci_ui.courses.booklet.edit', 'Edit in the protocol builder')}
                    </button>
                )}
            </div>
            {whole && (
                <Overlay title={part === 'infant' ? t('imnci_ui.courses.booklet.infant', 'Chart booklet: sick young infant') : t('imnci_ui.courses.booklet.child', 'Chart booklet: sick child')}
                    onClose={() => setWhole(false)}>
                    <BookletProtocolView formType={part} protocol={protocol} doses={doses} />
                </Overlay>
            )}
        </figure>
    );
}

export function FormBlock({ block }) {
    const { t } = useTranslation();
    const live = useLiveProtocols();
    const key = block.part === 'infant' ? 'form_infant' : 'form_child';
    const form = live[key]?.sections ? live[key] : NATIONAL_FORMS[key];
    const ids = block.sections || [];
    const shown = form ? { ...form, sections: (form.sections || []).filter((s) => !ids.length || ids.includes(s.id)) } : null;
    return (
        <figure className="not-prose my-4">
            <RecordingFormView form={shown} />
            <figcaption className="text-xs text-slate-500 text-center mt-1">
                {block.caption || t('imnci_ui.courses.form.caption', 'From the recording form')}
            </figcaption>
        </figure>
    );
}

// A table cell is plain text unless an author wrote markup into it (bold, a
// list, a line break), which is then shown as written rather than as tags.
const MARKUP = /<\/?(b|strong|i|em|u|br|ul|ol|li|p|span)\b/i;

// The app has no typography plugin, so lists written in rich text need their
// bullets and numbers put back here.
export const RICH_LISTS = '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6 [&_li]:my-1 [&_p]:my-2 [&_blockquote]:border-s-4 [&_blockquote]:border-slate-300 [&_blockquote]:ps-3 [&_blockquote]:text-slate-700';

export function ContentBlocks({ blocks, scale = 1, activities = false }) {
    const { t } = useTranslation();
    if (!blocks?.length) return null;
    // Activities are keyed by their place in the section, so the section can
    // count which have been done.
    const keys = activities ? activityKeyList(blocks) : [];
    const key = (i) => (activities ? keys[i] : null);
    // Questions are numbered among themselves, "Question 2 of 3".
    const questionTotal = blocks.filter((b) => b.type === 'question').length;
    let questionNo = 0;
    return (
        <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed space-y-3"
            style={{ fontSize: `${scale}rem` }}
        >
            {blocks.map((b, i) => {
                const el = block(b, i);
                // An activity carries an anchor, so the lesson's checklist can take the learner to it.
                return key(i) ? <div key={i} id={activityAnchor(key(i))} className="scroll-mt-24">{el}</div> : el;
            })}
        </div>
    );

    function block(b, i) {
        {
                if (b.type === 'list') {
                    return (
                        <ul key={i} className="list-disc ms-6 space-y-1">
                            {b.items.map((it, j) => <li key={j}>{it}</li>)}
                        </ul>
                    );
                }
                if (b.type === 'heading') {
                    return (
                        <h4 key={i} className="font-bold text-slate-900 mt-6 text-[1.15em] leading-snug flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0 mt-[0.55em]" aria-hidden="true" />
                            <RichText html={blockHtml(b)} className="inline" />
                        </h4>
                    );
                }
                if (b.type === 'rich') {
                    return <RichText key={i} html={b.text} className={RICH_LISTS} />;
                }
                if (b.type === 'image' || b.type === 'page') {
                    return <BookImage key={i} block={b} />;
                }
                if (b.type === 'table') {
                    return (
                        <div key={i} className="not-prose overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm my-4">
                            <table className="min-w-full border-collapse text-sm">
                                <tbody>
                                    {(b.rows || []).map((row, ri) => {
                                        const tone = severityById(row.colour || 'note');
                                        return (
                                            <tr key={ri}>
                                                {(row.cells || []).map((cell, ci) => (
                                                    <td key={ci} className={`border-b border-e last:border-e-0 border-slate-200 px-3 py-2.5 align-top whitespace-pre-line ${tone.row}`}>
                                                        {MARKUP.test(String(cell)) ? <RichText html={cell} /> : cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                if (b.type === 'question') {
                    questionNo += 1;
                    return <QuestionBlock key={i} block={b} number={questionNo} total={questionTotal} activityKey={key(i)} />;
                }
                if (b.type === 'video') {
                    return <VideoBlock key={i} block={b} activityKey={b.url ? key(i) : null} />;
                }
                if (b.type === 'exercise') {
                    return <ExerciseLinkBlock key={i} block={b} activityKey={key(i)} />;
                }
                if (b.type === 'reveal') return <RevealBlock key={i} block={b} activityKey={key(i)} />;
                if (b.type === 'flip') return <FlipBlock key={i} block={b} activityKey={key(i)} />;
                if (b.type === 'sort') return <SortBlock key={i} block={b} activityKey={key(i)} />;
                if (b.type === 'steps') return <StepsBlock key={i} block={b} activityKey={key(i)} />;
                if (b.type === 'story') return <StoryBlock key={i} block={b} activityKey={key(i)} />;
                if (b.type === 'booklet') {
                    return <BookletBlock key={i} block={b} />;
                }
                if (b.type === 'form') {
                    return <FormBlock key={i} block={b} />;
                }
                if (b.type === 'note') {
                    return (
                        <div key={i} className="not-prose rounded-xl border border-sky-200 border-s-4 border-s-sky-600 bg-sky-50 p-4 flex gap-3 my-4">
                            <span className="w-8 h-8 rounded-lg bg-white border border-sky-200 text-sky-700 grid place-items-center shrink-0">
                                <Lightbulb size={16} />
                            </span>
                            <div className="min-w-0 text-slate-800">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800 mb-0.5">
                                    {b.label || t('imnci_ui.courses.look.key_point', 'Key point')}
                                </div>
                                <RichText html={blockHtml(b)} />
                            </div>
                        </div>
                    );
                }
                return <RichText key={i} html={blockHtml(b)} />;
        }
    }
}

// =============================================================================
// Asset resolution
//
// Only figures now. The module books, exercise booklets and chart booklet used
// to be resolved here too, because a section was a page range in one of them.
// =============================================================================

export function useAssetUrl(path) {
    const [state, setState] = useState({ url: null, missing: false, loading: false });

    useEffect(() => {
        let alive = true;
        if (!path) { setState({ url: null, missing: false, loading: false }); return undefined; }
        setState({ url: null, missing: false, loading: true });
        assetUrl(path)
            .then((url) => { if (alive) setState({ url, missing: false, loading: false }); })
            // A missing object is expected while a book is mid-conversion, so it
            // is reported as "missing" rather than thrown as an error.
            .catch(() => { if (alive) setState({ url: null, missing: true, loading: false }); });
        return () => { alive = false; };
    }, [path]);

    return state;
}
