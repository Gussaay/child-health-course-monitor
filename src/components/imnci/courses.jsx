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
// in a module — and a section opens as its own page with three tabs: Read, See,
// Practise. Each tab is edited separately, so the person who writes the
// questions is not editing around the person who is correcting the prose.
//
// This file holds the state the screens share: where the learner is, their
// progress, and the author's dialogs. The screens themselves (SectionPage,
// ModulePage, CoursePage, CourseList) and the pieces they are built from are in
// onlineCourses/, and read that state through onlineCourses/screen.js.
import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { Spinner, Skeleton, SkeletonCard, useInPageBack } from '../CommonComponents';
import { notify, confirmDialog } from '../dialogs';
import { useDataCache } from '../../DataContext';
import { dropReplacedLeftovers } from '../../utils/replacedLeftovers';
import { useAuth } from '../../hooks/useAuth';
import { useImnci } from './shared';
import { listBooks } from '../aiLibrary/aiLibraryData';
import {
    deleteOnlineCourse, deleteOnlineCourseItem, getOnlineProgress, subscribeOnlineProgress, setOnlineSectionComplete, setOnlineSectionActivities,
} from '../../data';
// The pieces of the course, one file each.
import { useCoursePlace, placeDepth } from './onlineCourses/place';
import { focusedCourseId, clearFocusedCourse } from '../../utils/courseLink';
import { readingMinutes } from './onlineCourses/search';
import { BookPage, BookFormModal } from './onlineCourses/lazyParts';
import { CourseScreen } from './onlineCourses/screen';
import { SectionPage } from './onlineCourses/SectionPage';
import { ModulePage } from './onlineCourses/ModulePage';
import { CoursePage } from './onlineCourses/CoursePage';
import { CourseList } from './onlineCourses/CourseList';
import { BuilderPane } from './onlineCourses/BuilderPane';
import { canAccessDraft, canSeeCourse, followsAnyLesson, isFacilitatorRole } from './onlineCourses/audience';
import { categoryOf } from './onlineCourses/categories';
import { useMyEnrolments, courseAccess, canStudy } from './onlineCourses/enrolment';
import { EnrolGate, DraftSoonGate } from './onlineCourses/EnrolGate';
import { ManageHome } from './onlineCourses/ManageHome';

// Kept importable from here, where they used to live.
export { ASSET_ROOT, assetPath } from './onlineCourses/assets';
export { LEGACY_DB, mapLegacyCourse, mapLegacyModule, buildMigration } from './onlineCourses/migration';

// =============================================================================
// Main screen
// =============================================================================

// Roles that manage people, and so see the learners' progress (the server
// checks the same in functions/onlineProgressReport.js).
const MANAGER_ROLES = ['super_user', 'federal_manager', 'states_manager', 'locality_manager'];

