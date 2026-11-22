// src/components/imnci/onlineCourses/ManageHome.jsx
//
// The Manage online courses page: a module of its own, apart from the
// learners' Online Courses page, so nobody taking a course meets the
// managers' tools. Its tabs:
//   Courses       write and publish courses, grouped by category (authors)
//   Enrolment     approve requests, enrol learners, put them in groups
//   Groups        default groups and new ones (e.g. "Registrar batch 53"),
//                 each with an optional facilitator from the facilitator list
//   Progress      every learner's progress (the dashboard)
//   Books         the course books and the AI study helper (authors)
//   Deleted       the bin (authors)
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, Pencil, Trash2, DownloadCloud, GraduationCap, RefreshCw, Library, Stethoscope, Syringe, BarChart3, UserCheck, Users, Eye, Unlock, Lock,
} from 'lucide-react';
import { Card, CardBody, PageHeader, Button, Spinner, PageTabs } from '../../CommonComponents';
import { ImportModal } from './ImportModal';
import { CourseModal } from './ItemModals';
import { DeletedItems } from './DeletedItems';
import { AiLibraryView, ProgressDashboard } from './lazyParts';
import { useCourseScreen } from './screen';
import { usePageAddButton } from '../../../utils/pageChrome';
import { GroupedCourses, CourseCardBody, Pill } from './CourseList';
import { EnrolmentPanel, GroupsPanel, useEnrolmentAdmin } from './ManageEnrolment';
import { isOpenCourse } from './enrolment';

