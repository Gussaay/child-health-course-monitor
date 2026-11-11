// src/components/imnci/onlineCourses/CoursePage.jsx
//
// One course: its progress, what to do next, search, and the modules with
// their sections folded under each one.
//
// The layout follows the "Clinical Slate & Sky" design: a header with the
// course's numbers, one large progress figure, an "Up next" card that resumes
// where the learner stopped, filter chips, and the modules as an accordion so
// a learner can see the sections of a module without leaving the page. The
// module page is still there, one tap away, for saving a module for offline
// use and for the authors' tools.
import React, { Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpen, Plus, Pencil, ArrowLeft, ArrowRight, CheckCircle2, Lock, Unlock, Clock, Layers, Search, X,
    CloudDownload, ChevronDown, PlayCircle, Play, RotateCw, Award,
} from 'lucide-react';
import { Card, Button } from '../../CommonComponents';
import { ItemModal } from './ItemModals';
import { searchSections } from './search';
import { CourseBooks } from './lazyParts';
import { savedModules } from './offline';
import { useCourseScreen } from './screen';
import { Pill } from './ui';

export function CoursePage() {
    const { t } = useTranslation();
    const {
        aiBooks, back, bookDialog, courseSections, doneCount, duration, go,
        inOrder, isAdmin, itemModal, minutesById, minutesLeft, moduleLocked, modules, nextUp, openCourse,
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
    const modulesDone = moduleInfo.filter((x) => x.status === 'done').length;

    const [filter, setFilter] = useState('all');
    // The module the learner is working in starts open; the rest are folded.
    const [openIds, setOpenIds] = useState(() => new Set(nextUp?.moduleId ? [nextUp.moduleId] : []));
    const toggleOpen = (id) => setOpenIds((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });
    const shown = moduleInfo.filter((x) => filter === 'all'
        || (filter === 'done' ? x.status === 'done' : x.status === 'active'));

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

            {/* The course: its numbers, its name, and how far along it is. */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                    <Pill><Layers size={12} /> {t('imnci_ui.courses.main.n_modules', '{{n}} modules', { n: modules.length })}</Pill>
                    <Pill><BookOpen size={12} /> {t('imnci_ui.courses.main.n_sections', '{{n}} sections', { n: courseSections.length })}</Pill>
                    {timeLeft > 0 && (
                        <Pill><Clock size={12} /> {doneCount
                            ? t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(timeLeft) })
                            : t('imnci_ui.courses.time.about', 'about {{time}}', { time: duration(timeLeft) })}</Pill>
                    )}
                    <Pill>{inOrder ? <Lock size={12} /> : <Unlock size={12} />} {inOrder
                        ? t('imnci_ui.courses.main.in_order', 'Sections open in order')
                        : t('imnci_ui.courses.main.any_order', 'Open in any order')}</Pill>
                </div>

                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">{openCourse.title}</h1>
                    {openCourse.description && (
                        <p className="text-slate-600 text-sm sm:text-base mt-1.5 max-w-2xl">{openCourse.description}</p>
                    )}
                </div>

                {courseSections.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-end justify-between gap-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl sm:text-5xl font-black tracking-tight text-sky-700 tabular-nums leading-none">{pct}%</span>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('imnci_ui.courses.look.pct_completed', 'completed')}
                                </span>
                            </div>
                            <div className="text-end">
                                <div className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                                    {t('imnci_ui.courses.main.n_of_total', '{{n}} of {{total}}', { n: doneCount, total: courseSections.length })}
                                </div>
                                <div className="text-xs text-slate-500">{t('imnci_ui.courses.look.sections_finished', 'Sections finished')}</div>
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-xs text-slate-600 mt-2 tabular-nums">
                            {t('imnci_ui.courses.look.modules_finished', '{{done}} of {{total}} modules finished', { done: modulesDone, total: modules.length })}
                        </div>
                    </div>
                )}

                {next ? (
                    <div className="rounded-xl bg-sky-700 text-white p-4 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-100 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                                {doneCount ? t('imnci_ui.courses.look.continue_label', 'Up next to continue') : t('imnci_ui.courses.look.start_label', 'Start here')}
                            </div>
                            <div className="font-bold text-base sm:text-lg truncate mt-0.5">{next.section.title}</div>
                            <div className="text-xs text-sky-100 truncate">
                                {t('imnci_ui.courses.look.module_n', 'Module {{n}}', { n: next.mi + 1 })}
                                {' · '}{t('imnci_ui.courses.look.section_n', 'Section {{n}}', { n: `${next.mi + 1}.${next.si + 1}` })}
                                {minutesById[next.section.id] > 0 && ` · ${duration(minutesById[next.section.id])}`}
                            </div>
                        </div>
                        <button onClick={() => openSection(next.section)}
                            className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-white text-sky-800 font-semibold text-sm hover:bg-sky-50">
                            {doneCount ? t('imnci_ui.courses.look.resume', 'Resume') : t('imnci_ui.courses.look.start', 'Start')}
                            <PlayCircle size={18} />
                        </button>
                    </div>
                ) : courseSections.length > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 flex items-center gap-3 font-semibold">
                        <Award size={22} className="shrink-0" />
                        {t('imnci_ui.courses.look.course_complete', 'Course complete')}
                        <span className="font-normal text-sm">· {t('imnci_ui.courses.main.all_finished', 'Every section finished')}</span>
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

            {!found && modules.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {[
                        { id: 'all', label: t('imnci_ui.courses.look.filter_all', 'All ({{n}})', { n: moduleInfo.length }) },
                        { id: 'active', label: t('imnci_ui.courses.look.filter_in_progress', 'In progress ({{n}})', { n: moduleInfo.filter((x) => x.status === 'active').length }) },
                        { id: 'done', label: t('imnci_ui.courses.look.filter_completed', 'Completed ({{n}})', { n: modulesDone }) },
                    ].map((f) => (
                        <button key={f.id} onClick={() => setFilter(f.id)}
                            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${filter === f.id
                                ? 'bg-sky-700 border-sky-700 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
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
            ) : shown.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm rounded-xl border border-dashed border-slate-300 bg-white">
                    {t('imnci_ui.courses.look.no_match_filter', 'No modules here yet.')}
                </div>
            ) : (
                <div className="space-y-3">
                    {shown.map((info) => (
                        <ModuleCard key={info.m.id} info={info} open={openIds.has(info.m.id) && !info.locked}
                            onToggle={() => toggleOpen(info.m.id)} saved={!!saved[info.m.id]}
                            isDone={isDone} openSection={openSection} />
                    ))}
                </div>
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

// One module in the accordion: its status, and when open, its sections.
function ModuleCard({ info, open, onToggle, saved, isDone, openSection }) {
    const { t } = useTranslation();
    const { duration, go, minutesById, minutesLeft, nextUp, sectionLocked } = useCourseScreen();
    const { m, i, secs, done, locked, status } = info;
    const mpct = secs.length ? Math.round((done / secs.length) * 100) : 0;
    const total = secs.reduce((n, x) => n + (minutesById[x.id] || 0), 0);

    const icon = {
        done: <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center shrink-0"><CheckCircle2 size={20} /></span>,
        active: <span className="w-10 h-10 rounded-full bg-sky-50 text-sky-700 grid place-items-center shrink-0"><RotateCw size={18} /></span>,
        locked: <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 grid place-items-center shrink-0"><Lock size={17} /></span>,
        idle: <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 grid place-items-center shrink-0 font-bold tabular-nums">{i + 1}</span>,
    }[status];
    const pill = {
        done: <Pill tone="done">{t('imnci_ui.courses.look.completed', 'Completed')}</Pill>,
        active: <Pill tone="active">{t('imnci_ui.courses.look.in_progress', 'In progress')}</Pill>,
        locked: <Pill tone="locked">{t('imnci_ui.courses.look.locked', 'Locked')}</Pill>,
        idle: null,
    }[status];

    return (
        <div className={`rounded-xl border bg-white overflow-hidden transition-shadow ${status === 'active'
            ? 'border-slate-200 border-s-4 border-s-sky-600 shadow-md'
            : locked ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
            <button type="button" onClick={onToggle} disabled={locked} aria-expanded={open}
                className="w-full text-start p-4 flex items-start gap-3 disabled:cursor-not-allowed">
                {icon}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {t('imnci_ui.courses.look.module_n', 'Module {{n}}', { n: i + 1 })}
                        </span>
                        {pill}
                    </div>
                    <div className={`font-bold text-base sm:text-lg leading-snug mt-0.5 ${locked ? 'text-slate-500' : 'text-slate-900'}`}>{m.title}</div>
                    <div className="text-sm text-slate-500 mt-0.5 tabular-nums">
                        {locked
                            ? t('imnci_ui.courses.look.requires_module', 'Requires completion of Module {{n}}', { n: i })
                            : t('imnci_ui.courses.look.n_of_m_sections', '{{done}} of {{total}} sections finished', { done, total: secs.length })}
                        {total > 0 && ` · ${duration(total)}`}
                    </div>
                    {saved && (
                        <div className="text-xs text-emerald-700 mt-1 inline-flex items-center gap-1">
                            <CloudDownload size={12} /> {t('imnci_ui.courses.offline.saved', 'Saved on this device')}
                        </div>
                    )}
                    {status === 'active' && secs.length > 0 && (
                        <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden max-w-xs">
                            <div className="h-full bg-sky-600 rounded-full" style={{ width: `${mpct}%` }} />
                        </div>
                    )}
                </div>
                {status === 'active' && <Pill tone="active" className="hidden sm:inline-flex">{mpct}%</Pill>}
                {!locked && <ChevronDown size={20} className={`text-slate-400 shrink-0 mt-2 transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-3 space-y-2">
                    {secs.length === 0 && (
                        <div className="text-sm text-slate-500 text-center py-4">{t('imnci_ui.courses.main.no_sections', 'No sections yet.')}</div>
                    )}
                    {secs.map((s, si) => {
                        const sDone = isDone(s);
                        const sLocked = sectionLocked(secs, si);
                        const current = !sDone && !sLocked && nextUp?.sectionId === s.id;
                        const label = t('imnci_ui.courses.look.section_n', 'Section {{n}}', { n: `${i + 1}.${si + 1}` });
                        const mins = minutesById[s.id];
                        if (current) {
                            return (
                                <div key={s.id} className="rounded-xl border border-sky-300 bg-white p-3 shadow-sm ring-2 ring-sky-100">
                                    <div className="flex items-start gap-3">
                                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 grid place-items-center shrink-0"><Play size={14} /></span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-500">{label}</span>
                                                <Pill tone="next">{t('imnci_ui.courses.look.current', 'Current')}</Pill>
                                            </div>
                                            <div className="font-bold text-slate-900 mt-0.5">{s.title}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 p-2 ps-3">
                                        <span className="flex-1 text-xs text-slate-600 inline-flex items-center gap-1.5">
                                            {mins > 0 && <><Clock size={13} /> {duration(mins)}</>}
                                        </span>
                                        <button onClick={() => openSection(s)}
                                            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                                            {done ? t('imnci_ui.courses.look.resume_section', 'Resume section') : t('imnci_ui.courses.look.start_section', 'Start section')}
                                            <ArrowRight size={16} className="rtl:rotate-180" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <button key={s.id} type="button" disabled={sLocked} onClick={() => openSection(s)}
                                className={`w-full text-start rounded-xl border p-3 flex items-center gap-3 transition-colors ${sLocked
                                    ? 'border-slate-200 bg-white/60 cursor-not-allowed'
                                    : 'border-slate-200 bg-white hover:border-sky-300'}`}>
                                <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${sDone
                                    ? 'bg-emerald-50 text-emerald-600' : sLocked ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                    {sDone ? <CheckCircle2 size={16} /> : sLocked ? <Lock size={13} /> : <BookOpen size={14} />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-500">{label}</span>
                                        {sDone && <Pill tone="done">{t('imnci_ui.courses.look.completed', 'Completed')}</Pill>}
                                    </span>
                                    <span className={`block font-semibold truncate ${sLocked ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}</span>
                                    {mins > 0 && (
                                        <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Clock size={11} /> {duration(mins)}</span>
                                    )}
                                </span>
                                {sLocked ? <Lock size={15} className="text-slate-300 shrink-0" /> : (
                                    <span className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold ${sDone
                                        ? 'bg-sky-50 text-sky-800' : 'border border-slate-300 text-slate-700'}`}>
                                        {sDone ? t('imnci_ui.courses.look.review', 'Review') : t('imnci_ui.courses.look.start', 'Start')}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 px-1">
                        <span className="text-xs text-slate-500">
                            {minutesLeft(secs) > 0 && t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(minutesLeft(secs)) })}
                        </span>
                        <button onClick={() => go({ module: m.id, section: null, tab: 'read' })}
                            className="text-sm font-semibold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1">
                            {t('imnci_ui.courses.look.open_module', 'Open module page')} <ArrowRight size={14} className="rtl:rotate-180" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
