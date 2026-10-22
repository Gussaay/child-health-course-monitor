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
import { useAuth } from '../../hooks/useAuth';
import { useImnci } from './shared';
import { listBooks } from '../aiLibrary/aiLibraryData';
import {
    deleteOnlineCourse, deleteOnlineCourseItem, getOnlineProgress, setOnlineSectionComplete,
} from '../../data';
// The pieces of the course, one file each.
import { useCoursePlace } from './onlineCourses/place';
import { readingMinutes } from './onlineCourses/search';
import { BookPage, BookFormModal } from './onlineCourses/lazyParts';
import { CourseScreen } from './onlineCourses/screen';
import { SectionPage } from './onlineCourses/SectionPage';
import { ModulePage } from './onlineCourses/ModulePage';
import { CoursePage } from './onlineCourses/CoursePage';
import { CourseList } from './onlineCourses/CourseList';

// Kept importable from here, where they used to live.
export { ASSET_ROOT, assetPath } from './onlineCourses/assets';
export { LEGACY_DB, mapLegacyCourse, mapLegacyModule, buildMigration } from './onlineCourses/migration';

// =============================================================================
// Main screen
// =============================================================================

export default function OnlineCoursesView({ permissions = {} }) {
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language === 'ar';
    const tabName = (x) => (isArabic && x.labelAr ? x.labelAr : x.label);
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
    useEffect(() => { loadBooks(); }, [loadBooks]);

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
    const inOrder = openCourse?.lockOrder !== false;

    const moduleLocked = useCallback((index) => {
        if (isAdmin || !inOrder || index <= 0) return false;
        return !moduleComplete(modules[index - 1]);
    }, [isAdmin, inOrder, modules, moduleComplete]);

    const sectionLocked = useCallback((secs, index) => {
        if (isAdmin || !inOrder || index <= 0) return false;
        return !sectionDone(secs[index - 1]);
    }, [isAdmin, inOrder, sectionDone]);

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

    // The phone's back button and the app bar's arrow step out one level.
    useInPageBack(back, !!openCourseId && !editingTab);

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
        aiBooks, allCourses, allItems, allModules, back, bookDialog, bookForm, builder, canManage,
        checkedEmpty, compare, convertOpen, courseModal, courseSections, courses, deletedCount,
        doneCount, duration, editing, editingTab, fetchOnlineCourseItems, fetchOnlineCourses,
        fontScale, go, handleBinChanged, importOpen, inOrder, isAdmin, isArabic, isLoading,
        itemModal, items, loadBooks, minutesById, minutesLeft, mode, moduleComplete, moduleLocked,
        modules, nextUp, onlineCourseItems, onlineCourses, openBookId, openCourse, openCourseId,
        openModule, openModuleId, openSection, openSectionId, permissions, place, progress, query,
        refreshExercises, reload, removeCourse, removeFromCache, removeItem, resync, sectionDone,
        sectionLocked, sectionTab, sectionsByModule, setAiBooks, setBookForm, setBuilder, setCompare,
        setConvertOpen, setCourseModal, setEditing, setEditingTab, setFontScale, setImportOpen,
        setItemModal, setMode, setProgress, setQuery, setScale, setSectionTab, setSyncing, setTopTab,
        syncing, tabName, toggleComplete, topTab, user,
    };
    const Screen = openSection ? SectionPage : openModule ? ModulePage : openCourse ? CoursePage : CourseList;
    return (
        <CourseScreen.Provider value={screen}>
            <Screen />
        </CourseScreen.Provider>
    );
}