// `area`: "learn" is the Online Courses page every learner sees; "manage" is
// the separate Manage online courses page (authoring, enrolment, groups and
// the learners' progress), so a learner never meets the managers' tools.
// `category`: only the courses of one service (Protocol & Course Management
// opens the Course Manager for one service this way).
export default function OnlineCoursesView({ permissions = {}, userRoles = [], area = 'learn', openOtherArea = null, category = '' }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const tabName = (x) => (isArabic && x.labelAr ? x.labelAr : x.label);
    // Two distinct experiences, not one screen with extra buttons for some
    // people. A learner should never see an edit pencil or a delete button
    // beside the material they are trying to read, so authoring lives behind a
    // mode that only the federal roles can switch into, and it starts off.
    const inManageArea = area === 'manage';
    const canManage = !!permissions.canManageOnlineCourses;
    const mode = inManageArea && canManage ? 'manage' : 'learn';
    const setMode = () => {};
    const isAdmin = canManage && mode === 'manage';
    const canSeeProgress = (userRoles || []).some((r) => MANAGER_ROLES.includes(String(r).toLowerCase()));
    const isFacilitator = isFacilitatorRole(userRoles);

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
    // Which courses this learner is enrolled in (managers approve them).
    const enrolments = useMyEnrolments(inManageArea ? null : user?.uid);

    const {
        onlineCourses, fetchOnlineCourses,
        onlineCourseItems, fetchOnlineCourseItems, isLoading, removeFromCache,
    } = useDataCache();

    // Three levels, one open thing at each. An accordion of every module and
    // every section at once was unreadable on a phone once a converted book
    // turned one module into thirty sections.
    //
    // Which one is open lives in the address (see onlineCourses/place.js), so
    // refresh, a shared link and the back button all keep the learner's place.
    const [place, go, back] = useCoursePlace();
    const { course: openCourseId, module: openModuleId, section: openSectionId, tab: sectionTab, book: openBookId } = place;
    const setSectionTab = (tab) => go({ tab });
    // Opened from a course link (utils/courseLink.js): only that course is
    // shown, with no way to the list of the other courses. Ends when the
    // learner leaves Online Courses.
    const [focusId] = useState(() => (inManageArea ? null : focusedCourseId()));
    useEffect(() => (focusId ? () => clearFocusedCourse() : undefined), [focusId]);
    useEffect(() => {
        if (focusId && !openCourseId) go({ course: focusId }, { replace: true });
    }, [focusId, openCourseId, go]);
    const [compare, setCompare] = useState(false);
    const [progress, setProgress] = useState({ completed: {} });

    const [courseModal, setCourseModal] = useState(null);
    const [itemModal, setItemModal] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    // The two builders the course author also needs. Opened over the course
    // rather than navigated to, so going back does not lose where they were.
    const [builder, setBuilder] = useState(null);
    const [convertOpen, setConvertOpen] = useState(false);
    // Which tab of the open section is being written, or null when reading.
    // Held with the section it belongs to, so stepping to another section
    // (back, a link) never leaves the editor open on the wrong one.
    const [editing, setEditing] = useState(null); // { id, tab }
    const editingTab = editing && editing.id === openSectionId ? editing.tab : null;
    const setEditingTab = (tab, id = openSectionId) => setEditing(tab ? { id, tab } : null);
    useEffect(() => { setCompare(false); }, [openSectionId]);
    // Courses, the Books library or (for authors) Deleted, on the first page.
    const [topTab, setTopTab] = useState('courses');
    // Search across the open course's sections.
    const [query, setQuery] = useState('');
    useEffect(() => { setQuery(''); }, [openCourseId]);
    // The course books: loaded once, for the course page's Course books.
    const [aiBooks, setAiBooks] = useState([]);
    const [bookForm, setBookForm] = useState(null); // { book?, courseId? }
    const loadBooks = useCallback(() => { listBooks().then(setAiBooks).catch(() => setAiBooks([])); }, []);
    // The books belong to the Manage page; a learner's page loads them only to open one by its link.
    useEffect(() => { if (inManageArea || openBookId) loadBooks(); }, [loadBooks, inManageArea, openBookId]);

    useEffect(() => {
        if (!onlineCourses) fetchOnlineCourses(false);
        if (!onlineCourseItems) fetchOnlineCourseItems(false);
    }, [onlineCourses, onlineCourseItems, fetchOnlineCourses, fetchOnlineCourseItems]);

    // The learner's own progress is the one thing read live: it opens with one
    // read and then brings only changes (a lesson finished on another phone).
    // If the listener is refused, one plain read as before.
    useEffect(() => {
        if (!user?.uid) return undefined;
        let alive = true;
        const stop = subscribeOnlineProgress(user.uid, (p) => { if (alive && p) setProgress(p); }, () => {
            getOnlineProgress(user.uid).then((p) => { if (alive && p) setProgress(p); }).catch(() => {});
        });
        return () => { alive = false; stop(); };
    }, [user?.uid]);

    const reload = useCallback(() => {
        fetchOnlineCourses('sync');
        fetchOnlineCourseItems('sync');
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

    // The bin either restores something (a soft change the delta sync picks up)
    // or deletes it for good, in which case exactly those ids leave the cache.
    const handleBinChanged = useCallback(async (removed) => {
        if (removed) {
            for (const [key, ids] of Object.entries(removed)) await removeFromCache(key, ids);
        } else {
            await resync();
        }
    }, [removeFromCache, resync]);

    const courses = useMemo(() => (onlineCourses || [])
        .filter((c) => c.isDeleted !== true)
        // An unpublished course is a draft. It stays in the list for
        // everyone, shown as "will be available soon"; only the people who
        // manage courses and the testers it names by email can open it
        // (accessOf gives everyone else 'soon').
        .filter((c) => (inManageArea && canManage) || c.isPublished || c.isPublished === false)
        // A course for facilitators (the facilitator guide, with answer keys
        // and the examination) is not shown to learners.
        .filter((c) => canSeeCourse(c, { canManage, canSeeProgress, isFacilitator }))
        .filter((c) => !focusId || c.id === focusId)
        .filter((c) => !category || categoryOf(c) === category)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
    [onlineCourses, canManage, canSeeProgress, isFacilitator, inManageArea, focusId, category, user?.email]);

    // Old copies left on this device by an upload's replace are dropped here.
    const currentItems = useMemo(() => dropReplacedLeftovers(onlineCourseItems || []), [onlineCourseItems]);
    const items = useMemo(() => currentItems.filter((i) => i.isDeleted !== true), [currentItems]);

    // Everything, deleted or not. The bin needs what the rest of the screen
    // filters out, and a permanent delete needs to know which pictures the
    // surviving sections still point at.
    const allItems = currentItems;
    const allCourses = useMemo(() => onlineCourses || [], [onlineCourses]);
    const deletedCount = useMemo(
        () => allCourses.filter((c) => c.isDeleted === true).length
            + allItems.filter((i) => i.isDeleted === true).length,
        [allCourses, allItems]);

    const openCourse = courses.find((c) => c.id === openCourseId) || null;

    // Whether the learner may study a course: open, enrolled, or started
    // before enrolment existed. In the manage area everything is open.
    const sectionCourse = useMemo(() => Object.fromEntries(items.filter((i) => i.kind === 'section').map((i) => [i.id, i.courseId])), [items]);
    const startedCourses = useMemo(() => {
        const out = new Set();
        Object.keys(progress.completed || {}).forEach((id) => { if (sectionCourse[id]) out.add(sectionCourse[id]); });
        return out;
    }, [progress, sectionCourse]);
    const accessOf = useCallback((c) => (inManageArea ? 'enrolled'
        : courseAccess(c, enrolments.byCourse[c?.id], {
            canManage: false,
            started: startedCourses.has(c?.id),
            draftAccess: canAccessDraft(c, { canManage, email: user?.email }),
        })),
    [inManageArea, enrolments.byCourse, startedCourses, canManage, user?.email]);

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

    // How long each section takes to read, so a health worker with twenty
    // minutes between patients can pick something that fits.
    const minutesById = useMemo(
        () => Object.fromEntries(courseSections.map((s) => [s.id, readingMinutes(s)])),
        [courseSections]);
    const duration = (min) => (min >= 60
        ? t('imnci_ui.courses.time.hours', '{{h}} h {{m}} min', { h: Math.floor(min / 60), m: min % 60 })
        : t('imnci_ui.courses.time.minutes', '{{n}} min', { n: min }));
    // Minutes still to read in a list of sections: the ones not marked done.
    const minutesLeft = (secs) => secs.reduce((n, x) => n + (progress.completed?.[x.id] ? 0 : (minutesById[x.id] || 0)), 0);

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

    // A course can open every section at once instead (its author's choice,
    // in the course's settings): a refresher, or a course used in a classroom
    // where the trainer moves around the book.
    // Everyone in Learn mode reads the course in order, managers and
    // facilitators included, so they see the course as their learners do.
    // Manage mode (isAdmin) opens everything. A facilitator or manager who
    // follows a link from a facilitator guide may open that one lesson or
    // module out of order (guidePass), so the guide's links still work.
    const inOrder = openCourse?.lockOrder !== false;
    const mayFollowGuide = followsAnyLesson({ canSeeProgress, isFacilitator }) || canManage;
    const [guidePass, setGuidePass] = useState(null);
    const openFromGuide = useCallback((target) => {
        if (mayFollowGuide) setGuidePass(target ? { moduleId: target.moduleId || null, sectionId: target.sectionId || null } : null);
    }, [mayFollowGuide]);

    // A course can also let each module be taken on its own
    // (modulesAnyOrder): every module opens, and the lessons inside it are
    // still read in order. A reference module (a module's anyOrder: the
    // procedures, the equipment) opens all its lessons, so other modules can
    // link to the one they need.
    const modulesAnyOrder = openCourse?.modulesAnyOrder === true;
    const moduleLocked = useCallback((index) => {
        if (isAdmin || !inOrder || modulesAnyOrder || index <= 0) return false;
        if (guidePass?.moduleId && guidePass.moduleId === modules[index]?.id) return false;
        return !moduleComplete(modules[index - 1]);
    }, [isAdmin, inOrder, modulesAnyOrder, modules, moduleComplete, guidePass]);

    const sectionLocked = useCallback((secs, index) => {
        if (isAdmin || !inOrder || index <= 0) return false;
        const mod = modules.find((m) => m.id === secs[index]?.moduleId);
        if (mod?.anyOrder === true) return false;
        if (guidePass?.sectionId && guidePass.sectionId === secs[index]?.id) return false;
        return !sectionDone(secs[index - 1]);
    }, [isAdmin, inOrder, modules, sectionDone, guidePass]);

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
            notify(t('imnci_ui.courses.main.progress_failed', 'Could not save your progress.'), 'error');
        }
    };

    // The activities done in a lesson follow the learner's account. A failed
    // save is not reported: the tally is also kept on the device, and is sent
    // again with the next activity.
    const saveActivities = useCallback((sectionId, keys) => {
        if (!user?.uid || !sectionId) return;
        setProgress((p) => ({ ...p, activities: { ...(p.activities || {}), [sectionId]: keys } }));
        setOnlineSectionActivities(user.uid, sectionId, keys).catch(() => {});
    }, [user?.uid]);

    // The phone's back button and the app bar's arrow step out one level.
    // A course opened from its link has nothing above it: back leaves the page.
    useInPageBack(back, !!openCourseId && !editingTab && !(focusId && placeDepth(place) <= 1));

    const removeCourse = async (course) => {
        if (!await confirmDialog(t('imnci_ui.courses.main.delete_course_confirm', 'Delete "{{title}}" and hide all its content?', { title: course.title }),
            { title: t('imnci_ui.courses.main.delete_course', 'Delete course'), confirmLabel: t('imnci_ui.courses.common.delete', 'Delete'), danger: true })) return;
        try { await deleteOnlineCourse(course.id); notify(t('imnci_ui.courses.main.course_deleted', 'Course deleted.'), 'success'); resync(); }
        catch (e) { console.error(e); notify(t('imnci_ui.courses.main.course_delete_failed', 'Could not delete the course.'), 'error'); }
    };

    const removeItem = async (item) => {
        if (!await confirmDialog(t('imnci_ui.courses.main.delete_item_confirm', 'Delete "{{title}}"?', { title: item.title }),
            { title: item.kind === 'module' ? t('imnci_ui.courses.main.delete_module', 'Delete module') : t('imnci_ui.courses.main.delete_section', 'Delete section'), confirmLabel: t('imnci_ui.courses.common.delete', 'Delete'), danger: true })) return;
        try { await deleteOnlineCourseItem(item.id); notify(t('imnci_ui.courses.main.deleted', 'Deleted.'), 'success'); resync(); }
        catch (e) { console.error(e); notify(t('imnci_ui.courses.main.delete_failed', 'Could not delete.'), 'error'); }
    };

    if ((isLoading?.onlineCourses && !onlineCourses) || (isLoading?.onlineCourseItems && !onlineCourseItems)) {
        // The shape of the course list rather than a spinner, so the page
        // does not jump when the courses arrive.
        return (
            <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-10 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <SkeletonCard lines={3} /><SkeletonCard lines={3} /><SkeletonCard lines={3} />
                </div>
            </div>
        );
    }

    const allModules = items.filter((i) => i.kind === 'module');
    const bookDialog = bookForm && (
        <Suspense fallback={null}>
            <BookFormModal book={bookForm.book} defaultCourseId={bookForm.courseId || ''}
                defaultService={/etat/i.test(openCourse?.title || '') ? 'ETAT' : /eenc/i.test(openCourse?.title || '') ? 'EENC' : 'IMNCI'}
                courses={courses} modules={allModules}
                onClose={() => setBookForm(null)} onSaved={() => { setBookForm(null); loadBooks(); }} />
        </Suspense>
    );

    // --- a course book --------------------------------------------------------
    const openBook = openBookId ? aiBooks.find((b) => b.id === openBookId && !b.isDeleted) : null;
    if (openBook) {
        return (
            <Suspense fallback={<Spinner />}>
                <BookPage book={openBook} canManage={isAdmin} backLabel={openCourse?.title}
                    onBack={back} onEdit={() => setBookForm({ book: openBook })} />
                {bookDialog}
            </Suspense>
        );
    }

    // --- the screens ----------------------------------------------------------
    // One open thing at each level, deepest first: a section, the sections of
    // a module, the modules of a course, or the list of courses.
    const screen = {
        aiBooks, allCourses, allItems, allModules, back, bookDialog, bookForm, builder, canManage, canSeeProgress,
        checkedEmpty, compare, convertOpen, courseModal, courseSections, courses, deletedCount,
        doneCount, duration, editing, editingTab, fetchOnlineCourseItems, fetchOnlineCourses,
        fontScale, go, handleBinChanged, importOpen, inOrder, isAdmin, isArabic, isLoading,
        itemModal, items, loadBooks, minutesById, minutesLeft, mode, moduleComplete, moduleLocked,
        modules, nextUp, onlineCourseItems, onlineCourses, openBookId, openCourse, openCourseId,
        openModule, openModuleId, openSection, openSectionId, permissions, place, progress, query,
        openFromGuide, refreshExercises, reload, removeCourse, removeFromCache, removeItem, resync, saveActivities, sectionDone,
        sectionLocked, sectionTab, sectionsByModule, setAiBooks, setBookForm, setBuilder, setCompare,
        setConvertOpen, setCourseModal, setEditing, setEditingTab, setFontScale, setImportOpen,
        setItemModal, setMode, setProgress, setQuery, setScale, setSectionTab, setSyncing, setTopTab,
        syncing, tabName, toggleComplete, topTab, user,
        accessOf, area, enrolments, inManageArea, openOtherArea, userRoles, focusId,
    };
    const Home = inManageArea ? ManageHome : CourseList;
    const openAccess = openCourse ? accessOf(openCourse) : null;
    const gated = openCourse && !inManageArea && !canStudy(openAccess);
    const Screen = gated ? (openAccess === 'soon' ? DraftSoonGate : EnrolGate) : openSection ? SectionPage : openModule ? ModulePage : openCourse ? CoursePage : Home;
    return (
        <CourseScreen.Provider value={screen}>
            <Screen />
            <BuilderPane />
        </CourseScreen.Provider>
    );
}