export function ManageHome() {
    const { t } = useTranslation();
    const {
        allCourses, allItems, allModules, builder, canManage, canSeeProgress, courseModal, courses, deletedCount,
        handleBinChanged, importOpen, openOtherArea, permissions, reload, resync, setBuilder, setCourseModal,
        setImportOpen, setTopTab, syncing, topTab,
    } = useCourseScreen();
    const admin = useEnrolmentAdmin();
    const guideDocs = courses.filter((c) => c.audience === 'facilitators');
    const learnerCourses = courses.filter((c) => !['facilitators', 'annex'].includes(c.audience));

    const tabs = [
        canManage && { id: 'courses', label: t('imnci_ui.manage.tab_courses', 'Courses'), icon: GraduationCap },
        { id: 'enrolment', label: t('imnci_ui.manage.tab_enrolment', 'Enrolment') + (admin.pending ? ` (${admin.pending})` : ''), short: t('imnci_ui.manage.tab_enrolment_short', 'Enrol'), icon: UserCheck },
        { id: 'groups', label: t('imnci_ui.manage.tab_groups', 'Groups'), icon: Users },
        canSeeProgress && { id: 'progress', label: t('imnci_ui.manage.tab_progress', 'Learner progress'), short: t('imnci_ui.progress.tab', 'Progress'), icon: BarChart3 },
        canManage && { id: 'books', label: t('ai_library.tab_books', 'Books and AI'), short: t('ai_library.tab_books_short', 'Books'), icon: Library },
        canManage && { id: 'deleted', label: t('imnci_ui.courses.main.deleted_bin', 'Deleted') + (deletedCount ? ` (${deletedCount})` : ''), icon: Trash2 },
    ].filter(Boolean);
    const shownTab = tabs.some((x) => x.id === topTab) ? topTab : tabs[0].id;

    usePageAddButton(t('imnci_ui.courses.course_modal.add', 'Add course'), () => setCourseModal({}), canManage && shownTab === 'courses' && !builder);

    return (
        <div className="space-y-4">
            <PageHeader
                title={t('landing.modules.online_courses_manage', 'Course Manager')}
                subtitle={t('imnci_ui.manage.subtitle', 'Courses, enrolment, groups and learner progress')}
                actions={
                    <div className="flex flex-wrap gap-2 items-center">
                        <Button variant="secondary" onClick={() => { resync(); admin.reload(); }} disabled={syncing}
                            title={t('imnci_ui.courses.main.refresh_title', 'Look for anything added on another device')}>
                            <RefreshCw size={16} className={syncing || admin.loading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{t('imnci_ui.courses.main.refresh', 'Refresh')}</span>
                        </Button>
                        {openOtherArea && (
                            <Button variant="secondary" onClick={openOtherArea} title={t('imnci_ui.manage.learner_view', 'Open the learners\' Online Courses page')}>
                                <Eye size={16} /> <span className="hidden sm:inline">{t('imnci_ui.manage.learner_view_short', 'Learner view')}</span>
                            </Button>
                        )}
                        {canManage && shownTab === 'courses' && (
                            <Button variant="secondary" onClick={() => setImportOpen(true)}>
                                <DownloadCloud size={16} /> <span className="hidden sm:inline">{t('imnci_ui.courses.import.import', 'Import')}</span>
                            </Button>
                        )}
                    </div>
                }
            />

            <PageTabs active={shownTab} onChange={setTopTab} tabs={tabs} />

            {shownTab === 'courses' ? (
                <div className="space-y-4">
                    {/* The course, the cases and the protocol are one body of work. */}
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setCourseModal({})}><Plus size={16} /> {t('imnci_ui.courses.course_modal.add', 'Add course')}</Button>
                        <Button variant="secondary" onClick={() => setBuilder('exercises')}>
                            <Stethoscope size={16} /> {t('imnci_ui.courses.main.case_builder', 'Case builder')}
                        </Button>
                        {permissions.canManageProtocols && (
                            <Button variant="secondary" onClick={() => setBuilder('protocol')}>
                                <Syringe size={16} /> {t('imnci_ui.courses.main.protocol_builder', 'Protocol builder')}
                            </Button>
                        )}
                    </div>
                    {courses.length === 0 ? (
                        <Card><CardBody className="text-center py-12 text-slate-500">
                            <div className="font-medium text-slate-700">{t('imnci_ui.courses.main.no_courses', 'No courses yet')}</div>
                            <div className="text-sm mt-1">{t('imnci_ui.courses.main.use_import', 'Use Import to bring in the IMNCI course from the Android app.')}</div>
                        </CardBody></Card>
                    ) : (
                        <>
                            {learnerCourses.length > 0 && (
                                <GroupedCourses list={learnerCourses} render={(c) => <AuthorCourseCard key={c.id} course={c} enrolled={admin.enrolledIn(c.id)} waiting={admin.waitingFor(c.id)} />} />
                            )}
                            {/* A facilitator guide is a guideline, not a course: it is read in
                                Protocol & Course Management > the service > Facilitator guide.
                                Its text is still edited here. */}
                            {/* Course annexes (SOPs, skill checklists, chart booklet ...) are not
                                courses: they are kept in Protocol & Course Management > a service >
                                Annexes, like the protocol, and any lesson opens them with a button. */}
                            {guideDocs.length > 0 && (
                                <div className="space-y-2" data-testid="manage-guides">
                                    <h3 className="text-base font-bold text-slate-900">{t('imnci_ui.manage.guides_title', 'Facilitator guides')}</h3>
                                    <p className="text-sm text-slate-500">{t('imnci_ui.manage.guides_hint', 'Guidelines for running a course, not courses: facilitators read them in Protocol & Course Management. Edit their text here.')}</p>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {guideDocs.map((c) => <AuthorCourseCard key={c.id} course={c} guide />)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            ) : shownTab === 'enrolment' ? (
                <EnrolmentPanel admin={admin} />
            ) : shownTab === 'groups' ? (
                <GroupsPanel admin={admin} />
            ) : shownTab === 'progress' ? (
                <Suspense fallback={<Spinner />}><ProgressDashboard /></Suspense>
            ) : shownTab === 'books' ? (
                <Suspense fallback={<Spinner />}><AiLibraryView canManage courses={courses} modules={allModules} /></Suspense>
            ) : (
                <DeletedItems courses={allCourses} items={allItems} onChanged={handleBinChanged} />
            )}

            <CourseModal isOpen={!!courseModal} onClose={() => setCourseModal(null)}
                course={courseModal?.id ? courseModal : null} onSaved={reload} />
            <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onImported={reload} existingCourses={allCourses} existingItems={allItems} />
        </div>
    );
}

function AuthorCourseCard({ course: c, enrolled, waiting, guide = false, annex = false }) {
    const { t } = useTranslation();
    const { go, removeCourse, setCourseModal, setTopTab } = useCourseScreen();
    const open = isOpenCourse(c);
    const badge = (
        <>
            {!c.isPublished && <Pill tone="draft">{t('imnci_ui.courses.main.draft', 'draft')}</Pill>}
            {annex ? <Pill tone="open">{t('imnci_ui.manage.annex_pill', 'Course annex')}</Pill> : guide ? <Pill tone="open">{t('imnci_ui.manage.guide_pill', 'Facilitator guide')}</Pill> : open
                ? <Pill tone="open"><Unlock size={11} /> {t('imnci_ui.enrol.open', 'Open')}</Pill>
                : <Pill tone="lock"><Lock size={11} /> {t('imnci_ui.enrol.approval', 'Approval')}</Pill>}
        </>
    );
    return (
        <CourseCardBody course={c} badge={badge}>
            {() => (
                <div className="flex-1 space-y-2">
                    {!open && !guide && !annex && (
                        <button onClick={() => setTopTab('enrolment')} className="text-xs text-slate-500 hover:text-sky-700 inline-flex items-center gap-1">
                            <UserCheck size={12} /> {t('imnci_ui.enrol.counts', '{{n}} enrolled · {{w}} waiting', { n: enrolled, w: waiting })}
                        </button>
                    )}
                    <div className="flex gap-2">
                        <Button className="flex-1 justify-center" onClick={() => go({ course: c.id, module: null, section: null, book: null, tab: 'read' })}>
                            {t('imnci_ui.manage.edit_content', 'Edit content')}
                        </Button>
                        <Button variant="secondary" onClick={() => setCourseModal(c)} title={t('imnci_ui.courses.course_modal.edit', 'Edit course')}><Pencil size={14} /></Button>
                        <Button variant="danger" onClick={() => removeCourse(c)} title={t('imnci_ui.courses.main.delete_course', 'Delete course')}><Trash2 size={14} /></Button>
                    </div>
                </div>
            )}
        </CourseCardBody>
    );
}
