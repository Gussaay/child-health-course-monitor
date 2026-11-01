// src/components/imnci/onlineCourses/CourseList.jsx
//
// The first page: every course, the Books library, and for authors the
// Deleted tab and the builders.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, Trash2, DownloadCloud, GraduationCap, Layers, RefreshCw, Library, Stethoscope, Syringe, X, BarChart3,
} from 'lucide-react';
import { Card, CardBody, PageHeader, Button, Spinner, PageTabs } from '../../CommonComponents';
import { ImportModal } from './ImportModal';
import { CourseModal } from './ItemModals';
import { DeletedItems } from './DeletedItems';
import { AiLibraryView, ExerciseManagerView, ProgressDashboard, ProtocolEditor } from './lazyParts';
import { useCourseScreen } from './screen';

export function CourseList() {
    const { t } = useTranslation();
    const {
        allCourses, allItems, allModules, builder, canManage, courseModal, courses, deletedCount,
        canSeeProgress, go, handleBinChanged, importOpen, isAdmin, items, mode, permissions,
        progress, refreshExercises, reload, removeCourse, resync, setBuilder, setCourseModal,
        setImportOpen, setMode, setTopTab, syncing, topTab,
    } = useCourseScreen();

    // --- course list --------------------------------------------------------
    // Leaving Manage mode leaves the Deleted tab too.
    const shownTab = (topTab === 'deleted' && !isAdmin) || (topTab === 'progress' && !canSeeProgress) ? 'courses' : topTab;
    return (
        <div className="space-y-4">
            <PageHeader
                title={t('imnci_ui.courses.main.page_title', 'Online Courses')}
                subtitle={t('imnci_ui.courses.main.page_subtitle', 'Self-paced training')}
                actions={
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button variant="secondary" onClick={resync} disabled={syncing}
                            title={t('imnci_ui.courses.main.refresh_title', 'Look for anything added on another device')}>
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{syncing ? t('imnci_ui.courses.main.checking', 'Checking…') : t('imnci_ui.courses.main.refresh', 'Refresh')}</span>
                        </Button>
                        {canManage && (
                            <div className="flex rounded-md overflow-hidden border border-slate-300">
                                <button
                                    onClick={() => setMode('learn')}
                                    className={`px-3 py-1.5 text-sm font-semibold ${mode === 'learn' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >{t('imnci_ui.courses.main.learn', 'Learn')}</button>
                                <button
                                    onClick={() => setMode('manage')}
                                    className={`px-3 py-1.5 text-sm font-semibold ${mode === 'manage' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                >{t('imnci_ui.courses.main.manage', 'Manage')}</button>
                            </div>
                        )}
                        {isAdmin && (
                            <>
                                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                                    <DownloadCloud size={16} /> {t('imnci_ui.courses.import.import', 'Import')}
                                </Button>
                                <Button onClick={() => setCourseModal({})}>
                                    <Plus size={16} /> {t('imnci_ui.courses.course_modal.add', 'Add course')}
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {isAdmin && (
                <div className="space-y-2">
                    <div className="px-3 py-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
                        {t('imnci_ui.courses.main.manage_note', 'Manage mode. Learners do not see the editing controls below, and drafts are visible only here.')}
                    </div>
                    {/* The course, the cases and the protocol are one body of
                        work, so the two other builders open from here rather
                        than being somewhere else in the app. */}
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setBuilder('exercises')}>
                            <Stethoscope size={16} /> {t('imnci_ui.courses.main.case_builder', 'Case builder')}
                        </Button>
                        {permissions.canManageProtocols && (
                            <Button variant="secondary" onClick={() => setBuilder('protocol')}>
                                <Syringe size={16} /> {t('imnci_ui.courses.main.protocol_builder', 'Protocol builder')}
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
                                {builder === 'protocol' ? t('imnci_ui.courses.main.protocol_builder', 'Protocol builder') : t('imnci_ui.courses.main.case_builder', 'Case builder')}
                            </h2>
                            <button onClick={() => { setBuilder(null); refreshExercises(); }}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={t('imnci_ui.courses.main.close', 'Close')}>
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

            {/* Deleted is a tab of its own, for authors, like the other pages
                of the app, rather than a button that swaps the list out. */}
            <PageTabs active={shownTab} onChange={setTopTab} tabs={[
                { id: 'courses', label: t('imnci_ui.courses.main.tab_courses', 'Courses'), icon: GraduationCap },
                { id: 'books', label: t('ai_library.tab_books', 'Books and AI'), short: t('ai_library.tab_books_short', 'Books'), icon: Library },
                canSeeProgress && { id: 'progress', label: t('imnci_ui.progress.tab', 'Progress'), icon: BarChart3 },
                isAdmin && { id: 'deleted', label: t('imnci_ui.courses.main.deleted_bin', 'Deleted') + (deletedCount ? ` (${deletedCount})` : ''), icon: Trash2 },
            ]} />

            {shownTab === 'progress' ? (
                <Suspense fallback={<Spinner />}><ProgressDashboard /></Suspense>
            ) : shownTab === 'deleted' ? (
                <DeletedItems courses={allCourses} items={allItems} onChanged={handleBinChanged} />
            ) : shownTab === 'books' ? (
                <Suspense fallback={<Spinner />}>
                    <AiLibraryView canManage={isAdmin} courses={courses} modules={allModules} />
                </Suspense>
            ) : courses.length === 0 ? (
                <Card><CardBody className="text-center py-12 text-slate-500">
                    <BookOpen size={32} className="mx-auto mb-3 text-slate-400" />
                    <div className="font-medium text-slate-700">{t('imnci_ui.courses.main.no_courses', 'No courses yet')}</div>
                    {isAdmin && <div className="text-sm mt-1">{t('imnci_ui.courses.main.use_import', 'Use Import to bring in the IMNCI course from the Android app.')}</div>}
                </CardBody></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {courses.map((c) => {
                        const secs = items.filter((i) => i.kind === 'section' && i.courseId === c.id);
                        const mods = items.filter((i) => i.kind === 'module' && i.courseId === c.id);
                        const done = secs.filter((s) => progress.completed?.[s.id]).length;
                        const pct = secs.length ? Math.round((done / secs.length) * 100) : 0;
                        return (
                            <div key={c.id} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-sky-300 transition flex flex-col">
                                <div className="p-4 flex flex-col flex-1 gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <span className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 grid place-items-center shrink-0">
                                            <BookOpen size={20} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold text-slate-800 flex items-start gap-2">
                                                <span className="min-w-0">{c.title}</span>
                                                {!c.isPublished && (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold shrink-0">
                                                        {t('imnci_ui.courses.main.draft', 'draft')}
                                                    </span>
                                                )}
                                            </h3>
                                            {c.description && <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">{c.description}</p>}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <span className="inline-flex items-center gap-1"><Layers size={13} /> {t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: mods.length })}</span>
                                        <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {t('imnci_ui.courses.main.n_sections', '{{n}} sections', { n: secs.length })}</span>
                                    </div>

                                    {secs.length > 0 && (
                                        <div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {t('imnci_ui.courses.main.card_progress', '{{done}} of {{total}} sections complete', { done, total: secs.length })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-auto pt-1">
                                        <Button className="flex-1 justify-center"
                                            onClick={() => go({ course: c.id, module: null, section: null, book: null, tab: 'read' })}>
                                            {done ? t('imnci_ui.courses.main.continue', 'Continue') : t('imnci_ui.courses.main.start', 'Start')}
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
