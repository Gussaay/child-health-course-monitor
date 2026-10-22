// src/components/imnci/onlineCourses/blocks.jsx
//
// How a section's content is shown to the learner: text, figures, captured
// book pages, videos, questions and links to practice cases.
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpenText, MonitorPlay, Stethoscope, CheckCircle2, GraduationCap, X } from 'lucide-react';
import { severityById } from '../../constants';
import { videoSource, blockHtml } from '../book';
import { RichText, useImnci } from '../shared';
import { useInPageBack } from '../../CommonComponents';
import { assetUrl } from './assets';

// =============================================================================
// Readable content
//
// A section that has been converted from its book renders as text here. The
// PDF link stays as a fallback for anything not converted yet, so the two can
// coexist while modules are done one at a time.
// =============================================================================

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
export function QuestionBlock({ block }) {
    const { t } = useTranslation();
    const [picked, setPicked] = useState(null);
    const options = block.options || [];
    return (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 not-prose">
            <div className="font-semibold text-slate-800 mb-3">{block.text}</div>
            <div className="space-y-2">
                {options.map((opt, i) => {
                    const chosen = picked === i;
                    const correct = i === (block.answer ?? 0);
                    const show = picked !== null;
                    return (
                        <button key={i} onClick={() => setPicked(i)} disabled={show}
                            className={`w-full text-start px-3 py-2 rounded border text-sm transition-colors ${
                                show && correct ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                                    : show && chosen ? 'border-rose-400 bg-rose-50 text-rose-900'
                                        : 'border-slate-300 bg-white hover:border-sky-400'}`}>
                            <span className="font-mono text-xs text-slate-400 me-2">
                                {String.fromCharCode(97 + i)}
                            </span>
                            {opt}
                            {show && correct && <CheckCircle2 size={14} className="inline ms-2 text-emerald-600" />}
                        </button>
                    );
                })}
            </div>
            {picked !== null && (
                <div className="mt-3 text-sm">
                    <div className={picked === (block.answer ?? 0) ? 'text-emerald-800 font-semibold' : 'text-rose-800 font-semibold'}>
                        {picked === (block.answer ?? 0) ? t('imnci_ui.courses.question.correct', 'Correct.') : t('imnci_ui.courses.question.not_quite', 'Not quite.')}
                    </div>
                    {block.explanation && <p className="text-slate-600 mt-1">{block.explanation}</p>}
                    <button onClick={() => setPicked(null)}
                        className="text-xs text-sky-700 font-semibold mt-2">{t('imnci_ui.courses.question.try_again', 'try again')}</button>
                </div>
            )}
        </div>
    );
}

// Video is embedded where the address is a YouTube or Vimeo link and played
// directly otherwise, so a file in Storage and a link to a WHO recording both
// work without the author having to know which is which.
export function VideoBlock({ block }) {
    const { t } = useTranslation();
    const src = videoSource(block.url);
    if (!src) {
        return (
            <div className="p-3 border border-dashed rounded text-xs text-slate-500 text-center not-prose">
                {t('imnci_ui.courses.video.no_address', 'A video with no address.')}
            </div>
        );
    }
    return (
        <figure className="my-4 not-prose">
            <div className="relative w-full rounded-lg overflow-hidden border border-slate-300 bg-black"
                style={{ aspectRatio: '16 / 9' }}>
                {src.kind === 'embed' ? (
                    <iframe src={src.src} title={block.caption || t('imnci_ui.courses.video.video', 'Video')} allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; encrypted-media; picture-in-picture" />
                ) : (
                    <video src={src.src} controls className="absolute inset-0 w-full h-full" />
                )}
            </div>
            {block.caption && <figcaption className="text-xs text-slate-500 text-center mt-1">{block.caption}</figcaption>}
        </figure>
    );
}

