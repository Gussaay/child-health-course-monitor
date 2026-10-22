// src/components/imnci/onlineCourses/CoursePage.jsx
//
// One course: its progress, search, modules and books.
//
// Straight to the modules. There was an Overview tab in front of them and it
// was a page of numbers standing between the learner and the thing they came
// to do. The part of it worth keeping — the progress bar and Continue — sits
// in the header instead.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, ArrowLeft, CheckCircle2, Lock, Unlock, Clock, GraduationCap, Layers, Search, X, CloudDownload,
} from 'lucide-react';
import { Card, Button } from '../../CommonComponents';
import { ItemModal } from './ItemModals';
import { searchSections } from './search';
import { CourseBooks } from './lazyParts';
import { savedModules } from './offline';
import { useCourseScreen } from './screen';

export function CoursePage() {
    const { t } = useTranslation();
    const {
        aiBooks, back, bookDialog, courseSections, doneCount, duration, go,
        inOrder, isAdmin, itemModal, minutesLeft, moduleLocked, modules, nextUp, openCourse,
        openCourseId, progress, query, reload, sectionLocked, sectionsByModule, setBookForm,
        setItemModal, setQuery,
    } = useCourseScreen();
    // Modules saved for offline on this device, marked on their cards.
    const saved = savedModules();

    const orphans = sectionsByModule.__none__ || [];
    const pct = courseSections.length ? Math.round((doneCount / courseSections.length) * 100) : 0;

    const chips = [
        { Icon: Layers, label: t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: modules.length }) },
        { Icon: BookOpen, label: t('imnci_ui.courses.main.n_sections', '{{n}} sections', { n: courseSections.length }) },
        minutesLeft(courseSections) > 0 && {
            Icon: Clock,
            label: doneCount
                ? t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(minutesLeft(courseSections)) })
                : t('imnci_ui.courses.time.about', 'about {{time}}', { time: duration(minutesLeft(courseSections)) }),
        },
        inOrder
            ? { Icon: Lock, label: t('imnci_ui.courses.main.in_order', 'Sections open in order') }
            : { Icon: Unlock, label: t('imnci_ui.courses.main.any_order', 'Open in any order') },
    ];
    // Search runs over the sections a learner can see; a locked one is
    // listed but cannot be opened until the ones before it are done.
    const found = query.trim() ? searchSections(courseSections.filter((x) => x.isPublished !== false || isAdmin), query) : null;
    const lockedById = {};
    modules.forEach((m, mi) => {
        const secs = sectionsByModule[m.id] || [];
        secs.forEach((x, i) => { lockedById[x.id] = moduleLocked(mi) || sectionLocked(secs, i); });
    });
    const moduleTitle = Object.fromEntries(modules.map((m) => [m.id, m.title]));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={back}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {t('imnci_ui.courses.main.all_courses', 'All courses')}
                </button>
                {isAdmin && (
                    <Button variant="secondary" onClick={() => setItemModal({ kind: 'module' })}>
                        <Plus size={16} /> {t('imnci_ui.courses.item_modal.add_module', 'Add module')}
                    </Button>
                )}
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                {/* A plain header: the course's name, what is in it and how far
                    the learner has got, with Continue beside the progress. */}
                <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                        <span className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 grid place-items-center shrink-0">
                            <GraduationCap size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{openCourse.title}</h1>
                            {openCourse.description && (
                                <p className="text-slate-600 text-sm mt-1 max-w-2xl">{openCourse.description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                {chips.filter(Boolean).map(({ Icon, label }) => (
                                    <span key={label} className="inline-flex items-center gap-1.5">
                                        <Icon size={14} className="text-slate-400" />{label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {courseSections.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            <div className="flex-1 min-w-[10rem] max-w-md">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {t('imnci_ui.courses.main.progress_line', '{{done}} of {{total}} sections · {{pct}}%', { done: doneCount, total: courseSections.length, pct })}
                                </div>
                            </div>
                            {nextUp ? (
                                <Button onClick={() => go({ module: nextUp.moduleId, section: nextUp.sectionId, tab: 'read' })}>
                                    <GraduationCap size={16} />
                                    {doneCount ? t('imnci_ui.courses.main.continue', 'Continue') : t('imnci_ui.courses.main.start_course', 'Start the course')}
                                </Button>
                            ) : (
                                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                    <CheckCircle2 size={18} /> {t('imnci_ui.courses.main.all_finished', 'Every section finished')}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Search the course: a sign, a dose, a classification. */}
                {courseSections.length > 0 && (
                    <div className="px-4 pt-4">
                        <label className="relative block">
                            <span className="sr-only">{t('imnci_ui.courses.search.label', 'Search this course')}</span>
                            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 pointer-events-none" />
                            <input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('imnci_ui.courses.search.placeholder', 'Search this course, e.g. fast breathing')}
                                className="w-full border border-slate-300 rounded-lg py-2 ps-9 pe-9 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                            {query && (
                                <button type="button" onClick={() => setQuery('')} title={t('imnci_ui.courses.search.clear', 'Clear')}
                                    className="absolute top-1/2 -translate-y-1/2 end-2 p-1 rounded text-slate-400 hover:text-slate-600">
                                    <X size={15} />
                                </button>
                            )}
                        </label>
                    </div>
                )}


                <div className="p-4 space-y-3">
                    {found ? (
                        found.length === 0 ? (
                            <div className="text-center text-slate-500 py-8 text-sm">
                                {t('imnci_ui.courses.search.none', 'Nothing in this course matches "{{q}}".', { q: query.trim() })}
                            </div>
                        ) : (
                            <ul className="divide-y border border-slate-200 rounded-xl overflow-hidden">
                                <li className="px-4 py-2 text-xs text-slate-500 bg-slate-50">
                                    {t('imnci_ui.courses.search.n_found', 'Sections found: {{n}}', { n: found.length })}
                                </li>
                                {found.map(({ section: x, snippet }) => {
                                    const locked = !!lockedById[x.id];
                                    return (
                                        <li key={x.id}>
                                            <button type="button" disabled={locked}
                                                onClick={() => go({ module: x.moduleId || '__none__', section: x.id, tab: 'read' })}
                                                className="w-full text-start px-4 py-3 hover:bg-sky-50/60 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                                                <div className="text-xs text-slate-500 truncate">{moduleTitle[x.moduleId] || ''}</div>
                                                <div className={`font-medium flex items-center gap-1.5 ${locked ? 'text-slate-400' : 'text-slate-800'}`}>
                                                    {locked && <Lock size={13} className="shrink-0" />}
                                                    <span className="truncate">{x.title}</span>
                                                    {progress.completed?.[x.id] && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                                                </div>
                                                {snippet && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{snippet}</div>}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    ) : modules.length === 0 ? (
                        <div className="text-center text-slate-500 py-10 text-sm">
                            {t('imnci_ui.courses.main.no_modules', 'This course has no modules yet.')}
                        </div>
                    ) : modules.map((m, i) => {
                        const secs = sectionsByModule[m.id] || [];
                        const done = secs.filter((x) => progress.completed?.[x.id]).length;
                        const mpct = secs.length ? Math.round((done / secs.length) * 100) : 0;
                        const locked = moduleLocked(i);
                        return (
                            <button key={m.id} disabled={locked} onClick={() => go({ module: m.id, section: null, tab: 'read' })}
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
                                                ? t('imnci_ui.courses.main.finish_module_before', 'Finish the module before this one to open it')
                                                : t('imnci_ui.courses.main.module_progress', '{{done}} / {{total}} sections', { done, total: secs.length }) + (secs.length ? ` · ${mpct}%` : '')
                                                    + (minutesLeft(secs) > 0 ? ' · ' + t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(minutesLeft(secs)) }) : '')}
                                        </div>
                                        {saved[m.id] && (
                                            <div className="text-xs text-emerald-700 mt-0.5 inline-flex items-center gap-1">
                                                <CloudDownload size={12} /> {t('imnci_ui.courses.offline.saved', 'Saved on this device')}
                                            </div>
                                        )}
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

            <Suspense fallback={null}>
                <CourseBooks courseId={openCourse.id} books={aiBooks} canManage={isAdmin}
                    onOpen={(id) => go({ book: id, module: null, section: null })} onAdd={() => setBookForm({ courseId: openCourse.id })} />
            </Suspense>
            {bookDialog}

            {orphans.length > 0 && isAdmin && (
                <Card>
                    <div className="p-3 bg-amber-50 border-b border-amber-200 font-bold text-amber-900 text-sm">
                        {t('imnci_ui.courses.main.orphans', 'Sections not attached to a module')}
                    </div>
                    <div className="divide-y">
                        {orphans.map((s) => (
                            <div key={s.id} className="p-3 flex items-center gap-3">
                                <button className="flex-1 text-start"
                                    onClick={() => go({ module: '__none__', section: s.id, tab: 'read' })}>{s.title}</button>
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
