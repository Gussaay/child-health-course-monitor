// src/components/imnci/courses.jsx
//
// Online Courses: self-paced training.
//
// Sections hold real content — paragraphs, lists, figures and colour-coded
// classification tables — and are produced by converting a module book once.
// The original Android app tracked a PDF path and a page range per section,
// which meant the learner was handed a 95-page file and a number; none of that
// survives here.
//
// Classification table rows use IMNCI_SEVERITIES from constants.js, the same
// vocabulary the protocol engine and the online exercises use, so a pink row in
// a book means what a pink classification means at the bedside.
//
// Navigation is three levels — courses, the modules in a course, the sections
// in a module — and a section opens as its own page with four tabs: Read, See,
// Practise, Test. Each tab is edited separately, so the person who writes the
// questions is not editing around the person who is correcting the prose.
import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, Trash2, ArrowLeft, ArrowRight, Columns2,
    CheckCircle2, Circle, DownloadCloud, AlertTriangle, Wand2,
    ZoomIn, ZoomOut, BookOpenText, MonitorPlay, Stethoscope,
    Lock, GraduationCap, Globe, Layers, Sparkles, Film,
    Syringe, X, RefreshCw, RotateCcw,
} from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Spinner, Modal, Input, Select, Textarea,
} from '../CommonComponents';
import { notify, confirmDialog } from '../dialogs';
import { useDataCache } from '../../DataContext';
import { useAuth } from '../../hooks/useAuth';
import { storage } from '../../firebase';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import {
    extractPdfPages, parsePdfIntoSections, countWords, renderPdfPages,
    SECTION_TABS, tabContent, newQuestion, newExerciseLink, videoSource,
    blockHtml,
} from './book';
import { RichText, RichTextEditor, useImnci } from './shared';
// Practice cases are not re-typed here. A section points at an exercise from
// Online Exercises by its id, so a correction made to the case there is the one
// the learner meets in the course as well.
import { ExerciseManagerView } from './exercises.jsx';

// The protocol is what a classification means; the course is where it is
// taught. Someone writing the course needs to be able to correct the protocol
// without leaving for another screen and finding their way back.
const ProtocolEditor = lazy(() => import('./protocol'));
import { IMNCI_SEVERITIES, severityById } from '../constants';
import {
    upsertOnlineCourse, deleteOnlineCourse, restoreOnlineCourse, hardDeleteOnlineCourse,
    upsertOnlineCourseItem, deleteOnlineCourseItem, restoreOnlineCourseItem, hardDeleteOnlineCourseItem,
    bulkUpsertOnlineCourseContent,
    getOnlineProgress, setOnlineSectionComplete,
} from '../../data';

// Where a course asset lives in Storage. The legacy path from the Android app
// ("imnci/Books/module 1 introduction.pdf") is kept verbatim underneath, so a
// migrated section's reference resolves without rewriting any content.
export const ASSET_ROOT = 'online-courses';
export const assetPath = (legacyPath) => `${ASSET_ROOT}/${String(legacyPath || '').replace(/^\/+/, '')}`;

const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};

// =============================================================================
// Migration from the Android app's Realtime Database
//
// Read-only against the source, and it never guesses: a section whose module
// key is not in the export is reported rather than attached to something
// plausible.
// =============================================================================

export const LEGACY_DB = 'https://child-health-courses-default-rtdb.firebaseio.com';

export function mapLegacyCourse(raw) {
    return {
        title: String(raw.course_title || '').trim() || 'Untitled course',
        description: String(raw.des || '').trim(),
        imageUrl: String(raw.img || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.course_key || null,
        source: 'migrated',
    };
}

export function mapLegacyModule(raw) {
    return {
        kind: 'module',
        title: String(raw.module_title || '').trim() || 'Untitled module',
        order: num(raw.module_number) ?? 0,
        imageUrl: String(raw.img || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.module_key || null,
        source: 'migrated',
    };
}

/**
 * Turns a Realtime Database export into one course plus its items.
 * @returns {{course, items, warnings}} warnings name anything that could not be
 *          attached, so a partial import is visible rather than quietly short.
 */
export function buildMigration(legacy, courseKey) {
    const courses = Object.values(legacy.course || {});
    const raw = courses.find((c) => c.course_key === courseKey) || courses[0];
    if (!raw) return { course: null, items: [], warnings: ['No course found in the export.'] };

    const key = raw.course_key;
    const modules = Object.values(legacy.module || {}).filter((m) => m.course_key === key);
    const legacySectionCount = Object.values(legacy.section || {}).filter((s) => s.course_key === key).length;
    const warnings = [];

    if (legacySectionCount) {
        warnings.push(`${legacySectionCount} sections in the original app are page references into a PDF. They are not imported — convert each module book instead, which produces readable text.`);
    }

    // Two modules in the live data share a title and hold no sections. Flagged,
    // not dropped: deciding what is a duplicate is the programme's call.
    const byTitle = {};
    modules.forEach((m) => {
        const t = String(m.module_title || '').trim().toLowerCase();
        byTitle[t] = (byTitle[t] || 0) + 1;
    });
    Object.entries(byTitle).forEach(([t, n]) => {
        if (n > 1) warnings.push(`${n} modules share the title "${t}".`);
    });

    return {
        course: mapLegacyCourse(raw),
        // Only the structure. The old records were page references into a
        // PDF, which is the model this module has moved away from; their
        // content now comes from converting the module book.
        items: modules.map(mapLegacyModule),
        warnings,
    };
}

// =============================================================================
// Readable content
//
// A section that has been converted from its book renders as text here. The
// PDF link stays as a fallback for anything not converted yet, so the two can
// coexist while modules are done one at a time.
// =============================================================================

// An icon per tab. Practise is a stethoscope rather than a pencil: what is
// being practised is examining a child, not writing.
const TAB_ICONS = { read: BookOpenText, see: MonitorPlay, practise: Stethoscope };

function BookImage({ block }) {
    const { url, missing } = useAssetUrl(block.path);
    // A whole page captured from the book, as opposed to a figure lifted out of
    // one. The classification charts are drawn as vectors, so their grid and
    // their colour — which is the clinical meaning — cannot be rebuilt from the
    // extracted text. The page picture is where they survive intact.
    const isPage = block.type === 'page';
    // A picture an author uploaded has no page behind it, so it is described as
    // a picture rather than as "Figure from page undefined".
    const what = !block.page ? 'Picture'
        : isPage ? `Page ${block.page} of the book`
            : `Figure from page ${block.page}`;

    if (!block.path) {
        return (
            <div className="p-3 border border-dashed rounded text-xs text-gray-500 text-center">
                {what} — not uploaded.
            </div>
        );
    }
    if (missing) {
        return (
            <div className="p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-800 text-center">
                {what} is missing from storage.
            </div>
        );
    }
    return url ? (
        <figure className={isPage ? 'my-4' : 'my-3'}>
            <img src={url} alt={block.alt || what}
                className={`max-w-full h-auto mx-auto ${isPage
                    ? 'rounded-lg border border-slate-300 shadow-sm w-full'
                    : 'rounded border'}`} loading="lazy" />
            <figcaption className="text-xs text-gray-500 text-center mt-1">
                {block.caption || (isPage ? what : '')}
                {isPage && (
                    <a href={url} target="_blank" rel="noreferrer"
                        className="ms-2 text-sky-700 font-semibold hover:underline">open full size</a>
                )}
            </figcaption>
        </figure>
    ) : <div className={`${isPage ? 'h-72' : 'h-24'} bg-slate-100 rounded animate-pulse`} />;
}

// A question is answered in place rather than in a separate quiz screen: the
// learner picks, sees straight away whether they were right, and reads why.
// Nothing is scored or stored — this is self-assessment, and a health worker
// checking themselves should not feel they are being marked.
function QuestionBlock({ block }) {
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
                        {picked === (block.answer ?? 0) ? 'Correct.' : 'Not quite.'}
                    </div>
                    {block.explanation && <p className="text-slate-600 mt-1">{block.explanation}</p>}
                    <button onClick={() => setPicked(null)}
                        className="text-xs text-sky-700 font-semibold mt-2">try again</button>
                </div>
            )}
        </div>
    );
}

// Video is embedded where the address is a YouTube or Vimeo link and played
// directly otherwise, so a file in Storage and a link to a WHO recording both
// work without the author having to know which is which.
function VideoBlock({ block }) {
    const src = videoSource(block.url);
    if (!src) {
        return (
            <div className="p-3 border border-dashed rounded text-xs text-gray-500 text-center not-prose">
                A video with no address.
            </div>
        );
    }
    return (
        <figure className="my-4 not-prose">
            <div className="relative w-full rounded-lg overflow-hidden border border-slate-300 bg-black"
                style={{ aspectRatio: '16 / 9' }}>
                {src.kind === 'embed' ? (
                    <iframe src={src.src} title={block.caption || 'Video'} allowFullScreen
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; encrypted-media; picture-in-picture" />
                ) : (
                    <video src={src.src} controls className="absolute inset-0 w-full h-full" />
                )}
            </div>
            {block.caption && <figcaption className="text-xs text-gray-500 text-center mt-1">{block.caption}</figcaption>}
        </figure>
    );
}

