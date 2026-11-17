// src/components/imnci/onlineCourses/CoursePage.jsx
//
// One course: its progress, what to do next, search, and its modules. Each
// module opens on its own page, where its lessons are listed.
//
// The page is mainly the list of modules: a short header (title, one line of
// numbers, a thin progress bar and the lesson to resume), search, then one row
// per module that opens the module page. A locked module keeps its normal row
// with a red "Locked" badge.
import React, { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus, Pencil, ArrowLeft, ChevronRight, CheckCircle2, Lock, Search, X,
    CloudDownload, PlayCircle, Award,
} from 'lucide-react';
import { Card, Button } from '../../CommonComponents';
import { ItemModal } from './ItemModals';
import { searchSections } from './search';
import { CourseBooks } from './lazyParts';
import { savedModules } from './offline';
import { useCourseScreen } from './screen';
import { Pill, LockedBadge } from './ui';

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
    const isDone = (s) => !!progress.completed?.[s.id];

    const orphans = sectionsByModule.__none__ || [];
    const pct = courseSections.length ? Math.round((doneCount / courseSections.length) * 100) : 0;

    // Where each module stands, worked out once and used by the chips, the
    // filters and the cards.
    const moduleInfo = modules.map((m, i) => {
        const secs = sectionsByModule[m.id] || [];
        const done = secs.filter(isDone).length;
        const locked = moduleLocked(i);
        const status = locked ? 'locked'
            : secs.length > 0 && done === secs.length ? 'done'
                : done > 0 || nextUp?.moduleId === m.id ? 'active' : 'idle';
        return { m, i, secs, done, locked, status };
    });


    // The section "Up next" points at, with its numbers for the card.
    const next = useMemo(() => {
        if (!nextUp) return null;
        const mi = modules.findIndex((m) => m.id === nextUp.moduleId);
        const secs = sectionsByModule[nextUp.moduleId] || [];
        const si = secs.findIndex((s) => s.id === nextUp.sectionId);
        return si < 0 ? null : { section: secs[si], mi, si };
    }, [nextUp, modules, sectionsByModule]);

    const timeLeft = minutesLeft(courseSections);
    // Search runs over the sections a learner can see; a locked one is
    // listed but cannot be opened until the ones before it are done.
    const found = query.trim() ? searchSections(courseSections.filter((x) => x.isPublished !== false || isAdmin), query) : null;
    const lockedById = {};
    modules.forEach((m, mi) => {
        const secs = sectionsByModule[m.id] || [];
        secs.forEach((x, i) => { lockedById[x.id] = moduleLocked(mi) || sectionLocked(secs, i); });
    });
    const moduleTitle = Object.fromEntries(modules.map((m) => [m.id, m.title]));
    const openSection = (s) => go({ module: s.moduleId || '__none__', section: s.id, tab: 'read' });

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
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

            {/* The course: its name, one line of numbers, and where to carry on. */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">{openCourse.title}</h1>
                {openCourse.description && (
                    <p className="text-slate-600 text-sm mt-1 line-clamp-2">{openCourse.description}</p>
                )}
                <div className="text-xs sm:text-sm text-slate-500 mt-2 tabular-nums flex flex-wrap gap-x-2">
                    <span>{t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: modules.length })}</span>
                    <span>·</span>
                    <span>{t('imnci_ui.courses.main.n_sections', '{{n}} sections', { n: courseSections.length })}</span>
                    {timeLeft > 0 && (<><span>·</span><span>{doneCount
                        ? t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(timeLeft) })
                        : t('imnci_ui.courses.time.about', 'about {{time}}', { time: duration(timeLeft) })}</span></>)}
                    {!inOrder && (<><span>·</span><span>{t('imnci_ui.courses.main.any_order', 'Open in any order')}</span></>)}
                </div>
                {courseSections.length > 0 && (
                    <div className="flex items-center gap-3 mt-3">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1">
                            <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-bold text-sky-700 tabular-nums">{pct}%</span>
                    </div>
                )}
                {next ? (
                    <button onClick={() => openSection(next.section)}
                        className="mt-3 w-full text-start flex items-center gap-3 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2.5 hover:bg-sky-100">
                        <PlayCircle size={22} className="text-sky-700 shrink-0" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-sky-800">
                                {doneCount ? t('imnci_ui.courses.look.continue_label', 'Up next to continue') : t('imnci_ui.courses.look.start_label', 'Start here')}
                                {' · '}{t('imnci_ui.courses.look.section_n', 'Section {{n}}', { n: `${next.mi + 1}.${next.si + 1}` })}
                            </span>
                            <span className="block font-semibold text-slate-900 truncate">{next.section.title}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-sky-800">
                            {doneCount ? t('imnci_ui.courses.look.resume', 'Resume') : t('imnci_ui.courses.look.start', 'Start')}
                        </span>
                    </button>
                ) : courseSections.length > 0 && (
                    <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2.5 flex items-center gap-2 text-sm font-semibold">
                        <Award size={18} className="shrink-0" />
                        {t('imnci_ui.courses.look.course_complete', 'Course complete')}
                    </div>
                )}
            </section>

            {/* Search the course: a sign, a dose, a classification. */}
            {courseSections.length > 0 && (
                <label className="relative block">
                    <span className="sr-only">{t('imnci_ui.courses.search.label', 'Search this course')}</span>
                    <Search size={18} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-slate-400 pointer-events-none" />
                    <input type="text" inputMode="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('imnci_ui.courses.search.placeholder', 'Search this course, e.g. fast breathing')}
                        className="w-full border border-slate-200 bg-white rounded-xl py-3 ps-11 pe-10 text-base shadow-sm focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600" />
                    {query && (
                        <button type="button" onClick={() => setQuery('')} title={t('imnci_ui.courses.search.clear', 'Clear')}
                            className="absolute top-1/2 -translate-y-1/2 end-2 p-1.5 rounded text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    )}
                </label>
            )}

            {found ? (
                found.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 text-sm rounded-xl border border-dashed border-slate-300 bg-white">
                        {t('imnci_ui.courses.search.none', 'Nothing in this course matches "{{q}}".', { q: query.trim() })}
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <li className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                            {t('imnci_ui.courses.search.n_found', 'Sections found: {{n}}', { n: found.length })}
                        </li>
                        {found.map(({ section: x, snippet }) => {
                            const locked = !!lockedById[x.id];
                            return (
                                <li key={x.id}>
                                    <button type="button" disabled={locked} onClick={() => openSection(x)}
                                        className="w-full text-start px-4 py-3 hover:bg-sky-50/60 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                                        <div className="text-xs text-slate-500 truncate">{moduleTitle[x.moduleId] || ''}</div>
                                        <div className={`font-semibold flex items-center gap-1.5 ${locked ? 'text-slate-400' : 'text-slate-800'}`}>
                                            {locked && <Lock size={13} className="shrink-0" />}
                                            <span className="truncate">{x.title}</span>
                                            {isDone(x) && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
                                        </div>
                                        {snippet && <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{snippet}</div>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )
            ) : modules.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm rounded-xl border border-dashed border-slate-300 bg-white">
                    {t('imnci_ui.courses.main.no_modules', 'This course has no modules yet.')}
                </div>
            ) : (
                <ol className="rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden" data-testid="module-list">
                    {moduleInfo.map((info) => (
                        <ModuleRow key={info.m.id} info={info} saved={!!saved[info.m.id]} />
                    ))}
                </ol>
            )}

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

// One module in the list: its number, title and progress, opening the module
// page. A locked module keeps the normal row, with a red "Locked" badge and
// what it is waiting for, and cannot be opened.
function ModuleRow({ info, saved }) {
    const { t } = useTranslation();
    const { duration, go, minutesById } = useCourseScreen();
    const { m, i, secs, done, locked, status } = info;
    const mpct = secs.length ? Math.round((done / secs.length) * 100) : 0;
    const total = secs.reduce((n, x) => n + (minutesById[x.id] || 0), 0);
    return (
        <li data-testid="module-card" data-locked={locked ? 'true' : 'false'}
            className={status === 'active' ? 'border-s-4 border-s-sky-600' : undefined}>
            <button type="button" disabled={locked} onClick={() => go({ module: m.id, section: null, tab: 'read' })}
                title={locked ? t('imnci_ui.courses.look.requires_module', 'Requires completion of Module {{n}}', { n: i }) : undefined}
                className="w-full text-start px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-sky-50/60 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                <NumberCircle n={i + 1} status={status} />
                <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {t('imnci_ui.courses.look.module_n', 'Module {{n}}', { n: i + 1 })}
                        </span>
                        {locked && <LockedBadge>{t('imnci_ui.courses.look.locked', 'Locked')}</LockedBadge>}
                        {status === 'done' && <Pill tone="done">{t('imnci_ui.courses.look.completed', 'Completed')}</Pill>}
                        {status === 'active' && <Pill tone="active">{t('imnci_ui.courses.look.in_progress', 'In progress')}</Pill>}
                        {saved && <CloudDownload size={13} className="text-emerald-600" aria-label={t('imnci_ui.courses.offline.saved', 'Saved on this device')} />}
                    </span>
                    <span className="block font-bold text-base leading-snug mt-0.5 text-slate-900">{m.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5 tabular-nums">
                        {locked
                            ? <span className="text-slate-900 font-semibold">{t('imnci_ui.courses.look.requires_module', 'Requires completion of Module {{n}}', { n: i })}</span>
                            : t('imnci_ui.courses.look.n_of_m_sections', '{{done}} of {{total}} sections finished', { done, total: secs.length })}
                        {total > 0 && ` · ${duration(total)}`}
                    </span>
                    {status === 'active' && secs.length > 0 && (
                        <span className="block h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden max-w-xs">
                            <span className="block h-full rounded-full bg-sky-600" style={{ width: `${mpct}%` }} />
                        </span>
                    )}
                </span>
                {!locked && <ChevronRight size={20} className="text-slate-400 shrink-0 rtl:rotate-180" />}
            </button>
        </li>
    );
}

// The circle at the start of a module or lesson row: a green tick when done,
// the number in blue when in progress, otherwise (locked too) the number.
function NumberCircle({ n, status }) {
    const size = 'w-10 h-10 text-sm';
    if (status === 'done') return <span className={`${size} rounded-full bg-emerald-50 text-emerald-600 grid place-items-center shrink-0`}><CheckCircle2 size={20} /></span>;
    if (status === 'active') return <span className={`${size} rounded-full bg-sky-700 text-white grid place-items-center shrink-0 font-bold tabular-nums`}>{n}</span>;
    return <span className={`${size} rounded-full bg-slate-100 text-slate-700 grid place-items-center shrink-0 font-bold tabular-nums`}>{n}</span>;
}
