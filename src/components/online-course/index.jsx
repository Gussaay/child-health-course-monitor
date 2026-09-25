// src/components/online-course/index.jsx
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
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowLeft,
    FileText, Video, CheckCircle2, Circle, DownloadCloud, AlertTriangle, Upload, Wand2,
    ZoomIn, ZoomOut,
} from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Spinner, Modal, Input, Select, Textarea,
} from '../CommonComponents';
import { notify, confirmDialog } from '../dialogs';
import { useDataCache } from '../../DataContext';
import { useAuth } from '../../hooks/useAuth';
import { storage } from '../../firebase';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import { extractPdfPages, parsePdfIntoSections, countWords } from './book';
import { IMNCI_SEVERITIES, severityById } from '../constants';
import {
    upsertOnlineCourse, deleteOnlineCourse,
    upsertOnlineCourseItem, deleteOnlineCourseItem,
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

function BookImage({ block }) {
    const { url, missing } = useAssetUrl(block.path);
    if (!block.path) {
        return (
            <div className="p-3 border border-dashed rounded text-xs text-gray-500 text-center">
                Figure from page {block.page} — not uploaded.
            </div>
        );
    }
    if (missing) {
        return (
            <div className="p-3 border border-dashed border-amber-300 bg-amber-50 rounded text-xs text-amber-800 text-center">
                Figure from page {block.page} is missing from storage.
            </div>
        );
    }
    return url ? (
        <figure className="my-3">
            <img src={url} alt={block.alt || `Figure from page ${block.page}`}
                className="max-w-full h-auto rounded border mx-auto" loading="lazy" />
            {block.caption && <figcaption className="text-xs text-gray-500 text-center mt-1">{block.caption}</figcaption>}
        </figure>
    ) : <div className="h-24 bg-slate-100 rounded animate-pulse" />;
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
                    return <h4 key={i} className="font-bold text-slate-900 mt-4">{b.text}</h4>;
                }
                if (b.type === 'image') {
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
                if (b.type === 'note') {
                    return <div key={i} className="p-3 bg-sky-50 border-s-4 border-sky-400 text-sky-900">{b.text}</div>;
                }
                return <p key={i}>{b.text}</p>;
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

    useEffect(() => {
        if (isOpen) { setResult(null); setError(''); setModuleId(modules[0]?.id || ''); }
    }, [isOpen, modules]);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBusy(true); setError(''); setResult(null); setProgress(null);
        try {
            const pages = await extractPdfPages(file, setProgress, true);
            const parsed = parsePdfIntoSections(pages);
            // Kept beside the parse so the blobs are still in hand at commit.
            parsed.images = pages.flatMap((pg) => pg.images || []);
            if (parsed.sections.length === 0) {
                setError('No numbered headings were found. This converter expects the IMNCI module books, which number their headings like "2.0" and "5.2.1".');
            }
            setResult({ ...parsed, fileName: file.name, pageCount: pages.length });
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

            let n = 0;
            for (const sec of result.sections) {
                const blocks = sec.blocks.map((b) => (
                    b.type === 'image'
                        ? { ...b, path: uploadedPaths[b.imageIndex] || null }
                        : b
                ));
                await upsertOnlineCourseItem({
                    kind: 'section', courseId, moduleId,
                    title: `${sec.number} ${sec.title}`,
                    order: n + 1,
                    blocks,
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
                                        {progress.phase === 'figures' ? 'Reading figures on' : 'Reading'} page
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
                            {' '}{result.pageCount} pages of {result.fileName}.
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

function BlockEditor({ isOpen, onClose, section, onSaved }) {
    const [blocks, setBlocks] = useState([]);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && section) {
            // Deep copied: editing must not mutate what is on screen behind the
            // dialog, so cancelling really does discard.
            setBlocks(JSON.parse(JSON.stringify(section.blocks || [])));
            setTitle(section.title || '');
        }
    }, [isOpen, section]);

    const update = (i, patch) => setBlocks((p) => p.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const remove = (i) => setBlocks((p) => p.filter((_, j) => j !== i));
    const move = (i, dir) => setBlocks((p) => {
        const j = i + dir;
        if (j < 0 || j >= p.length) return p;
        const copy = p.slice();
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
    });
    const add = (type) => setBlocks((p) => [...p, (
        type === 'list' ? { type: 'list', items: [''] }
            : type === 'table' ? { type: 'table', rows: [{ colour: 'note', cells: ['', '', ''] }] }
                : { type, text: '' }
    )]);

    const addRow = (i) => update(i, { rows: [...blocks[i].rows, { colour: 'note', cells: blocks[i].rows[0].cells.map(() => '') }] });
    const setCell = (i, ri, ci, v) => update(i, {
        rows: blocks[i].rows.map((r, j) => (j === ri ? { ...r, cells: r.cells.map((c, k) => (k === ci ? v : c)) } : r)),
    });
    const setRowColour = (i, ri, colour) => update(i, {
        rows: blocks[i].rows.map((r, j) => (j === ri ? { ...r, colour } : r)),
    });
    const addColumn = (i) => update(i, {
        rows: blocks[i].rows.map((r) => ({ ...r, cells: [...r.cells, ''] })),
    });

    const save = async () => {
        if (!title.trim()) { notify('The section needs a title.', 'error'); return; }
        setSaving(true);
        try {
            // Empty blocks are dropped here rather than saved and rendered as
            // blank space the learner cannot explain.
            const cleaned = blocks.filter((b) => (
                b.type === 'list' ? b.items.some((i) => i.trim())
                    : b.type === 'table' ? b.rows.some((r) => r.cells.some((c) => c.trim()))
                        : b.type === 'image' ? true
                            : String(b.text || '').trim()
            ));
            await upsertOnlineCourseItem({ ...section, title: title.trim(), blocks: cleaned });
            notify('Section saved.', 'success');
            onSaved();
            onClose();
        } catch (e) {
            console.error('Could not save the section:', e);
            notify(`Could not save. ${e?.message || ''}`.trim(), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!section) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit section">
            <div className="space-y-4">
                <Input label="Section title" value={title} onChange={(e) => setTitle(e.target.value)} />

                <div className="space-y-2 max-h-[26rem] overflow-y-auto pe-1">
                    {blocks.length === 0 && (
                        <div className="text-sm text-gray-500 p-4 border border-dashed rounded text-center">
                            This section has no content. Add a block below.
                        </div>
                    )}

                    {blocks.map((b, i) => (
                        <div key={i} className="border rounded p-2 bg-white space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono uppercase text-slate-500 flex-1">{b.type}</span>
                                <button onClick={() => move(i, -1)} disabled={i === 0}
                                    className="px-1.5 py-0.5 border rounded disabled:opacity-30">↑</button>
                                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1}
                                    className="px-1.5 py-0.5 border rounded disabled:opacity-30">↓</button>
                                <button onClick={() => remove(i)}
                                    className="px-1.5 py-0.5 border rounded text-red-600 hover:bg-red-50">
                                    <Trash2 size={12} />
                                </button>
                            </div>

                            {(b.type === 'paragraph' || b.type === 'heading' || b.type === 'note') && (
                                <Textarea rows={b.type === 'paragraph' ? 3 : 2} value={b.text || ''}
                                    onChange={(e) => update(i, { text: e.target.value })} />
                            )}

                            {b.type === 'list' && (
                                <div className="space-y-1">
                                    {b.items.map((it, j) => (
                                        <div key={j} className="flex gap-1">
                                            <input value={it} onChange={(e) => update(i, {
                                                items: b.items.map((x, k) => (k === j ? e.target.value : x)),
                                            })} className="flex-1 border rounded px-2 py-1 text-sm" />
                                            <button onClick={() => update(i, { items: b.items.filter((_, k) => k !== j) })}
                                                className="px-2 border rounded text-red-600">−</button>
                                        </div>
                                    ))}
                                    <button onClick={() => update(i, { items: [...b.items, ''] })}
                                        className="text-xs text-sky-700 font-semibold">+ add item</button>
                                </div>
                            )}

                            {b.type === 'image' && (
                                <div className="text-xs text-gray-600">
                                    <div>Figure from page {b.page}{b.path ? '' : ' — not uploaded'}</div>
                                    <Input label="Caption" value={b.caption || ''}
                                        onChange={(e) => update(i, { caption: e.target.value })} />
                                </div>
                            )}

                            {b.type === 'table' && (
                                <div className="space-y-1">
                                    {b.rows.map((row, ri) => (
                                        <div key={ri} className="flex gap-1 items-start">
                                            <select value={row.colour || 'note'}
                                                onChange={(e) => setRowColour(i, ri, e.target.value)}
                                                className="border rounded text-xs p-1 w-32 shrink-0">
                                                {IMNCI_SEVERITIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                            {row.cells.map((cell, ci) => (
                                                <input key={ci} value={cell}
                                                    onChange={(e) => setCell(i, ri, ci, e.target.value)}
                                                    className="flex-1 border rounded px-2 py-1 text-sm" />
                                            ))}
                                            <button onClick={() => update(i, { rows: b.rows.filter((_, k) => k !== ri) })}
                                                className="px-2 border rounded text-red-600 shrink-0">−</button>
                                        </div>
                                    ))}
                                    <div className="flex gap-3">
                                        <button onClick={() => addRow(i)} className="text-xs text-sky-700 font-semibold">+ row</button>
                                        <button onClick={() => addColumn(i)} className="text-xs text-sky-700 font-semibold">+ column</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-xs text-gray-500 self-center">Add:</span>
                    {['paragraph', 'heading', 'list', 'table', 'note'].map((t) => (
                        <button key={t} onClick={() => add(t)}
                            className="px-2 py-1 text-xs border rounded hover:bg-slate-50">{t}</button>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save section'}</Button>
                </div>
            </div>
        </Modal>
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

    const {
        onlineCourses, fetchOnlineCourses,
        onlineCourseItems, fetchOnlineCourseItems, isLoading,
    } = useDataCache();

    const [openCourseId, setOpenCourseId] = useState(null);
    const [openSectionId, setOpenSectionId] = useState(null);
    const [expandedModules, setExpandedModules] = useState({});
    const [progress, setProgress] = useState({ completed: {} });

    const [courseModal, setCourseModal] = useState(null);
    const [itemModal, setItemModal] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [editingBlocks, setEditingBlocks] = useState(null);

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

    const courses = useMemo(() => (onlineCourses || [])
        .filter((c) => c.isDeleted !== true)
        // An unpublished course is a draft; only the people who can publish it see it.
        .filter((c) => canManage || c.isPublished)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
    [onlineCourses, canManage]);

    const items = useMemo(() => (onlineCourseItems || []).filter((i) => i.isDeleted !== true), [onlineCourseItems]);

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

    const openSection = courseSections.find((s) => s.id === openSectionId) || null;

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

    // --- section reader -----------------------------------------------------
    if (openSection) {
        const isDone = !!progress.completed?.[openSection.id];
        return (
            <div className="space-y-4 max-w-4xl mx-auto">
                <Button variant="secondary" onClick={() => setOpenSectionId(null)}>
                    <ArrowLeft size={16} /> Back to the course
                </Button>
                <Card>
                    <CardBody className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-xl font-bold text-slate-800">{openSection.title}</h2>
                            {openSection.blocks?.length > 0 && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="secondary" onClick={() => setScale(fontScale - 0.1)}
                                        disabled={fontScale <= 0.8} className="px-2 py-1 h-auto">
                                        <ZoomOut size={16} />
                                    </Button>
                                    <button onClick={() => setScale(1)}
                                        title="Reset the reading size"
                                        className="text-xs text-slate-500 w-12 hover:text-sky-700">
                                        {Math.round(fontScale * 100)}%
                                    </button>
                                    <Button variant="secondary" onClick={() => setScale(fontScale + 0.1)}
                                        disabled={fontScale >= 2} className="px-2 py-1 h-auto">
                                        <ZoomIn size={16} />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <ContentBlocks blocks={openSection.blocks} scale={fontScale} />

                        {openSection.bookFromPage && (
                            <div className="text-xs text-gray-400">
                                From the module book, pages {openSection.bookFromPage}-{openSection.bookToPage}.
                            </div>
                        )}

                        {!openSection.blocks?.length && (
                            <div className="text-sm text-gray-500 p-4 border border-dashed rounded text-center">
                                This section has no content yet. Convert the module book, or add
                                the text by hand in Manage mode.
                            </div>
                        )}

                        <div className="pt-3 border-t">
                            <Button onClick={() => toggleComplete(openSection)}
                                variant={isDone ? 'secondary' : 'primary'} disabled={!user?.uid}>
                                {isDone ? <><CheckCircle2 size={16} /> Completed</> : <><Circle size={16} /> Mark as complete</>}
                            </Button>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    // --- course detail ------------------------------------------------------
    if (openCourse) {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button variant="secondary" onClick={() => setOpenCourseId(null)}>
                        <ArrowLeft size={16} /> All courses
                    </Button>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setConvertOpen(true)}>
                                <Wand2 size={16} /> Convert a book
                            </Button>
                            <Button variant="secondary" onClick={() => setItemModal({ kind: 'module' })}>
                                <Plus size={16} /> Add module
                            </Button>
                            <Button onClick={() => setItemModal({ kind: 'section' })}>
                                <Plus size={16} /> Add section
                            </Button>
                        </div>
                    )}
                </div>

                <PageHeader title={openCourse.title} subtitle={openCourse.description} />

                <Card>
                    <CardBody>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                                <div className="h-full bg-emerald-500"
                                    style={{ width: `${courseSections.length ? (doneCount / courseSections.length) * 100 : 0}%` }} />
                            </div>
                            <span className="text-gray-600 shrink-0">
                                {doneCount} / {courseSections.length} sections complete
                            </span>
                        </div>
                    </CardBody>
                </Card>

                {modules.length === 0 && (
                    <Card><CardBody className="text-center text-gray-500 py-10">
                        This course has no modules yet.
                    </CardBody></Card>
                )}

                {modules.map((m) => {
                    const expanded = expandedModules[m.id] ?? true;
                    const secs = sectionsByModule[m.id] || [];
                    return (
                        <Card key={m.id}>
                            <div className="p-3 bg-slate-100 flex items-center gap-2 cursor-pointer"
                                onClick={() => setExpandedModules((p) => ({ ...p, [m.id]: !expanded }))}>
                                {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                <span className="font-bold text-slate-800 flex-1">{m.title}</span>
                                <span className="text-xs text-gray-500">{secs.length} sections</span>
                                {isAdmin && (
                                    <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button variant="secondary" onClick={() => setItemModal({ kind: 'module', item: m })}><Pencil size={14} /></Button>
                                        <Button variant="danger" onClick={() => removeItem(m)}><Trash2 size={14} /></Button>
                                    </span>
                                )}
                            </div>
                            {expanded && (
                                <div className="divide-y">
                                    {secs.length === 0 && <div className="p-4 text-sm text-gray-500">No sections.</div>}
                                    {secs.map((s) => (
                                        <div key={s.id} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                                            {progress.completed?.[s.id]
                                                ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                                : <Circle size={18} className="text-slate-300 shrink-0" />}
                                            <button className="flex-1 text-start" onClick={() => setOpenSectionId(s.id)}>
                                                <div className="font-medium text-slate-800">{s.title}</div>
                                                {s.blocks?.length > 0 && (
                                                    <div className="text-xs text-gray-500">
                                                        {countWords(s)} words
                                                        {s.blocks.some((b) => b.type === 'image') ? ' · has figures' : ''}
                                                    </div>
                                                )}
                                            </button>
                                            {isAdmin && (
                                                <span className="flex gap-1">
                                                    {s.blocks?.length > 0 ? (
                                                        <Button variant="secondary" title="Edit the text"
                                                            onClick={() => setEditingBlocks(s)}><Pencil size={14} /></Button>
                                                    ) : (
                                                        <Button variant="secondary" title="Edit the section"
                                                            onClick={() => setItemModal({ kind: 'section', item: s })}><Pencil size={14} /></Button>
                                                    )}
                                                    <Button variant="danger" onClick={() => removeItem(s)}><Trash2 size={14} /></Button>
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    );
                })}

                {(sectionsByModule.__none__ || []).length > 0 && (
                    <Card>
                        <div className="p-3 bg-amber-50 border-b border-amber-200 font-bold text-amber-900 text-sm">
                            Sections not attached to a module
                        </div>
                        <div className="divide-y">
                            {sectionsByModule.__none__.map((s) => (
                                <div key={s.id} className="p-3 flex items-center gap-3">
                                    <button className="flex-1 text-start" onClick={() => setOpenSectionId(s.id)}>{s.title}</button>
                                    {isAdmin && (
                                        <Button variant="secondary" onClick={() => setItemModal({ kind: 'section', item: s })}><Pencil size={14} /></Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                <ItemModal
                    isOpen={!!itemModal} onClose={() => setItemModal(null)}
                    item={itemModal?.item} kind={itemModal?.kind || 'section'}
                    courseId={openCourseId} modules={modules} onSaved={reload}
                />
                <BlockEditor
                    isOpen={!!editingBlocks} onClose={() => setEditingBlocks(null)}
                    section={editingBlocks} onSaved={reload}
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

    // --- course list --------------------------------------------------------
    return (
        <div className="space-y-4">
            <PageHeader
                title={isArabic ? 'الدورات الإلكترونية' : 'Online Courses'}
                subtitle={isArabic ? 'تدريب ذاتي' : 'Self-paced training'}
                actions={
                    <div className="flex gap-2 items-center">
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
                <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
                    Manage mode. Learners do not see the editing controls below, and drafts are
                    visible only here.
                </div>
            )}

            {courses.length === 0 ? (
                <Card><CardBody className="text-center py-12 text-gray-500">
                    <BookOpen size={32} className="mx-auto mb-3 text-gray-400" />
                    <div className="font-medium text-gray-700">No courses yet</div>
                    {isAdmin && <div className="text-sm mt-1">Use Import to bring in the IMNCI course from the Android app.</div>}
                </CardBody></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courses.map((c) => {
                        const secs = items.filter((i) => i.kind === 'section' && i.courseId === c.id);
                        const done = secs.filter((s) => progress.completed?.[s.id]).length;
                        return (
                            <Card key={c.id} className="hover:shadow-lg transition-shadow">
                                <CardBody className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="p-3 bg-sky-100 text-sky-700 rounded-lg shrink-0"><BookOpen size={24} /></div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-slate-800">{c.title}</h3>
                                            <p className="text-sm text-gray-600 line-clamp-2">{c.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {items.filter((i) => i.kind === 'module' && i.courseId === c.id).length} modules ·
                                        {' '}{secs.length} sections
                                        {secs.length > 0 && <> · {done} complete</>}
                                        {!c.isPublished && <span className="ms-2 text-amber-700 font-semibold">draft</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => { setOpenCourseId(c.id); setExpandedModules({}); }}>Open</Button>
                                        {isAdmin && (
                                            <>
                                                <Button variant="secondary" onClick={() => setCourseModal(c)}><Pencil size={14} /></Button>
                                                <Button variant="danger" onClick={() => removeCourse(c)}><Trash2 size={14} /></Button>
                                            </>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
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
