// src/components/OnlineCoursesView.jsx
//
// Online Courses: self-paced training, ported from the Sudan Child Health
// Android app.
//
// What the content actually is, because it shapes everything here: all 94
// sections of the live IMNCI course are PDF PAGE RANGES. A section says "read
// module 2, pages 12–18" and often "then do exercise 3, pages 4–6". There is
// no HTML, no links and no photos in the source data — two videos and one chart
// booklet are the only exceptions. So this is a reader over a small set of
// PDFs, not a rich content renderer, and the PDFs are the course rather than an
// optional extra: without them a section has nothing to show.
//
// The tree is course -> module -> section. Modules and sections share one
// collection, distinguished by `kind`, so opening a course is one query.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowLeft,
    FileText, Video, CheckCircle2, Circle, DownloadCloud, AlertTriangle, Upload,
} from 'lucide-react';

import {
    Card, CardBody, PageHeader, Button, Spinner, Modal, Input, Select, Textarea,
} from './CommonComponents';
import { notify, confirmDialog } from './dialogs';
import { useDataCache } from '../DataContext';
import { useAuth } from '../hooks/useAuth';
import { storage } from '../firebase';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import {
    upsertOnlineCourse, deleteOnlineCourse,
    upsertOnlineCourseItem, deleteOnlineCourseItem,
    bulkUpsertOnlineCourseContent,
    getOnlineProgress, setOnlineSectionComplete,
} from '../data';

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
        bookPath: String(raw.module_link || '').trim(),
        exercisePath: String(raw.exercise_link || '').trim(),
        imageUrl: String(raw.img || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.module_key || null,
        source: 'migrated',
    };
}

export function mapLegacySection(raw) {
    return {
        kind: 'section',
        title: String(raw.section_title || raw.content_title || '').trim() || 'Untitled section',
        order: num(raw.section_number) ?? 0,
        // A section is a page range in a PDF; both ends are kept because the
        // reader opens at the first page and the range tells the learner how
        // much to read.
        readingPath: String(raw.reading || '').trim(),
        readingFrom: num(raw.reading_pagenumber),
        readingTo: num(raw.big_reading_pagenumber),
        exercisePath: String(raw.content_exercise || '').trim(),
        exerciseTitle: String(raw.exercise_title || '').trim(),
        exerciseFrom: num(raw.exercise_pagenumber),
        exerciseTo: num(raw.big_exercise_pagenumber),
        chartPath: String(raw.chart || '').trim(),
        chartPage: num(raw.chart_pagenumber),
        videoPath: String(raw.content_video || '').trim(),
        contentHtml: String(raw.content_html || '').trim(),
        linkUrl: String(raw.content_link || '').trim(),
        photoPath: String(raw.content_photo || '').trim(),
        isPublished: String(raw.publish) === 'true',
        legacyKey: raw.section_key || null,
        legacyModuleKey: raw.module_key || null,
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
    const sections = Object.values(legacy.section || {}).filter((s) => s.course_key === key);

    const moduleKeys = new Set(modules.map((m) => m.module_key));
    const warnings = [];

    sections.forEach((s) => {
        if (!moduleKeys.has(s.module_key)) {
            warnings.push(`Section "${s.section_title || s.section_key}" belongs to a module that is not in this course; it will be imported without a module.`);
        }
    });

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
        items: [...modules.map(mapLegacyModule), ...sections.map(mapLegacySection)],
        warnings,
    };
}

// =============================================================================
// Asset resolution
// =============================================================================

function useAssetUrl(path) {
    const [state, setState] = useState({ url: null, missing: false, loading: false });

    useEffect(() => {
        let alive = true;
        if (!path) { setState({ url: null, missing: false, loading: false }); return undefined; }
        setState({ url: null, missing: false, loading: true });
        getDownloadURL(storageRef(storage, assetPath(path)))
            .then((url) => { if (alive) setState({ url, missing: false, loading: false }); })
            // A missing object is the normal case until the PDFs are uploaded,
            // so it is reported as "not uploaded" rather than as an error.
            .catch(() => { if (alive) setState({ url: null, missing: true, loading: false }); });
        return () => { alive = false; };
    }, [path]);

    return state;
}