// A card for one of the graded exercises. The scenario and the learning points
// are shown from the exercise's own definition; the grading itself stays in
// Online Exercises, which is where attempts are recorded.
export function ExerciseLinkBlock({ block }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const { exercises } = useImnci();
    if (!exercises) return <div className="not-prose h-28 bg-slate-100 rounded-xl animate-pulse my-4" />;
    const ex = exercises.find((x) => x.id === block.exerciseId);
    if (!ex) {
        return (
            <div className="not-prose p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-900">
                {t('imnci_ui.courses.exlink.gone', 'This section points at an exercise ({{id}}) that is no longer in Online Exercises.', { id: block.exerciseId || t('imnci_ui.courses.exlink.none_chosen', 'none chosen') })}
            </div>
        );
    }
    return (
        <div className="not-prose border border-slate-200 rounded-xl overflow-hidden my-4">
            <div className="px-4 py-2.5 bg-slate-800 text-white flex flex-wrap items-center gap-2">
                <GraduationCap size={16} className="shrink-0" />
                <span className="font-bold text-sm flex-1">{ex.title}</span>
                <span className="text-xs text-slate-300">
                    {ex.estimatedMinutes ? t('imnci_ui.courses.exlink.minutes', '{{n}} min · ', { n: ex.estimatedMinutes }) : ''}{t('imnci_ui.courses.exlink.pass', 'pass {{n}}%', { n: ex.passMark ?? 80 })}
                </span>
            </div>
            <div className="p-4 space-y-3">
                {block.note && <p className="text-sm text-slate-600">{block.note}</p>}
                <ul className="space-y-1.5 text-sm text-slate-700">
                    {(isArabic && ex.narrativeAr?.length ? ex.narrativeAr : ex.narrative || []).map((line, i) => (
                        <li key={i} className="flex gap-2">
                            <span className="text-slate-400 mt-0.5">•</span><span>{line}</span>
                        </li>
                    ))}
                </ul>
                <div className="text-xs text-slate-500 border-t pt-2">
                    {t('imnci_ui.courses.exlink.work_in', 'Work this case, with the assessment form and a score, in')}
                    {' '}<strong>{t('imnci_ui.courses.exlink.online_exercises', 'Online Exercises')}</strong>.
                </div>
            </div>
        </div>
    );
}

// A table cell is plain text unless an author wrote markup into it (bold, a
// list, a line break), which is then shown as written rather than as tags.
const MARKUP = /<\/?(b|strong|i|em|u|br|ul|ol|li|p|span)\b/i;

export function ContentBlocks({ blocks, scale = 1 }) {
    if (!blocks?.length) return null;
    return (
        <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed space-y-3"
            style={{ fontSize: `${scale}rem` }}
        >
            {blocks.map((b, i) => {
                if (b.type === 'list') {
                    return (
                        <ul key={i} className="list-disc ms-6 space-y-1">
                            {b.items.map((it, j) => <li key={j}>{it}</li>)}
                        </ul>
                    );
                }
                if (b.type === 'heading') {
                    return (
                        <h4 key={i} className="font-bold text-slate-900 mt-4">
                            <RichText html={blockHtml(b)} className="inline" />
                        </h4>
                    );
                }
                if (b.type === 'rich') {
                    return <RichText key={i} html={b.text} />;
                }
                if (b.type === 'image' || b.type === 'page') {
                    return <BookImage key={i} block={b} />;
                }
                if (b.type === 'table') {
                    return (
                        <div key={i} className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm">
                                <tbody>
                                    {(b.rows || []).map((row, ri) => {
                                        const tone = severityById(row.colour || 'note');
                                        return (
                                            <tr key={ri}>
                                                {(row.cells || []).map((cell, ci) => (
                                                    <td key={ci} className={`border p-2 align-top whitespace-pre-line ${tone.row}`}>
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
                    return <QuestionBlock key={i} block={b} />;
                }
                if (b.type === 'video') {
                    return <VideoBlock key={i} block={b} />;
                }
                if (b.type === 'exercise') {
                    return <ExerciseLinkBlock key={i} block={b} />;
                }
                if (b.type === 'note') {
                    return (
                        <div key={i} className="p-3 bg-sky-50 border-s-4 border-sky-400 text-sky-900">
                            <RichText html={blockHtml(b)} />
                        </div>
                    );
                }
                return <RichText key={i} html={blockHtml(b)} />;
            })}
        </div>
    );
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