// A card for one of the graded exercises. The scenario and the learning points
// are shown from the exercise's own definition; the grading itself stays in
// Online Exercises, which is where attempts are recorded.
function ExerciseLinkBlock({ block }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const { exercises } = useImnci();
    if (!exercises) return <div className="not-prose h-28 bg-slate-100 rounded-xl animate-pulse my-4" />;
    const ex = exercises.find((x) => x.id === block.exerciseId);
    if (!ex) {
        return (
            <div className="not-prose p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-900">
                This section points at an exercise ({block.exerciseId || 'none chosen'}) that is no
                longer in Online Exercises.
            </div>
        );
    }
    return (
        <div className="not-prose border border-slate-200 rounded-xl overflow-hidden my-4">
            <div className="px-4 py-2.5 bg-slate-800 text-white flex flex-wrap items-center gap-2">
                <GraduationCap size={16} className="shrink-0" />
                <span className="font-bold text-sm flex-1">{ex.title}</span>
                <span className="text-[11px] text-slate-300">
                    {ex.estimatedMinutes ? `${ex.estimatedMinutes} min · ` : ''}pass {ex.passMark ?? 80}%
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
                    Work this case, with the assessment form and a score, in
                    {' '}<strong>Online Exercises</strong>.
                </div>
            </div>
        </div>
    );
}