function AssetLink({ path, from, to, label, icon: Icon }) {
    const { url, missing, loading } = useAssetUrl(path);
    if (!path) return null;

    const range = from && to && to !== from ? `pages ${from}–${to}`
        : from ? `page ${from}` : null;
    // PDF viewers honour #page=N, so the learner lands on the right page rather
    // than the front cover of a 200-page book.
    const href = url ? (from ? `${url}#page=${from}` : url) : null;

    return (
        <div className="flex items-start gap-3 p-3 border rounded-md bg-white">
            <div className="p-2 bg-sky-100 text-sky-700 rounded shrink-0"><Icon size={18} /></div>
            <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800">{label}</div>
                <div className="text-xs text-gray-500 truncate">{path}{range ? ` · ${range}` : ''}</div>
                {missing && (
                    <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> Not uploaded yet — an administrator needs to add this file.
                    </div>
                )}
            </div>
            {loading && <span className="text-xs text-gray-400">…</span>}
            {href && (
                <a href={href} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1.5 bg-sky-600 text-white rounded text-sm font-semibold hover:bg-sky-700">
                    Open
                </a>
            )}
        </div>
    );
}

// =============================================================================
// Asset upload — the PDFs are the course, so there is a way to put them in
// =============================================================================

function AssetUploadModal({ isOpen, onClose, requiredPaths }) {
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState({});

    useEffect(() => { if (isOpen) setDone({}); }, [isOpen]);

    const upload = async (path, file) => {
        setBusy(true);
        try {
            await uploadBytes(storageRef(storage, assetPath(path)), file);
            setDone((p) => ({ ...p, [path]: 'ok' }));
            notify(`Uploaded ${path}`, 'success');
        } catch (error) {
            console.error('Asset upload failed:', error);
            setDone((p) => ({ ...p, [path]: 'fail' }));
            notify(`Could not upload ${path}. ${error?.message || ''}`.trim(), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Upload course files">
            <div className="space-y-3">
                <p className="text-sm text-gray-600">
                    Every section points at a PDF from the original Android app. Upload each
                    file once and every section that references it starts working. The files
                    are in the app source under <code>app/src/main/assets/</code>.
                </p>
                <div className="max-h-96 overflow-y-auto border rounded divide-y">
                    {requiredPaths.length === 0 && (
                        <div className="p-4 text-sm text-gray-500">No files are referenced yet.</div>
                    )}
                    {requiredPaths.map((path) => (
                        <div key={path} className="p-2 flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate" title={path}>{path}</span>
                            {done[path] === 'ok' && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
                            {done[path] === 'fail' && <AlertTriangle size={16} className="text-red-600 shrink-0" />}
                            <input
                                type="file" accept=".pdf,.mp4,application/pdf,video/mp4"
                                disabled={busy}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(path, f); e.target.value = ''; }}
                                className="text-xs w-44 shrink-0"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>Close</Button>
                </div>
            </div>
        </Modal>
    );
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input label="Reading file" value={form.readingPath || ''} onChange={(e) => set('readingPath', e.target.value)} placeholder="imnci/Books/module 1.pdf" />
                            <Input label="From page" type="number" value={form.readingFrom ?? ''} onChange={(e) => set('readingFrom', e.target.value)} />
                            <Input label="To page" type="number" value={form.readingTo ?? ''} onChange={(e) => set('readingTo', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input label="Exercise file" value={form.exercisePath || ''} onChange={(e) => set('exercisePath', e.target.value)} />
                            <Input label="From page" type="number" value={form.exerciseFrom ?? ''} onChange={(e) => set('exerciseFrom', e.target.value)} />
                            <Input label="To page" type="number" value={form.exerciseTo ?? ''} onChange={(e) => set('exerciseTo', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Video file" value={form.videoPath || ''} onChange={(e) => set('videoPath', e.target.value)} />
                            <Input label="External link" value={form.linkUrl || ''} onChange={(e) => set('linkUrl', e.target.value)} />
                        </div>
                    </>
                )}

                {!isSection && (
                    <Input label="Module book file" value={form.bookPath || ''} onChange={(e) => set('bookPath', e.target.value)} placeholder="imnci/Books/module 1.pdf" />
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
// Main screen
// =============================================================================

export default function OnlineCoursesView({ permissions = {} }) {
    const { i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const canManage = !!permissions.canManageOnlineCourses;
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
    const [assetsOpen, setAssetsOpen] = useState(false);

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

    // Every distinct file the whole catalogue points at, for the upload screen.
    const requiredPaths = useMemo(() => {
        const set = new Set();
        items.forEach((i) => [i.readingPath, i.exercisePath, i.chartPath, i.videoPath, i.bookPath]
            .filter(Boolean).forEach((p) => set.add(p)));
        return [...set].sort();
    }, [items]);

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
                        <h2 className="text-xl font-bold text-slate-800">{openSection.title}</h2>

                        <AssetLink path={openSection.readingPath} from={openSection.readingFrom}
                            to={openSection.readingTo} label="Reading" icon={FileText} />
                        <AssetLink path={openSection.exercisePath} from={openSection.exerciseFrom}
                            to={openSection.exerciseTo}
                            label={openSection.exerciseTitle || 'Exercise'} icon={FileText} />
                        <AssetLink path={openSection.chartPath} from={openSection.chartPage}
                            label="Chart booklet" icon={FileText} />
                        <AssetLink path={openSection.videoPath} label="Video" icon={Video} />

                        {openSection.linkUrl && (
                            <a href={openSection.linkUrl} target="_blank" rel="noopener noreferrer"
                                className="block p-3 border rounded text-sky-700 hover:bg-sky-50 text-sm">
                                {openSection.linkUrl}
                            </a>
                        )}

                        {!openSection.readingPath && !openSection.exercisePath
                            && !openSection.videoPath && !openSection.chartPath && !openSection.linkUrl && (
                            <div className="text-sm text-gray-500 p-4 border border-dashed rounded text-center">
                                This section has no material attached yet.
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
                    {canManage && (
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setAssetsOpen(true)}>
                                <Upload size={16} /> Upload course files
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
                                {canManage && (
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
                                                {s.readingPath && (
                                                    <div className="text-xs text-gray-500">
                                                        {s.readingFrom ? `pages ${s.readingFrom}${s.readingTo ? `–${s.readingTo}` : ''}` : s.readingPath}
                                                    </div>
                                                )}
                                            </button>
                                            {canManage && (
                                                <span className="flex gap-1">
                                                    <Button variant="secondary" onClick={() => setItemModal({ kind: 'section', item: s })}><Pencil size={14} /></Button>
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
                                    {canManage && (
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
                <AssetUploadModal isOpen={assetsOpen} onClose={() => setAssetsOpen(false)} requiredPaths={requiredPaths} />
            </div>
        );
    }

    // --- course list --------------------------------------------------------
    return (
        <div className="space-y-4">
            <PageHeader
                title={isArabic ? 'الدورات الإلكترونية' : 'Online Courses'}
                subtitle={isArabic ? 'تدريب ذاتي' : 'Self-paced training'}
                actions={canManage ? (
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setImportOpen(true)}>
                            <DownloadCloud size={16} /> Import
                        </Button>
                        <Button onClick={() => setCourseModal({})}>
                            <Plus size={16} /> Add course
                        </Button>
                    </div>
                ) : null}
            />

            {courses.length === 0 ? (
                <Card><CardBody className="text-center py-12 text-gray-500">
                    <BookOpen size={32} className="mx-auto mb-3 text-gray-400" />
                    <div className="font-medium text-gray-700">No courses yet</div>
                    {canManage && <div className="text-sm mt-1">Use Import to bring in the IMNCI course from the Android app.</div>}
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
                                        {canManage && (
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