function ContentBlocks({ blocks, scale = 1 }) {
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
                                                    <td key={ci} className={`border p-2 align-top ${tone.row}`}>{cell}</td>
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

function useAssetUrl(path) {
    const [state, setState] = useState({ url: null, missing: false, loading: false });

    useEffect(() => {
        let alive = true;
        if (!path) { setState({ url: null, missing: false, loading: false }); return undefined; }
        setState({ url: null, missing: false, loading: true });
        getDownloadURL(storageRef(storage, assetPath(path)))
            .then((url) => { if (alive) setState({ url, missing: false, loading: false }); })
            // A missing object is expected while a book is mid-conversion, so it
            // is reported as "missing" rather than thrown as an error.
            .catch(() => { if (alive) setState({ url: null, missing: true, loading: false }); })
        return () => { alive = false; };
    }, [path]);

    return state;
}

// =============================================================================
// Import
// =============================================================================

function ImportModal({ isOpen, onClose, onImported }) {
    const [busy, setBusy] = useState(false);
    const [legacy, setLegacy] = useState(null);
    const [error, setError] = useState('');
    const [courseKey, setCourseKey] = useState('');

    useEffect(() => { if (isOpen) { setLegacy(null); setError(''); setCourseKey(''); } }, [isOpen]);

    const fetchLegacy = async () => {
        setBusy(true); setError('');
        try {
            const nodes = ['course', 'module', 'section'];
            const parts = await Promise.all(nodes.map((n) =>
                fetch(`${LEGACY_DB}/${n}.json`).then((r) => {
                    if (!r.ok) throw new Error(`${n}: HTTP ${r.status}`);
                    return r.json();
                })));
            const data = { course: parts[0], module: parts[1], section: parts[2] };
            setLegacy(data);
            const first = Object.values(data.course || {})[0];
            setCourseKey(first?.course_key || '');
        } catch (e) {
            console.error('Legacy fetch failed:', e);
            setError(`Could not read the original database. ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const plan = useMemo(
        () => (legacy && courseKey ? buildMigration(legacy, courseKey) : null),
        [legacy, courseKey]);

    const commit = async () => {
        if (!plan?.course) return;
        const ok = await confirmDialog(
            `Import "${plan.course.title}" with ${plan.items.filter(i => i.kind === 'module').length} modules `
            + `and ${plan.items.filter(i => i.kind === 'section').length} sections? This creates a new course.`,
            { title: 'Import course', confirmLabel: 'Import' });
        if (!ok) return;
        setBusy(true);
        try {
            const r = await bulkUpsertOnlineCourseContent(plan);
            notify(`Imported ${r.modules} modules and ${r.sections} sections.`
                + (r.orphaned ? ` ${r.orphaned} section(s) had no module.` : ''), 'success');
            onImported();
            onClose();
        } catch (e) {
            console.error('Import failed:', e);
            const raw = String(e?.message || e);
            setError(/insufficient permissions|permission-denied/i.test(raw)
                ? 'Firestore refused the write. The onlineCourses rules may not be deployed yet. Nothing was saved.'
                : `The import failed and nothing was saved. ${raw}`);
        } finally {
            setBusy(false);
        }
    };

    const courses = Object.values(legacy?.course || {});

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import from the Android app">
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div>
                    </div>
                )}

                <p className="text-sm text-gray-600">
                    Reads the course structure from the original Sudan Child Health database.
                    Nothing in that database is changed.
                </p>

                {!legacy && (
                    <Button onClick={fetchLegacy} disabled={busy}>
                        <DownloadCloud size={16} /> {busy ? 'Reading…' : 'Read the original database'}
                    </Button>
                )}

                {busy && legacy && <Spinner />}

                {legacy && (
                    <>
                        <Select label="Course to import" value={courseKey}
                            onChange={(e) => setCourseKey(e.target.value)}>
                            {courses.map((c) => (
                                <option key={c.course_key} value={c.course_key}>{c.course_title}</option>
                            ))}
                        </Select>

                        {plan?.course && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                <strong>{plan.course.title}</strong> — {plan.items.filter(i => i.kind === 'module').length} modules,
                                {' '}{plan.items.filter(i => i.kind === 'section').length} sections.
                            </div>
                        )}

                        {plan?.warnings?.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <div className="font-semibold mb-1">{plan.warnings.length} thing(s) to know</div>
                                <ul className="list-disc ms-5 space-y-0.5 max-h-32 overflow-y-auto">
                                    {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="p-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-900">
                            The course text is only page references. After importing, use
                            <strong> Upload course files</strong> to add the PDFs, or every section
                            will show &ldquo;not uploaded yet&rdquo;.
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={commit} disabled={busy || !plan?.course}>Import</Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Book -> readable sections
//
// The reason this exists: handing a learner a 95-page PDF and a page range is
// not training, it is a filing system. Converting a book once turns every
// section into text they can actually read on a phone.
// =============================================================================

function ConvertBookModal({ isOpen, onClose, courseId, modules, existingFor, onRefresh }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [moduleId, setModuleId] = useState('');
    const [replace, setReplace] = useState(true);
    const [progress, setProgress] = useState(null);
    // Kept after the parse. The classification charts in these books are drawn
    // as vector paths, so no amount of text extraction recovers their grid or
    // their colour; the page has to be captured as printed. Extraction finds
    // roughly 24 raster figures in module 2 against some 7,800 path operations,
    // which is why this defaults on.
    const [file, setFile] = useState(null);
    const [capturePages, setCapturePages] = useState(true);

    useEffect(() => {
        if (isOpen) { setResult(null); setError(''); setFile(null); setModuleId(modules[0]?.id || ''); }
    }, [isOpen, modules]);

    const handleFile = async (event) => {
        const picked = event.target.files?.[0];
        if (!picked) return;
        setBusy(true); setError(''); setResult(null); setProgress(null); setFile(picked);
        try {
            const pages = await extractPdfPages(picked, setProgress, true);
            const parsed = parsePdfIntoSections(pages);
            // Kept beside the parse so the blobs are still in hand at commit.
            parsed.images = pages.flatMap((pg) => pg.images || []);
            if (parsed.sections.length === 0) {
                setError('No numbered headings were found. This converter expects the IMNCI module books, which number their headings like "2.0" and "5.2.1".');
            }
            setResult({ ...parsed, fileName: picked.name, pageCount: pages.length });
        } catch (e) {
            console.error('PDF conversion failed:', e);
            setError(`Could not read that PDF. ${e?.message || ''}`.trim());
        } finally {
            setBusy(false);
            event.target.value = '';
        }
    };

    const commit = async () => {
        if (!result?.sections?.length || !moduleId) return;
        const module = modules.find((m) => m.id === moduleId);
        const ok = await confirmDialog(
            `Create ${result.sections.length} readable sections under "${module?.title}"?`
            + (replace ? ' The sections already in that module will be hidden.' : ''),
            { title: 'Convert book', confirmLabel: 'Create sections' });
        if (!ok) return;

        setBusy(true);
        try {
            if (replace) {
                // Soft-deleted rather than removed: the page references those
                // sections carry are the only record of the original mapping.
                for (const old of existingFor(moduleId)) {
                    await deleteOnlineCourseItem(old.id);
                }
            }
            // Figures go to Storage first: a section that references an image
            // which was never uploaded renders a gap, and the learner has no
            // way to tell whether the figure is missing or simply absent.
            const uploadedPaths = {};
            for (let i = 0; i < (result.images || []).length; i++) {
                const img = result.images[i];
                if (!img?.blob) continue;
                const path = `${ASSET_ROOT}/figures/${courseId}/${moduleId}/${i}.png`;
                try {
                    await uploadBytes(storageRef(storage, path), img.blob, { contentType: 'image/png' });
                    uploadedPaths[i] = path.slice(ASSET_ROOT.length + 1);
                } catch (err) {
                    console.error('Figure upload failed:', path, err);
                }
            }

            // Page pictures. Rendered once per page number even where two
            // sections meet on the same page, so a shared page is not uploaded
            // twice and the two sections point at the same file.
            const pagePaths = {};
            if (capturePages && file) {
                const wanted = [...new Set(result.sections.flatMap((sec) => {
                    const out = [];
                    for (let p = sec.startPage; p <= sec.endPage; p++) out.push(p);
                    return out;
                }))].sort((a, b) => a - b);

                let done = 0;
                for (const p of wanted) {
                    setProgress({ phase: 'pages', page: done + 1, total: wanted.length });
                    try {
                        const [shot] = await renderPdfPages(file, [p], 1.6);
                        if (shot?.blob) {
                            const path = `${ASSET_ROOT}/pages/${courseId}/${moduleId}/p${p}.png`;
                            await uploadBytes(storageRef(storage, path), shot.blob, { contentType: 'image/png' });
                            pagePaths[p] = path.slice(ASSET_ROOT.length + 1);
                        }
                    } catch (err) {
                        console.error('Page capture failed:', p, err);
                    }
                    done += 1;
                }
            }

            let n = 0;
            for (const sec of result.sections) {
                const withPaths = (list) => (list || []).map((b) => (
                    b.type === 'image'
                        ? { ...b, path: uploadedPaths[b.imageIndex] || null }
                        : b
                ));
                const see = withPaths(sec.see);
                for (let p = sec.startPage; p <= sec.endPage; p++) {
                    if (pagePaths[p]) see.push({ type: 'page', page: p, path: pagePaths[p] });
                }
                await upsertOnlineCourseItem({
                    kind: 'section', courseId, moduleId,
                    title: `${sec.number} ${sec.title}`,
                    order: n + 1,
                    read: withPaths(sec.read),
                    see,
                    practise: [],
                    bookFromPage: sec.startPage,
                    bookToPage: sec.endPage,
                    isPublished: true,
                    source: 'converted',
                });
                n += 1;
            }
            notify(`Created ${n} readable sections.`, 'success');
            onRefresh();
            onClose();
        } catch (e) {
            console.error('Could not create sections:', e);
            setError(`Saving failed part way through. ${e?.message || ''}`.trim());
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Convert a book into readable sections">
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div>
                    </div>
                )}

                <p className="text-sm text-gray-600">
                    Reads an IMNCI module book and splits it at its numbered headings, so each
                    section becomes text the learner reads in the app rather than a page number
                    in a PDF. The file is read in your browser and is not uploaded.
                </p>

                <Select label="Add the sections to" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                    <option value="">— choose a module —</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </Select>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Module book (PDF)</label>
                    <input type="file" accept=".pdf,application/pdf" onChange={handleFile} disabled={busy}
                        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                </div>

                {busy && (
                    <div className="space-y-2">
                        {progress ? (
                            <>
                                <div className="h-2 bg-slate-200 rounded overflow-hidden">
                                    <div className="h-full bg-sky-600 transition-all duration-150"
                                        style={{ width: `${Math.round((progress.page / progress.total) * 100)}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>
                                        {progress.phase === 'pages' ? 'Capturing'
                                            : progress.phase === 'figures' ? 'Reading figures on' : 'Reading'} page
                                        {' '}{progress.page} of {progress.total}
                                    </span>
                                    <span>{Math.round((progress.page / progress.total) * 100)}%</span>
                                </div>
                            </>
                        ) : <Spinner />}
                    </div>
                )}

                {result && result.sections.length > 0 && (
                    <>
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                            <strong>{result.sections.length} sections</strong> and
                            {' '}<strong>{result.images?.length || 0} figures</strong> found in
                            {' '}{result.pageCount} pages of {result.fileName}. The text becomes the
                            Read tab and the figures the See tab.
                        </div>

                        {result.warnings.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <div className="font-semibold mb-1">Worth knowing</div>
                                <ul className="list-disc ms-5 space-y-0.5 max-h-28 overflow-y-auto">
                                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="border rounded max-h-56 overflow-y-auto divide-y text-sm">
                            {result.sections.map((sec, i) => (
                                <div key={i} className="px-3 py-1.5 flex items-center gap-2">
                                    <span className="font-mono text-xs text-gray-500 w-14 shrink-0">{sec.number}</span>
                                    <span className="flex-1 truncate">{sec.title}</span>
                                    <span className="text-xs text-gray-400 shrink-0">
                                        p{sec.startPage}-{sec.endPage} · {countWords(sec)}w
                                    </span>
                                </div>
                            ))}
                        </div>

                        <label className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-1" checked={capturePages}
                                onChange={(e) => setCapturePages(e.target.checked)} />
                            <span>
                                Capture each page as a picture for the <strong>See</strong> tab
                                <span className="block text-xs text-gray-500">
                                    The classification charts are drawn, not typed, so their colours
                                    survive only as a picture of the page. Adds about
                                    {' '}{result.sections.length ? (result.sections[result.sections.length - 1].endPage
                                        - result.sections[0].startPage + 1) : 0} uploads.
                                </span>
                            </span>
                        </label>

                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                            Hide the sections already in that module
                        </label>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={commit} disabled={busy || !result?.sections?.length || !moduleId}>
                        Create {result?.sections?.length || 0} sections
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Authoring
// =============================================================================

function CourseModal({ isOpen, onClose, course, onSaved }) {
    const [form, setForm] = useState(course || { title: '', description: '', isPublished: false });
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (isOpen) setForm(course || { title: '', description: '', isPublished: false }); }, [isOpen, course]);

    const save = async () => {
        if (!form.title?.trim()) { notify('Enter a course title.', 'error'); return; }
        setSaving(true);
        try {
            await upsertOnlineCourse({ ...form, title: form.title.trim() });
            notify('Course saved.', 'success');
            onSaved(); onClose();
        } catch (e) {
            console.error(e); notify('Could not save the course.', 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={course?.id ? 'Edit course' : 'Add course'}>
            <div className="space-y-4">
                <Input label="Title" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea label="Description" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                    Published (visible to learners)
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
        </Modal>
    );
}

function ItemModal({ isOpen, onClose, item, courseId, kind, modules, onSaved }) {
    const blank = { kind, courseId, title: '', order: 0, isPublished: true };
    const [form, setForm] = useState(item || blank);
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (isOpen) setForm(item || blank); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isOpen, item]);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const save = async () => {
        if (!form.title?.trim()) { notify('Enter a title.', 'error'); return; }
        setSaving(true);
        try {
            await upsertOnlineCourseItem({ ...form, courseId, kind, title: form.title.trim(), order: Number(form.order) || 0 });
            notify('Saved.', 'success');
            onSaved(); onClose();
        } catch (e) {
            console.error(e); notify('Could not save.', 'error');
        } finally { setSaving(false); }
    };

    const isSection = kind === 'section';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${item?.id ? 'Edit' : 'Add'} ${kind}`}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label="Title" value={form.title || ''} onChange={(e) => set('title', e.target.value)} />
                    <Input label="Order" type="number" value={form.order ?? 0} onChange={(e) => set('order', e.target.value)} />
                </div>

                {isSection && (
                    <>
                        <Select label="Module" value={form.moduleId || ''} onChange={(e) => set('moduleId', e.target.value)}>
                            <option value="">— none —</option>
                            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </Select>
                    </>
                )}

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isPublished !== false} onChange={(e) => set('isPublished', e.target.checked)} />
                    Published
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
        </Modal>
    );
}

// =============================================================================
// Book manager
//
// This is what makes automatic conversion safe to use. The parser gets the
// prose right and the headings right, but the classification tables in these
// books are drawn as vector graphics — roughly 7,800 path operations in module
// 2 — so their grid and their colour do not survive extraction even though the
// cell text does. In IMCI that colour is clinical meaning, not decoration.
//
// So rather than pretending the converter is perfect, a federal manager can
// open any converted section and fix it: correct the text, drop what came
// through as noise, and build the classification tables properly with their
// pink, yellow and green rows.
// =============================================================================

// One tab of one section. Each tab is edited on its own: correcting the prose
// against the book and building the practice cases are different jobs, often
// done by different people, and neither should be able to lose the other's work
// by saving a whole section at once.
// A section tab, written as one document.
//
// It used to be one editor per paragraph. With a converted book that is thirty
// contentEditable elements on a page, each re-writing its own innerHTML on every
// change, and typing in it crawled. It also made no sense as a writing surface:
// a paragraph break is something you make by pressing Enter, not by pressing a
// button called "add block".
//
// So the flowing content — text, lists, pictures, charts — is one document, and
// only the things that are not prose keep a card of their own: a video, a
// question, a link to a case, a captured book page.
const STRUCTURED = ['video', 'question', 'exercise', 'page'];

function SectionTabEditor({ section, tab = 'read', onSaved, onCancel }) {
    const [html, setHtml] = useState('');
    const [extras, setExtras] = useState([]);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [charting, setCharting] = useState(false);
    const meta = SECTION_TABS.find((t) => t.id === tab) || SECTION_TABS[0];
    const { exercises } = useImnci();
    const insertRef = useRef(null);

    useEffect(() => {
        if (!section) return;
        const content = tabContent(section, tab);
        // Everything that can be expressed as text becomes one document; the
        // rest keeps its card. Joined in the order it was already in, so a
        // figure that sat between two paragraphs stays between them.
        const doc = content
            .filter((b) => !STRUCTURED.includes(b.type))
            .map((b) => blockHtml(b))
            .filter(Boolean)
            .join('\n');
        setHtml(doc);
        setExtras(JSON.parse(JSON.stringify(content.filter((b) => STRUCTURED.includes(b.type)))));
        setTitle(section.title || '');
    }, [section, tab]);

    const updateExtra = (i, patch) => setExtras((p) => p.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const removeExtra = (i) => setExtras((p) => p.filter((_, j) => j !== i));
    const addExtra = (type) => setExtras((p) => [...p, (
        type === 'question' ? newQuestion()
            : type === 'exercise' ? newExerciseLink()
                : { type: 'video', url: '', caption: '' }
    )]);

    // Uploads and hands back a URL, because a picture in the text goes straight
    // into an <img> rather than resolving a storage path when it renders.
    const uploadInline = async (file) => {
        if (!file || !section?.id) return null;
        try {
            const clean = file.name.replace(/[^\w.-]+/g, '-');
            const path = `${ASSET_ROOT}/figures/${section.courseId}/${section.id}/${Date.now()}-${clean}`;
            const dest = storageRef(storage, path);
            await uploadBytes(dest, file, { contentType: file.type });
            return await getDownloadURL(dest);
        } catch (e) {
            console.error('Could not upload the image:', e);
            notify(`Could not upload that image. ${e?.message || ''}`.trim(), 'error');
            return null;
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const words = String(html).replace(/<[^>]*>/g, '').trim();
            const body = words || /<img|<table/i.test(html)
                ? [{ type: 'rich', text: html }]
                : [];

            const kept = extras.filter((b) => (
                b.type === 'video' ? String(b.url || '').trim() : true
            ));

            // Caught here rather than saved and met by a learner: a question
            // with one answer to choose from is not a question, and a card that
            // points at no case is a dead end.
            const problem = kept.find((b) => (
                b.type === 'question'
                    ? (b.options || []).filter((o) => String(o).trim()).length < 2
                    : b.type === 'exercise' ? !b.exerciseId : false
            ));
            if (problem) {
                notify(problem.type === 'exercise'
                    ? 'Choose which case the card points at.'
                    : 'Each question needs at least two answers to choose from.', 'error');
                setSaving(false);
                return;
            }

            // Sections written before the tabs existed keep their text in
            // `blocks`. Saving the Read tab moves it across and empties the old
            // field, so a section is migrated the first time someone edits it
            // and nothing has to be rewritten in bulk.
            const patch = { ...section, title: title.trim(), [tab]: [...body, ...kept] };
            if (tab === 'read' && section.blocks?.length) patch.blocks = [];
            await upsertOnlineCourseItem(patch);
            notify(`${meta.label} saved.`, 'success');
            onSaved();
        } catch (e) {
            console.error('Could not save the section:', e);
            notify(`Could not save. ${e?.message || ''}`.trim(), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!section) return null;

    return (
        <div className="space-y-4">
            {/* Editing happens on the page the text is read on, at the width it
                will be read at. It used to be a dialog, which meant writing a
                paragraph in a box half the size of the page it appears on. */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 sticky top-2 z-20">
                <span className="text-sm text-amber-900 font-semibold">
                    Editing {meta.label}
                </span>
                <span className="flex gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </span>
            </div>

            <Input label="Section title" value={title} onChange={(e) => setTitle(e.target.value)} />

            <RichTextEditor
                value={html}
                onChange={setHtml}
                onInsertImage={uploadInline}
                onInsertChart={() => setCharting(true)}
                registerInsert={(fn) => { insertRef.current = fn; }}
                placeholder={`Write the ${meta.label.toLowerCase()} text here. Press Enter for a new paragraph.`}
                className="min-h-[24rem]"
            />

            <ChartBuilderModal
                isOpen={charting}
                onClose={() => setCharting(false)}
                onInsert={(tableHtml) => { insertRef.current?.(tableHtml); setCharting(false); }}
            />

            {/* Everything that is not prose. A question is a set of fields, not
                a paragraph, so it keeps a card rather than being typed into the
                text as markup nobody can see. */}
            <div className="space-y-2">
                {extras.map((b, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono uppercase text-slate-500 flex-1">{b.type}</span>
                            <button onClick={() => removeExtra(i)}
                                className="px-1.5 py-0.5 border rounded text-red-600 hover:bg-red-50">
                                <Trash2 size={12} />
                            </button>
                        </div>

                        {b.type === 'page' && (
                            <div className="text-xs text-slate-500">
                                Page {b.page} of the book, captured when it was converted.
                                <BookImage block={b} />
                            </div>
                        )}

                        {b.type === 'video' && (
                            <div className="space-y-2">
                                <Input label="Video address" value={b.url || ''}
                                    placeholder="https://www.youtube.com/watch?v=… or a link to an MP4"
                                    onChange={(e) => updateExtra(i, { url: e.target.value })} />
                                <Input label="Caption" value={b.caption || ''}
                                    onChange={(e) => updateExtra(i, { caption: e.target.value })} />
                                {b.url && <VideoBlock block={b} />}
                            </div>
                        )}

                        {b.type === 'exercise' && (
                            <div className="space-y-2">
                                <Select label="Which case" value={b.exerciseId || ''} disabled={!exercises}
                                    onChange={(e) => updateExtra(i, { exerciseId: e.target.value })}>
                                    <option value="">{exercises ? '— choose a case —' : 'Loading the cases…'}</option>
                                    {(exercises || []).map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                            {ex.title}{ex.draft ? ' (draft)' : ''}
                                        </option>
                                    ))}
                                </Select>
                                <p className="text-xs text-slate-500">
                                    Cases are written in the case builder, from Manage mode.
                                </p>
                                <Input label="Why it is here (optional)" value={b.note || ''}
                                    onChange={(e) => updateExtra(i, { note: e.target.value })} />
                            </div>
                        )}

                        {b.type === 'question' && (
                            <div className="space-y-2">
                                <Textarea rows={2} value={b.text || ''} placeholder="The question"
                                    onChange={(e) => updateExtra(i, { text: e.target.value })} />
                                {(b.options || []).map((opt, oi) => (
                                    <div key={oi} className="flex gap-2 items-center">
                                        <input type="radio" name={`ans-${i}`} checked={(b.answer ?? 0) === oi}
                                            onChange={() => updateExtra(i, { answer: oi })} title="The correct answer" />
                                        <input value={opt} placeholder={`Answer ${String.fromCharCode(97 + oi)}`}
                                            onChange={(e) => updateExtra(i, {
                                                options: b.options.map((x, k) => (k === oi ? e.target.value : x)),
                                            })} className="flex-1 border rounded px-2 py-1 text-sm" />
                                        <button disabled={(b.options || []).length <= 2}
                                            onClick={() => updateExtra(i, {
                                                options: b.options.filter((_, k) => k !== oi),
                                                answer: (b.answer ?? 0) > oi ? (b.answer ?? 0) - 1
                                                    : Math.min(b.answer ?? 0, b.options.length - 2),
                                            })} className="px-2 border rounded text-red-600 disabled:opacity-30">−</button>
                                    </div>
                                ))}
                                <button onClick={() => updateExtra(i, { options: [...(b.options || []), ''] })}
                                    className="text-xs text-sky-700 font-semibold">+ add answer</button>
                                <Input label="Why (shown after answering)" value={b.explanation || ''}
                                    onChange={(e) => updateExtra(i, { explanation: e.target.value })} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-gray-500 self-center">Add below the text:</span>
                {tab === 'practise' && (
                    <>
                        <button onClick={() => addExtra('question')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                            <Plus size={13} /> Question
                        </button>
                        <button onClick={() => addExtra('exercise')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                            <Stethoscope size={13} /> Link a case
                        </button>
                    </>
                )}
                {tab !== 'practise' && (
                    <button onClick={() => addExtra('video')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                        <Film size={13} /> Video
                    </button>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : `Save ${meta.label}`}</Button>
            </div>
        </div>
    );
}

// Builds a classification chart and hands back the HTML for it, so it can be
// dropped into the text where it belongs rather than living in a separate list
// underneath. The colours are IMNCI_SEVERITIES, written as inline style so the
// chart keeps its meaning wherever the HTML ends up.
function ChartBuilderModal({ isOpen, onClose, onInsert }) {
    const [rows, setRows] = useState([{ colour: 'note', cells: ['', '', ''] }]);
    const [headers, setHeaders] = useState(['Signs', 'Classify as', 'Treatment']);

    useEffect(() => {
        if (isOpen) {
            setRows([{ colour: 'note', cells: ['', '', ''] }]);
            setHeaders(['Signs', 'Classify as', 'Treatment']);
        }
    }, [isOpen]);

    const setCell = (ri, ci, v) => setRows((p) => p.map((r, i) => (
        i === ri ? { ...r, cells: r.cells.map((c, k) => (k === ci ? v : c)) } : r)));
    const addRow = () => setRows((p) => [...p, { colour: 'note', cells: headers.map(() => '') }]);
    const addColumn = () => {
        setHeaders((h) => [...h, '']);
        setRows((p) => p.map((r) => ({ ...r, cells: [...r.cells, ''] })));
    };

    const build = () => {
        const esc = (s) => String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const head = headers.some((h) => h.trim())
            ? `<tr>${headers.map((h) => `<th style="background-color: #e2e8f0; padding: 6px">${esc(h)}</th>`).join('')}</tr>`
            : '';
        const body = rows.map((r) => {
            const tone = CHART_TONES[r.colour] || CHART_TONES.note;
            return `<tr>${r.cells.map((c) => (
                `<td style="background-color: ${tone.bg}; color: ${tone.fg}; padding: 6px">${esc(c)}</td>`
            )).join('')}</tr>`;
        }).join('');
        onInsert(`<table style="width: 100%">${head}${body}</table><p><br></p>`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Build a classification chart">
            <div className="space-y-3">
                <p className="text-sm text-slate-600">
                    The row colour is the classification colour — the same one the protocol and
                    the exercises use — so a pink row here means at the bedside what it means here.
                </p>

                <div className="flex gap-1">
                    <span className="w-32 shrink-0 text-xs text-slate-500 self-center">Headings</span>
                    {headers.map((h, i) => (
                        <input key={i} value={h} onChange={(e) => setHeaders(
                            (p) => p.map((x, k) => (k === i ? e.target.value : x)))}
                            className="flex-1 border rounded px-2 py-1 text-sm font-semibold" />
                    ))}
                </div>

                {rows.map((r, ri) => (
                    <div key={ri} className="flex gap-1 items-start">
                        <select value={r.colour}
                            onChange={(e) => setRows((p) => p.map((x, i) => (
                                i === ri ? { ...x, colour: e.target.value } : x)))}
                            className="border rounded text-xs p-1 w-32 shrink-0">
                            {IMNCI_SEVERITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        {r.cells.map((c, ci) => (
                            <input key={ci} value={c} onChange={(e) => setCell(ri, ci, e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm" />
                        ))}
                        <button onClick={() => setRows((p) => p.filter((_, i) => i !== ri))}
                            disabled={rows.length <= 1}
                            className="px-2 border rounded text-red-600 shrink-0 disabled:opacity-30">−</button>
                    </div>
                ))}

                <div className="flex gap-3">
                    <button onClick={addRow} className="text-xs text-sky-700 font-semibold">+ row</button>
                    <button onClick={addColumn} className="text-xs text-sky-700 font-semibold">+ column</button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={build}>Insert the chart</Button>
                </div>
            </div>
        </Modal>
    );
}

// The severity colours as plain values. The renderer uses Tailwind classes for
// them, but a chart built here is stored as HTML that has to carry its own
// colour, because it may be read anywhere the stylesheet is not.
const CHART_TONES = {
    severe: { bg: '#ffe4e6', fg: '#881337' },
    moderate: { bg: '#fef3c7', fg: '#78350f' },
    mild: { bg: '#d1fae5', fg: '#064e3b' },
    note: { bg: '#ffffff', fg: '#0f172a' },
};

// What has been deleted, and the one place it can be got rid of for good.
//
// Deleting a course or a section hides it and records who and when. Nothing
// leaves the database until somebody empties the bin here, which is also the
// only place that removes the pictures from Storage. Two steps, because a
// converted module is a day's work and "delete" is one click away from "edit"
// in a list.
function DeletedItems({ courses, items, onChanged }) {
    const [busy, setBusy] = useState(null);

    const deletedCourses = courses.filter((c) => c.isDeleted === true);
    const deletedItems = items.filter((i) => i.isDeleted === true);

    const when = (row) => {
        const at = row.deletedAt?.toDate?.() || (row.deletedAt ? new Date(row.deletedAt) : null);
        const who = row.deletedBy ? ` by ${row.deletedBy}` : '';
        return at ? `${at.toLocaleDateString()} ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${who}`
            : (row.deletedBy ? `by ${row.deletedBy}` : 'before this was recorded');
    };

    const restore = async (row) => {
        setBusy(row.id);
        try {
            if (row.kind) await restoreOnlineCourseItem(row.id);
            else await restoreOnlineCourse(row.id);
            notify('Restored.', 'success');
            onChanged();
        } catch (e) {
            console.error('Could not restore:', e);
            notify(`Could not restore. ${e?.message || ''}`.trim(), 'error');
        } finally { setBusy(null); }
    };

    const purgeItem = async (row) => {
        const pictures = [...(row.read || []), ...(row.see || []), ...(row.practise || []), ...(row.blocks || [])]
            .filter((b) => (b.type === 'image' || b.type === 'page') && b.path).length;

        const ok = await confirmDialog(
            `Permanently delete "${row.title}"?`
            + (pictures ? ` Its ${pictures} picture${pictures === 1 ? '' : 's'} will be removed from storage too.` : '')
            + ' This cannot be undone.',
            { title: 'Delete for good', confirmLabel: 'Delete permanently', danger: true });
        if (!ok) return;

        setBusy(row.id);
        try {
            // Pictures a surviving section still points at are left alone: two
            // sections that meet on one page of the book share its picture.
            const keep = items
                .filter((i) => i.id !== row.id && i.isDeleted !== true)
                .flatMap((i) => [...(i.read || []), ...(i.see || []), ...(i.practise || []), ...(i.blocks || [])])
                .filter((b) => (b.type === 'image' || b.type === 'page') && b.path)
                .map((b) => `${ASSET_ROOT}/${String(b.path).replace(/^\/+/, '')}`);

            await hardDeleteOnlineCourseItem(row, keep);
            notify('Deleted permanently.', 'success');
            onChanged();
        } catch (e) {
            console.error('Could not delete:', e);
            notify(`Could not delete. ${e?.message || ''}`.trim(), 'error');
        } finally { setBusy(null); }
    };

    const purgeCourse = async (course) => {
        const mine = items.filter((i) => i.courseId === course.id);
        const ok = await confirmDialog(
            `Permanently delete "${course.title}" and everything in it?`
            + ` That is ${mine.filter((i) => i.kind === 'module').length} modules and`
            + ` ${mine.filter((i) => i.kind === 'section').length} sections, with their pictures.`
            + ' This cannot be undone.',
            { title: 'Delete the whole course', confirmLabel: 'Delete permanently', danger: true });
        if (!ok) return;

        setBusy(course.id);
        try {
            await hardDeleteOnlineCourse(course, mine);
            notify('The course and everything in it was deleted.', 'success');
            onChanged();
        } catch (e) {
            console.error('Could not delete the course:', e);
            notify(`Could not delete. ${e?.message || ''}`.trim(), 'error');
        } finally { setBusy(null); }
    };

    if (!deletedCourses.length && !deletedItems.length) {
        return (
            <Card><CardBody className="text-center text-slate-500 py-10 text-sm">
                <Trash2 size={24} className="mx-auto mb-2 text-slate-300" />
                Nothing has been deleted.
            </CardBody></Card>
        );
    }

    const row = (thing, label, onPurge) => (
        <li key={thing.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700 truncate">{thing.title || '(no title)'}</div>
                <div className="text-xs text-slate-500">{label} · deleted {when(thing)}</div>
            </div>
            <Button variant="secondary" disabled={busy === thing.id} onClick={() => restore(thing)}>
                <RotateCcw size={14} /> Restore
            </Button>
            <Button variant="danger" disabled={busy === thing.id} onClick={() => onPurge(thing)}>
                <Trash2 size={14} /> Delete for good
            </Button>
        </li>
    );

    return (
        <div className="space-y-3">
            <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-700">
                Deleted content is kept here so it can be put back. Emptying it removes the
                documents and their pictures from storage, and cannot be undone.
            </div>

            {deletedCourses.length > 0 && (
                <Card>
                    <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-sm font-bold text-rose-900">
                        Courses ({deletedCourses.length})
                    </div>
                    <ul className="divide-y">
                        {deletedCourses.map((c) => row(c, 'course', purgeCourse))}
                    </ul>
                </Card>
            )}

            {deletedItems.length > 0 && (
                <Card>
                    <div className="px-4 py-2 bg-slate-50 border-b text-sm font-bold text-slate-700">
                        Modules and sections ({deletedItems.length})
                    </div>
                    <ul className="divide-y max-h-[28rem] overflow-y-auto">
                        {deletedItems.map((i) => row(i, i.kind, purgeItem))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

// =============================================================================
// Main screen
// =============================================================================

export default function OnlineCoursesView({ permissions = {} }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    // Two distinct experiences, not one screen with extra buttons for some
    // people. A learner should never see an edit pencil or a delete button
    // beside the material they are trying to read, so authoring lives behind a
    // mode that only the federal roles can switch into, and it starts off.
    const canManage = !!permissions.canManageOnlineCourses;
    const [mode, setMode] = useState('learn');
    const isAdmin = canManage && mode === 'manage';

    // Reading size, remembered per device. The books are dense and are read on
    // whatever phone the health worker happens to have.
    const [fontScale, setFontScale] = useState(() => {
        try { return Number(localStorage.getItem('onlineCourseFontScale')) || 1; }
        catch { return 1; }
    });
    const setScale = useCallback((next) => {
        const clamped = Math.min(2, Math.max(0.8, Math.round(next * 10) / 10));
        setFontScale(clamped);
        try { localStorage.setItem('onlineCourseFontScale', String(clamped)); } catch { /* private mode */ }
    }, []);
    const { user } = useAuth();
    const { refreshExercises } = useImnci();

    const {
        onlineCourses, fetchOnlineCourses,
        onlineCourseItems, fetchOnlineCourseItems, isLoading,
    } = useDataCache();

    // Three levels, one open thing at each. An accordion of every module and
    // every section at once was unreadable on a phone once a converted book
    // turned one module into thirty sections.
    const [openCourseId, setOpenCourseId] = useState(null);
    const [openModuleId, setOpenModuleId] = useState(null);
    const [openSectionId, setOpenSectionId] = useState(null);
    const [sectionTab, setSectionTab] = useState('read');
    const [compare, setCompare] = useState(false);
    const [progress, setProgress] = useState({ completed: {} });

    const [courseModal, setCourseModal] = useState(null);
    const [itemModal, setItemModal] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    // The two builders the course author also needs. Opened over the course
    // rather than navigated to, so going back does not lose where they were.
    const [builder, setBuilder] = useState(null);
    const [showBin, setShowBin] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    // Which tab of the open section is being written, or null when reading.
    const [editingTab, setEditingTab] = useState(null);

    useEffect(() => {
        if (!onlineCourses) fetchOnlineCourses(false);
        if (!onlineCourseItems) fetchOnlineCourseItems(false);
    }, [onlineCourses, onlineCourseItems, fetchOnlineCourses, fetchOnlineCourseItems]);

    useEffect(() => {
        let alive = true;
        if (user?.uid) {
            getOnlineProgress(user.uid).then((p) => { if (alive && p) setProgress(p); }).catch(() => {});
        }
        return () => { alive = false; };
    }, [user?.uid]);

    const reload = useCallback(() => {
        fetchOnlineCourses('full');
        fetchOnlineCourseItems('full');
    }, [fetchOnlineCourses, fetchOnlineCourseItems]);

    // A delta query against the server, skipping the one-hour cache. Cheap: it
    // asks only for what changed since the last sync.
    const [syncing, setSyncing] = useState(false);
    const resync = useCallback(async () => {
        setSyncing(true);
        try {
            await Promise.all([fetchOnlineCourses('sync'), fetchOnlineCourseItems('sync')]);
        } finally {
            setSyncing(false);
        }
    }, [fetchOnlineCourses, fetchOnlineCourseItems]);

    const courses = useMemo(() => (onlineCourses || [])
        .filter((c) => c.isDeleted !== true)
        // An unpublished course is a draft; only the people who can publish it see it.
        .filter((c) => canManage || c.isPublished)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
    [onlineCourses, canManage]);

    const items = useMemo(() => (onlineCourseItems || []).filter((i) => i.isDeleted !== true), [onlineCourseItems]);

    // Everything, deleted or not. The bin needs what the rest of the screen
    // filters out, and a permanent delete needs to know which pictures the
    // surviving sections still point at.
    const allItems = useMemo(() => onlineCourseItems || [], [onlineCourseItems]);
    const allCourses = useMemo(() => onlineCourses || [], [onlineCourses]);
    const deletedCount = useMemo(
        () => allCourses.filter((c) => c.isDeleted === true).length
            + allItems.filter((i) => i.isDeleted === true).length,
        [allCourses, allItems]);

    const openCourse = courses.find((c) => c.id === openCourseId) || null;

    const modules = useMemo(() => items
        .filter((i) => i.kind === 'module' && i.courseId === openCourseId)
        .sort((a, b) => (a.order || 0) - (b.order || 0)), [items, openCourseId]);

    const sectionsByModule = useMemo(() => {
        const out = {};
        items.filter((i) => i.kind === 'section' && i.courseId === openCourseId)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .forEach((s) => {
                const key = s.moduleId || '__none__';
                (out[key] = out[key] || []).push(s);
            });
        return out;
    }, [items, openCourseId]);

    const courseSections = useMemo(
        () => items.filter((i) => i.kind === 'section' && i.courseId === openCourseId),
        [items, openCourseId]);

    const doneCount = courseSections.filter((s) => progress.completed?.[s.id]).length;

    const openModule = modules.find((m) => m.id === openModuleId) || null;

    // Opening a module that looks empty is exactly the moment to check whether
    // it really is. Once per module, so a module that genuinely has no sections
    // does not re-ask on every render.
    const checkedEmpty = useRef(new Set());
    useEffect(() => {
        if (!openModuleId) return;
        const secs = sectionsByModule[openModuleId] || [];
        if (secs.length > 0 || checkedEmpty.current.has(openModuleId)) return;
        checkedEmpty.current.add(openModuleId);
        resync();
    }, [openModuleId, sectionsByModule, resync]);
    const openSection = courseSections.find((s) => s.id === openSectionId) || null;

    // A section opens when the one before it has been marked complete, and a
    // module when the module before it is finished. IMNCI is taught in order —
    // you cannot classify dehydration before you can assess diarrhoea — so the
    // course is read in order too.
    //
    // Manage mode is exempt. Someone correcting section 5.2 against the book
    // cannot be made to complete sections 1 to 5 first.
    const sectionDone = useCallback((sec) => !!progress.completed?.[sec?.id], [progress]);

    const moduleComplete = useCallback((m) => {
        const secs = sectionsByModule[m?.id] || [];
        return secs.length > 0 && secs.every(sectionDone);
    }, [sectionsByModule, sectionDone]);

    const moduleLocked = useCallback((index) => {
        if (isAdmin || index <= 0) return false;
        return !moduleComplete(modules[index - 1]);
    }, [isAdmin, modules, moduleComplete]);

    const sectionLocked = useCallback((secs, index) => {
        if (isAdmin || index <= 0) return false;
        return !sectionDone(secs[index - 1]);
    }, [isAdmin, sectionDone]);

    // Where "Continue" goes: the first section the learner has not finished, in
    // the first module they have not finished.
    const nextUp = useMemo(() => {
        for (const m of modules) {
            const secs = sectionsByModule[m.id] || [];
            const sec = secs.find((x) => !progress.completed?.[x.id]);
            if (sec) return { moduleId: m.id, sectionId: sec.id };
        }
        return null;
    }, [modules, sectionsByModule, progress]);

    const toggleComplete = async (section) => {
        if (!user?.uid) return;
        const done = !progress.completed?.[section.id];
        setProgress((p) => {
            const completed = { ...(p.completed || {}) };
            if (done) completed[section.id] = true; else delete completed[section.id];
            return { ...p, completed };
        });
        try {
            await setOnlineSectionComplete(user.uid, section.id, done);
        } catch (e) {
            console.error('Could not save progress:', e);
            notify('Could not save your progress.', 'error');
        }
    };

    const removeCourse = async (course) => {
        if (!await confirmDialog(`Delete "${course.title}" and hide all its content?`,
            { title: 'Delete course', confirmLabel: 'Delete', danger: true })) return;
        try { await deleteOnlineCourse(course.id); notify('Course deleted.', 'success'); reload(); }
        catch (e) { console.error(e); notify('Could not delete the course.', 'error'); }
    };

    const removeItem = async (item) => {
        if (!await confirmDialog(`Delete "${item.title}"?`,
            { title: `Delete ${item.kind}`, confirmLabel: 'Delete', danger: true })) return;
        try { await deleteOnlineCourseItem(item.id); notify('Deleted.', 'success'); reload(); }
        catch (e) { console.error(e); notify('Could not delete.', 'error'); }
    };

    if ((isLoading?.onlineCourses && !onlineCourses) || (isLoading?.onlineCourseItems && !onlineCourseItems)) {
        return <Spinner />;
    }

    // --- section page -------------------------------------------------------
    //
    // Four tabs, from the programme's own training-unit model: read it, see it,
    // practise it, be tested on it. The chart sits on See rather than inline in
    // the prose because a classification chart is something a learner comes
    // back to, not something they scroll past once.
    if (openSection) {
        const isDone = !!progress.completed?.[openSection.id];
        const content = tabContent(openSection, sectionTab);
        const meta = SECTION_TABS.find((t) => t.id === sectionTab) || SECTION_TABS[0];
        // Revising the converted text means holding it against the page it came
        // from. The captured pages make that possible without leaving the app.
        const pages = tabContent(openSection, 'see').filter((b) => b.type === 'page');
        const canCompare = sectionTab === 'read' && pages.length > 0;
        // Revision is done section by section, so it is worth being able to
        // move to the next one without returning to the list and losing the
        // tab and the compare view each time.
        const siblings = sectionsByModule[openSection.moduleId || '__none__'] || [];
        const here = siblings.findIndex((x) => x.id === openSection.id);
        const goTo = (sec) => { if (sec) { setOpenSectionId(sec.id); setSectionTab('read'); } };
        // Going on is what completion unlocks. Going back is always allowed —
        // a learner who wants to re-read something should never be stopped.
        const nextAllowed = isAdmin || isDone;

        return (
            <div className="space-y-4 max-w-5xl mx-auto">
                <button onClick={() => setOpenSectionId(null)}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} /> {openModule?.title || 'Back'}
                </button>

                <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-sky-700 to-sky-900 text-white">
                        <div className="text-[11px] uppercase tracking-widest text-sky-200">
                            {openModule?.title}
                        </div>
                        <h2 className="text-xl font-bold mt-0.5">{openSection.title}</h2>
                    </div>

                    <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
                        {SECTION_TABS.map((t) => {
                            const Icon = TAB_ICONS[t.id];
                            const n = tabContent(openSection, t.id).length;
                            const active = sectionTab === t.id;
                            return (
                                <button key={t.id} disabled={!!editingTab && editingTab !== t.id}
                                    onClick={() => { setSectionTab(t.id); setCompare(false); }}
                                    className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                                        active ? 'text-sky-800 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                    <Icon size={15} />
                                    {isArabic ? t.labelAr : t.label}
                                    {n > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                            active ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                                    )}
                                    {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-600" />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-slate-500">{meta.hint}</p>
                            <div className="flex items-center gap-1">
                                {isAdmin && !editingTab && (
                                    <Button variant="secondary" className="px-2 py-1 h-auto"
                                        onClick={() => setEditingTab(sectionTab)}>
                                        <Pencil size={14} /> Edit {meta.label}
                                    </Button>
                                )}
                                {canCompare && !editingTab && (
                                    <Button variant={compare ? 'primary' : 'secondary'} className="px-2 py-1 h-auto"
                                        onClick={() => setCompare(!compare)}
                                        title="Show the book page beside the converted text">
                                        <Columns2 size={14} /> Compare
                                    </Button>
                                )}
                                {sectionTab === 'read' && !editingTab && (
                                    <>
                                        <Button variant="secondary" onClick={() => setScale(fontScale - 0.1)}
                                            disabled={fontScale <= 0.8} className="px-2 py-1 h-auto"><ZoomOut size={16} /></Button>
                                        <button onClick={() => setScale(1)} title="Reset the reading size"
                                            className="text-xs text-slate-500 w-12 hover:text-sky-700">
                                            {Math.round(fontScale * 100)}%
                                        </button>
                                        <Button variant="secondary" onClick={() => setScale(fontScale + 0.1)}
                                            disabled={fontScale >= 2} className="px-2 py-1 h-auto"><ZoomIn size={16} /></Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {editingTab ? (
                            <SectionTabEditor
                                section={openSection} tab={editingTab}
                                onCancel={() => setEditingTab(null)}
                                onSaved={() => { setEditingTab(null); reload(); }}
                            />
                        ) : compare && canCompare ? (
                            // Side by side on a wide screen, stacked on a phone: the
                            // point is to check one against the other, and on a small
                            // screen two narrow columns would defeat that.
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="lg:max-h-[38rem] lg:overflow-y-auto pe-1">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">Converted text</div>
                                    <ContentBlocks blocks={content} scale={fontScale} />
                                </div>
                                <div className="lg:max-h-[38rem] lg:overflow-y-auto ps-1 border-s">
                                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">The book</div>
                                    <ContentBlocks blocks={pages} />
                                </div>
                            </div>
                        ) : content.length > 0 ? (
                            <ContentBlocks blocks={content} scale={sectionTab === 'read' ? fontScale : 1} />
                        ) : (
                            <div className="text-sm text-slate-500 py-12 text-center border border-dashed rounded-lg">
                                Nothing in {meta.label} for this section yet.
                                {isAdmin && (
                                    <div className="mt-1 text-xs">Use Edit {meta.label}, above, to write it.</div>
                                )}
                            </div>
                        )}

                        {sectionTab === 'read' && openSection.bookFromPage && (
                            <div className="text-xs text-slate-400 pt-2 border-t">
                                From the module book, pages {openSection.bookFromPage}–{openSection.bookToPage}.
                            </div>
                        )}
                    </div>

                    <div className="px-5 py-3 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                            {isDone ? 'You have completed this section.' : 'Mark this section when you are done.'}
                        </span>
                        <Button onClick={() => toggleComplete(openSection)}
                            variant={isDone ? 'secondary' : 'primary'} disabled={!user?.uid}>
                            {isDone ? <><CheckCircle2 size={16} /> Completed</> : <><Circle size={16} /> Mark complete</>}
                        </Button>
                    </div>
                </div>

                {siblings.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <button disabled={here <= 0} onClick={() => goTo(siblings[here - 1])}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-700">
                            <ArrowLeft size={18} />
                            <span className="hidden sm:inline">Previous</span>
                        </button>

                        <span className="text-xs text-slate-400 text-center">
                            {here + 1} of {siblings.length}
                            {!nextAllowed && here < siblings.length - 1 && (
                                <span className="block text-amber-700">
                                    Mark this section complete to go on
                                </span>
                            )}
                        </span>

                        <button disabled={here < 0 || here >= siblings.length - 1 || !nextAllowed}
                            onClick={() => goTo(siblings[here + 1])}
                            title={nextAllowed ? 'The next section' : 'Finish this section first'}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400">
                            <span className="hidden sm:inline">Next</span>
                            {nextAllowed ? <ArrowRight size={18} /> : <Lock size={16} />}
                        </button>
                    </div>
                )}

            </div>
        );
    }

    // --- the sections in one module -----------------------------------------
    if (openModule) {
        const secs = sectionsByModule[openModule.id] || [];
        const doneHere = secs.filter((s) => progress.completed?.[s.id]).length;

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <button onClick={() => setOpenModuleId(null)}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                        <ArrowLeft size={15} /> {openCourse.title}
                    </button>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setConvertOpen(true)}>
                                <Wand2 size={16} /> Convert a book
                            </Button>
                            <Button variant="secondary" onClick={() => setItemModal({ kind: 'module', item: openModule })}>
                                <Pencil size={16} /> Module
                            </Button>
                            <Button onClick={() => setItemModal({ kind: 'section' })}>
                                <Plus size={16} /> Add section
                            </Button>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-5 py-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                        <h2 className="text-lg font-bold">{openModule.title}</h2>
                        <div className="text-xs text-slate-300 mt-1">
                            {secs.length} sections · {doneHere} complete
                        </div>
                        <div className="h-1.5 bg-white/20 rounded mt-3 overflow-hidden max-w-md">
                            <div className="h-full bg-emerald-400 transition-all"
                                style={{ width: `${secs.length ? (doneHere / secs.length) * 100 : 0}%` }} />
                        </div>
                    </div>

                    {secs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-sm space-y-2">
                            <div>{syncing ? 'Checking for sections…' : 'No sections yet.'}</div>
                            {isAdmin && !syncing && (
                                <div className="text-xs">Convert the module book to create them.</div>
                            )}
                            {!syncing && (
                                <Button variant="secondary" onClick={resync}>
                                    <RefreshCw size={15} /> Check again
                                </Button>
                            )}
                        </div>
                    ) : (
                        <ol className="divide-y">
                            {secs.map((s, i) => {
                                const done = !!progress.completed?.[s.id];
                                const locked = sectionLocked(secs, i);
                                const filled = SECTION_TABS
                                    .map((t) => ({ t, n: tabContent(s, t.id).length }))
                                    .filter((x) => x.n > 0);
                                return (
                                    <li key={s.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                        locked ? 'bg-slate-50' : 'hover:bg-sky-50/60'}`}>
                                        <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                                            done ? 'bg-emerald-100 text-emerald-700'
                                                : locked ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                            {done ? <CheckCircle2 size={15} /> : locked ? <Lock size={13} /> : i + 1}
                                        </span>
                                        <button className="flex-1 text-start min-w-0 disabled:cursor-not-allowed"
                                            disabled={locked}
                                            title={locked ? 'Finish the section before this one first' : undefined}
                                            onClick={() => {
                                                setOpenSectionId(s.id); setSectionTab('read');
                                                setCompare(false); setEditingTab(null);
                                            }}>
                                            <div className={`font-medium truncate ${locked ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}</div>
                                            <div className="text-xs text-slate-500 flex gap-2 flex-wrap mt-0.5">
                                                {locked ? <span>Finish the previous section first</span> : (<>
                                                    {filled.map(({ t, n }) => (
                                                        <span key={t.id}>{isArabic ? t.labelAr : t.label} {n}</span>
                                                    ))}
                                                    {filled.length === 0 && <span>empty</span>}
                                                </>)}
                                            </div>
                                        </button>
                                        {isAdmin && (
                                            <span className="flex gap-1 shrink-0">
                                                {SECTION_TABS.map((t) => {
                                                    const Icon = TAB_ICONS[t.id];
                                                    return (
                                                        <button key={t.id} title={`Edit ${t.label}`}
                                                            onClick={() => {
                                                                setOpenSectionId(s.id);
                                                                setSectionTab(t.id);
                                                                setEditingTab(t.id);
                                                            }}
                                                            className="p-1.5 border rounded text-slate-500 hover:bg-slate-50 hover:text-sky-700">
                                                            <Icon size={14} />
                                                        </button>
                                                    );
                                                })}
                                                <Button variant="danger" className="px-2 py-1 h-auto"
                                                    onClick={() => removeItem(s)}><Trash2 size={13} /></Button>
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>

                <ItemModal
                    isOpen={!!itemModal} onClose={() => setItemModal(null)}
                    item={itemModal?.item} kind={itemModal?.kind || 'section'}
                    courseId={openCourseId} modules={modules} onSaved={reload}
                />
                <ConvertBookModal
                    isOpen={convertOpen} onClose={() => setConvertOpen(false)}
                    courseId={openCourseId} modules={modules}
                    existingFor={(mid) => sectionsByModule[mid] || []}
                    onRefresh={reload}
                />
            </div>
        );
    }

    // --- the modules in one course ------------------------------------------
    //
    // Straight to the modules. There was an Overview tab in front of them and it
    // was a page of numbers standing between the learner and the thing they came
    // to do. The part of it worth keeping — the progress bar and Continue — sits
    // in the header instead.
    if (openCourse) {
        const orphans = sectionsByModule.__none__ || [];
        const pct = courseSections.length ? Math.round((doneCount / courseSections.length) * 100) : 0;

        const chips = [
            { Icon: Sparkles, label: 'Self-paced' },
            { Icon: Globe, label: '100% online' },
            { Icon: Layers, label: `${modules.length} modules` },
            { Icon: BookOpen, label: `${courseSections.length} sections` },
        ];

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <button onClick={() => setOpenCourseId(null)}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                        <ArrowLeft size={15} /> All courses
                    </button>
                    {isAdmin && (
                        <Button variant="secondary" onClick={() => setItemModal({ kind: 'module' })}>
                            <Plus size={16} /> Add module
                        </Button>
                    )}
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                    <div className="relative px-6 py-7 bg-gradient-to-br from-sky-800 via-sky-700 to-cyan-700 text-white overflow-hidden">
                        {/* A quiet pattern rather than an illustration: it reads the same on a
                            cheap phone screen, and there is no artwork to license. */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
                            <div className="absolute -top-10 -end-8 w-44 h-44 rounded-full bg-white/40" />
                            <div className="absolute top-12 end-24 w-16 h-16 rounded-full bg-amber-300/70" />
                            <div className="absolute -bottom-12 start-10 w-40 h-40 rounded-full bg-cyan-300/50" />
                            <div className="absolute bottom-4 start-52 w-10 h-10 rounded-full bg-white/50" />
                        </div>
                        <div className="relative">
                            <div className="text-[11px] uppercase tracking-widest text-sky-200">Course</div>
                            <h1 className="text-2xl font-bold mt-1">{openCourse.title}</h1>
                            {openCourse.description && (
                                <p className="text-sky-100 text-sm mt-2 max-w-2xl">{openCourse.description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs">
                                {chips.map(({ Icon, label }) => (
                                    <span key={label} className="inline-flex items-center gap-1.5 text-sky-50">
                                        <Icon size={15} className="text-sky-200" />{label}
                                    </span>
                                ))}
                            </div>

                            {courseSections.length > 0 && (
                                <div className="flex flex-wrap items-center gap-3 mt-5">
                                    <div className="flex-1 min-w-[10rem] max-w-md">
                                        <div className="h-2 bg-white/25 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-400 rounded-full transition-all"
                                                style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="text-[11px] text-sky-100 mt-1">
                                            {doneCount} of {courseSections.length} sections · {pct}%
                                        </div>
                                    </div>
                                    {nextUp ? (
                                        <button onClick={() => {
                                            setOpenModuleId(nextUp.moduleId);
                                            setOpenSectionId(nextUp.sectionId);
                                            setSectionTab('read');
                                        }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-sky-800 text-sm font-bold hover:bg-sky-50">
                                            <GraduationCap size={16} />
                                            {doneCount ? 'Continue' : 'Start the course'}
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
                                            <CheckCircle2 size={18} /> Every section finished
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="p-4 space-y-3">
                        {modules.length === 0 ? (
                            <div className="text-center text-slate-500 py-10 text-sm">
                                This course has no modules yet.
                            </div>
                        ) : modules.map((m, i) => {
                            const secs = sectionsByModule[m.id] || [];
                            const done = secs.filter((x) => progress.completed?.[x.id]).length;
                            const mpct = secs.length ? Math.round((done / secs.length) * 100) : 0;
                            const locked = moduleLocked(i);
                            return (
                                <button key={m.id} disabled={locked} onClick={() => setOpenModuleId(m.id)}
                                    className={`w-full text-start rounded-xl border p-4 transition-all ${
                                        locked
                                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                                            : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-md group'}`}>
                                    <div className="flex items-start gap-3">
                                        <span className={`text-2xl font-bold shrink-0 leading-none pt-0.5 transition-colors ${
                                            locked ? 'text-slate-200' : 'text-sky-200 group-hover:text-sky-400'}`}>
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className={`font-bold ${locked ? 'text-slate-400' : 'text-slate-800'}`}>
                                                {m.title}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {locked
                                                    ? 'Finish the module before this one to open it'
                                                    : `${done} / ${secs.length} sections${secs.length ? ` · ${mpct}%` : ''}`}
                                            </div>
                                            {!locked && secs.length > 0 && (
                                                <div className="h-1 bg-slate-100 rounded mt-2 overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${mpct}%` }} />
                                                </div>
                                            )}
                                        </div>
                                        {locked ? <Lock size={17} className="text-slate-300 shrink-0" />
                                            : mpct === 100 && secs.length > 0
                                                ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                                : null}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {orphans.length > 0 && isAdmin && (
                    <Card>
                        <div className="p-3 bg-amber-50 border-b border-amber-200 font-bold text-amber-900 text-sm">
                            Sections not attached to a module
                        </div>
                        <div className="divide-y">
                            {orphans.map((s) => (
                                <div key={s.id} className="p-3 flex items-center gap-3">
                                    <button className="flex-1 text-start"
                                        onClick={() => { setOpenSectionId(s.id); setSectionTab('read'); }}>{s.title}</button>
                                    <Button variant="secondary" onClick={() => setItemModal({ kind: 'section', item: s })}><Pencil size={14} /></Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <ItemModal
                    isOpen={!!itemModal} onClose={() => setItemModal(null)}
                    item={itemModal?.item} kind={itemModal?.kind || 'module'}
                    courseId={openCourseId} modules={modules} onSaved={reload}
                />
            </div>
        );
    }

    // --- course list --------------------------------------------------------
    return (
        <div className="space-y-4">
            <PageHeader
                title={isArabic ? 'الدورات الإلكترونية' : 'Online Courses'}
                subtitle={isArabic ? 'تدريب ذاتي' : 'Self-paced training'}
                actions={
                    <div className="flex gap-2 items-center">
                        <Button variant="secondary" onClick={resync} disabled={syncing}
                            title="Look for anything added on another device">
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{syncing ? 'Checking…' : 'Refresh'}</span>
                        </Button>
                        {canManage && (
                            <div className="flex rounded-md overflow-hidden border border-slate-300">
                                <button
                                    onClick={() => setMode('learn')}
                                    className={`px-3 py-1.5 text-sm font-semibold ${mode === 'learn' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >Learn</button>
                                <button
                                    onClick={() => setMode('manage')}
                                    className={`px-3 py-1.5 text-sm font-semibold ${mode === 'manage' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >Manage</button>
                            </div>
                        )}
                        {isAdmin && (
                            <>
                                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                                    <DownloadCloud size={16} /> Import
                                </Button>
                                <Button onClick={() => setCourseModal({})}>
                                    <Plus size={16} /> Add course
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {isAdmin && (
                <div className="space-y-2">
                    <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
                        Manage mode. Learners do not see the editing controls below, and drafts are
                        visible only here.
                    </div>
                    {/* The course, the cases and the protocol are one body of
                        work, so the two other builders open from here rather
                        than being somewhere else in the app. */}
                    <div className="flex flex-wrap gap-2">
                        <Button variant={showBin ? 'primary' : 'secondary'} onClick={() => setShowBin(!showBin)}>
                            <Trash2 size={16} /> Deleted{deletedCount ? ` (${deletedCount})` : ''}
                        </Button>
                        <Button variant="secondary" onClick={() => setBuilder('exercises')}>
                            <Stethoscope size={16} /> Case builder
                        </Button>
                        {permissions.canManageProtocols && (
                            <Button variant="secondary" onClick={() => setBuilder('protocol')}>
                                <Syringe size={16} /> Protocol builder
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {builder && (
                // A fixed pane with ONE scrolling area inside it. The first
                // version scrolled the backdrop as well as the panel, and the
                // builder inside brought a third, so the page had three
                // scrollbars and the builder's own heading slid under this one.
                <div className="fixed inset-0 z-50 bg-black/50 flex flex-col p-2 sm:p-4" role="dialog" aria-modal="true">
                    <div className="mx-auto w-full max-w-6xl bg-white rounded-xl flex flex-col min-h-0 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
                            <h2 className="font-bold text-slate-800">
                                {builder === 'protocol' ? 'Protocol builder' : 'Case builder'}
                            </h2>
                            <button onClick={() => { setBuilder(null); refreshExercises(); }}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4">
                            <Suspense fallback={<Spinner />}>
                                {builder === 'protocol' ? <ProtocolEditor /> : <ExerciseManagerView />}
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && showBin && (
                <DeletedItems courses={allCourses} items={allItems} onChanged={reload} />
            )}

            {isAdmin && showBin ? null : courses.length === 0 ? (
                <Card><CardBody className="text-center py-12 text-gray-500">
                    <BookOpen size={32} className="mx-auto mb-3 text-gray-400" />
                    <div className="font-medium text-gray-700">No courses yet</div>
                    {isAdmin && <div className="text-sm mt-1">Use Import to bring in the IMNCI course from the Android app.</div>}
                </CardBody></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {courses.map((c) => {
                        const secs = items.filter((i) => i.kind === 'section' && i.courseId === c.id);
                        const mods = items.filter((i) => i.kind === 'module' && i.courseId === c.id);
                        const done = secs.filter((s) => progress.completed?.[s.id]).length;
                        const pct = secs.length ? Math.round((done / secs.length) * 100) : 0;
                        return (
                            <div key={c.id} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-shadow flex flex-col">
                                {/* A plain patterned band rather than a photograph: it
                                    survives a slow connection and needs no licence. */}
                                <div className="relative h-28 bg-gradient-to-br from-sky-800 via-sky-700 to-cyan-600 overflow-hidden">
                                    <div className="absolute inset-0 opacity-25" aria-hidden="true">
                                        <div className="absolute -top-8 -end-6 w-32 h-32 rounded-full bg-white/50" />
                                        <div className="absolute top-8 end-20 w-10 h-10 rounded-full bg-amber-300/80" />
                                        <div className="absolute -bottom-10 start-6 w-28 h-28 rounded-full bg-cyan-200/60" />
                                    </div>
                                    <BookOpen size={30} className="absolute bottom-3 start-4 text-white/90" />
                                    {!c.isPublished && (
                                        <span className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-wide">
                                            draft
                                        </span>
                                    )}
                                </div>

                                <div className="p-4 flex flex-col flex-1 gap-3">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-800">{c.title}</h3>
                                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{c.description}</p>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1"><Sparkles size={13} /> Self-paced</span>
                                        <span className="inline-flex items-center gap-1"><Globe size={13} /> 100% online</span>
                                        <span className="inline-flex items-center gap-1"><Layers size={13} /> {mods.length} modules</span>
                                    </div>

                                    {secs.length > 0 && (
                                        <div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">
                                                {done} of {secs.length} sections complete
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-auto pt-1">
                                        <Button className="flex-1 justify-center"
                                            onClick={() => { setOpenCourseId(c.id); setOpenModuleId(null); setOpenSectionId(null); }}>
                                            {done ? 'Continue' : 'Start'}
                                        </Button>
                                        {isAdmin && (
                                            <>
                                                <Button variant="secondary" onClick={() => setCourseModal(c)}><Pencil size={14} /></Button>
                                                <Button variant="danger" onClick={() => removeCourse(c)}><Trash2 size={14} /></Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CourseModal isOpen={!!courseModal} onClose={() => setCourseModal(null)}
                course={courseModal?.id ? courseModal : null} onSaved={reload} />
            <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={reload} />
        </div>
    );
}
