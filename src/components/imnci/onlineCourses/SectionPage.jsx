// src/components/imnci/onlineCourses/SectionPage.jsx
//
// One section, on one page: its text, charts, videos and activities in the
// order they were written, the AI study helper, and Previous / Next within the
// module. There are no tabs to step through: a learner reads, watches and
// practises in one pass and then moves on to the next section.
import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Pencil, ArrowLeft, ArrowRight, Columns2, CheckCircle2, ZoomIn, ZoomOut, Clock, Trophy,
    ListChecks, ChevronDown, Circle,
} from 'lucide-react';
import { learnerContent } from '../book';
import { ContentBlocks, activityOutline, activityAnchor } from './blocks';
import { ActivityContext } from './interactive';
import { SectionTabEditor } from './SectionTabEditor';
import { SectionAiPanel } from './lazyParts';
import { useCourseScreen } from './screen';
import { LockedBanner } from './ui';

// Which activities of a section this learner has done, kept on the device: it
// is the learner's own running tally, not a record anyone else reads. It is
// kept per signed-in learner, so on a shared phone each sees only their own.
const storeKey = (uid, id) => `oc-activities-${uid || 'guest'}-${id}`;
function readDone(uid, id) {
    try { return new Set(JSON.parse(localStorage.getItem(storeKey(uid, id)) || '[]')); } catch { return new Set(); }
}
//
// The same tally is saved to the learner's account (`saved`, `save`), so a
// lesson started on one device carries on where it stopped on another. What
// is done is the two together: nothing done is ever taken away by a sync.
function useSectionActivities(uid, sectionId, saved, save) {
    // Everything here belongs to one learner and one lesson (`at`). On a move
    // to another lesson, the first render already reads the new lesson's
    // tally, never the last lesson's: activity keys come from block content,
    // so an identical activity in the next lesson must not count as done.
    const at = `${uid || 'guest'}|${sectionId}`;
    const [local, setLocal] = useState(() => ({ at, set: readDone(uid, sectionId) }));
    const localSet = local.at === at ? local.set : readDone(uid, sectionId);
    const done = useMemo(() => new Set([...localSet, ...(saved || [])]), [localSet, saved]);
    // Kept in a ref as well, so two marks in the same tap (the first-try
    // record and "done") both land instead of the second overwriting the first.
    const latest = useRef({ at, set: done });
    if (latest.current.at !== at) latest.current = { at, set: done };
    else if ([...done].some((k) => !latest.current.set.has(k))) latest.current = { at, set: new Set([...latest.current.set, ...done]) };
    const markDone = useCallback((key) => {
        const cur = latest.current.at === at ? latest.current.set : new Set();
        if (cur.has(key)) return;
        const next = new Set(cur).add(key);
        latest.current = { at, set: next };
        try { localStorage.setItem(storeKey(uid, sectionId), JSON.stringify([...next])); } catch { /* private mode */ }
        setLocal({ at, set: next });
        save?.(sectionId, [...next]);
    }, [at, uid, sectionId, save]);
    const value = useMemo(() => ({ isDone: (k) => done.has(k) || latest.current.set.has(k), markDone }), [done, markDone]);
    return [done, value];
}

const ACTIVITY_NAMES = {
    question: ['imnci_ui.courses.activity.kind_question', 'Question'],
    video: ['imnci_ui.courses.activity.kind_video', 'Video'],
    exercise: ['imnci_ui.courses.activity.kind_exercise', 'Exercise'],
    reveal: ['imnci_ui.courses.activity.kind_reveal', 'Think first'],
    flip: ['imnci_ui.courses.activity.kind_flip', 'Flip cards'],
    sort: ['imnci_ui.courses.activity.kind_sort', 'Sorting'],
    steps: ['imnci_ui.courses.activity.kind_steps', 'Step by step'],
    story: ['imnci_ui.courses.activity.kind_story', 'Case story'],
    growthchart: ['imnci_ui.courses.activity.kind_growthchart', 'Plot on the chart'],
};
const goToActivity = (key) => document.getElementById(activityAnchor(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// The lesson's own checklist: every activity in it, ticked as it is done. It
// tells the learner what the lesson asks of them before they start, where
// they stopped when they come back, and what is still to do before the next
// lesson opens. Touching a line goes to that activity.
function LessonChecklist({ outline, doneKeys }) {
    const { t } = useTranslation();
    const left = outline.filter((a) => !doneKeys.has(a.key));
    // Folded by default: the one-line progress bar is enough until the
    // learner wants the list. Open, it lists every activity.
    const [open, setOpen] = useState(false);
    const pct = Math.round(((outline.length - left.length) / outline.length) * 100);
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50">
            <button onClick={() => setOpen(!open)} aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3 text-start">
                <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 text-white ${left.length ? 'bg-sky-700' : 'bg-emerald-600'}`}>
                    {left.length ? <ListChecks size={18} /> : <Trophy size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">
                        {left.length
                            ? t('imnci_ui.courses.activity.checklist_title', 'Your progress in this lesson: {{n}} of {{total}} done', { n: outline.length - left.length, total: outline.length })
                            : t('imnci_ui.courses.activity.checklist_done', 'Every activity in this lesson is done')}
                    </span>
                    <span className="mt-1.5 block h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <span className={`block h-full rounded-full transition-all ${left.length ? 'bg-sky-600' : 'bg-emerald-600'}`} style={{ width: `${pct}%` }} />
                    </span>
                </span>
                <ChevronDown size={18} className={`text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ol className="px-2 pb-2 space-y-0.5">
                    {outline.map((a) => {
                        const done = doneKeys.has(a.key);
                        const [k, name] = ACTIVITY_NAMES[a.type] || ['imnci_ui.courses.activity.kind_other', 'Activity'];
                        return (
                            <li key={a.key}>
                                <button onClick={() => goToActivity(a.key)}
                                    className="w-full flex items-center gap-2.5 px-2 py-2 min-h-[44px] rounded-lg text-start text-sm hover:bg-white">
                                    {done
                                        ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                        : <Circle size={18} className="text-slate-400 shrink-0" />}
                                    <span className={`min-w-0 flex-1 ${done ? 'text-slate-500' : 'text-slate-800'}`}>
                                        <span className="font-semibold">{t(k, name)}</span>
                                        {a.label && <span className="text-slate-500"> · {a.label}</span>}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

export function SectionPage() {
    const { t } = useTranslation();
    const {
        back, compare, duration, editingTab, fontScale, go, inOrder, isAdmin,
        minutesById, moduleLocked, modules, nextUp, openModule, openSection, progress, reload, sectionLocked, sectionsByModule,
        saveActivities, setCompare, setEditingTab, setScale, toggleComplete, user,
    } = useCourseScreen();

    const isDone = !!progress.completed?.[openSection.id];
    const [resumeShown, setResumeShown] = useState(null);
    const content = learnerContent(openSection);
    const [doneKeys, activityValue] = useSectionActivities(user?.uid, openSection.id, progress.activities?.[openSection.id], saveActivities);
    const outline = useMemo(() => activityOutline(content), [openSection]); // eslint-disable-line react-hooks/exhaustive-deps
    const keys = outline.map((a) => a.key);
    const activitiesDone = keys.filter((k) => doneKeys.has(k)).length;
    const firstLeft = outline.find((a) => !doneKeys.has(a.key));
    // A lesson is finished by doing it, not by pressing a button: in a course
    // read in order, it can be completed once every activity in it is done.
    // Someone managing the course is not held to that.
    const canComplete = isAdmin || !inOrder || !firstLeft;
    // Revising the converted text means holding it against the page it came
    // from. The captured pages make that possible without leaving the app.
    const pages = content.filter((b) => b.type === 'page');
    const canCompare = pages.length > 0 && pages.length < content.length;
    // Revision is done section by section, so it is worth being able to
    // move to the next one without returning to the list and losing the
    // tab and the compare view each time.
    const siblings = sectionsByModule[openSection.moduleId || '__none__'] || [];
    const here = siblings.findIndex((x) => x.id === openSection.id);
    const goTo = (sec) => { if (sec) { go({ section: sec.id, tab: 'read' }); window.scrollTo?.({ top: 0 }); } };
    // Going on is what completion unlocks. Going back is always allowed —
    // a learner who wants to re-read something should never be stopped.
    const nextAllowed = isAdmin || isDone || !inOrder;

    const moduleIndex = modules.findIndex((m) => m.id === openSection.moduleId);
    const prev = here > 0 ? siblings[here - 1] : null;
    const next = here >= 0 && here < siblings.length - 1 ? siblings[here + 1] : null;
    const number = (i) => (moduleIndex >= 0 ? `${moduleIndex + 1}.${i + 1}` : `${i + 1}`);
    // One button does what the learner came to do: finish this section and
    // go on. Marking complete is what unlocks the next one, so it is done
    // first and the move follows straight after.
    const completeAndContinue = async () => {
        if (!canComplete) { goToActivity(firstLeft.key); return; }
        if (!isDone) await toggleComplete(openSection);
        if (next) goTo(next);
    };
    const mins = minutesById[openSection.id];
    // A lesson opened by its link before the ones before it are done.
    const locked = !isAdmin && ((moduleIndex >= 0 && !!moduleLocked?.(moduleIndex)) || (here >= 0 && !!sectionLocked?.(siblings, here)));
    const iconBtn = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 disabled:opacity-40';

    if (locked) {
        return (
            <div className="max-w-3xl mx-auto space-y-4">
                <button onClick={back}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {openModule?.title || t('imnci_ui.courses.main.back', 'Back')}
                </button>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-400 leading-tight">{openSection.title}</h1>
                <LockedBanner
                    title={t('imnci_ui.courses.look.lesson_locked', 'This lesson is locked')}
                    reason={t('imnci_ui.courses.look.finish_earlier', 'Finish the lessons before it first. Lessons open in order.')}
                    action={nextUp && (
                        <button onClick={() => go({ module: nextUp.moduleId, section: nextUp.sectionId, tab: 'read' })}
                            className="mt-1 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                            {t('imnci_ui.courses.look.go_to_current', 'Go to your current lesson')} <ArrowRight size={16} className="rtl:rotate-180" />
                        </button>
                    )} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="space-y-4 pb-4">
                <button onClick={back}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {openModule?.title || t('imnci_ui.courses.main.back', 'Back')}
                </button>

                {/* Where this lesson sits, its name and the reading tools, in two lines. */}
                <header className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 text-xs font-semibold text-slate-500 truncate">
                            {moduleIndex >= 0 && here >= 0 && t('imnci_ui.courses.look.module_section_of', 'Module {{m}} · Section {{n}} of {{total}}', { m: moduleIndex + 1, n: here + 1, total: siblings.length })}
                            {mins > 0 && <> · <Clock size={12} className="inline -mt-0.5" /> {duration(mins)}</>}
                        </span>
                        {!editingTab && (
                            <span className="flex items-center gap-1 shrink-0">
                                {isAdmin && (
                                    <button className={iconBtn} onClick={() => setEditingTab('all')} title={t('imnci_ui.courses.main.edit_section', 'Edit section')}>
                                        <Pencil size={15} />
                                    </button>
                                )}
                                {canCompare && (
                                    <button className={`${iconBtn} ${compare ? '!bg-sky-700 !text-white !border-sky-700' : ''}`} onClick={() => setCompare(!compare)}
                                        title={t('imnci_ui.courses.main.compare_title', 'Show the book page beside the converted text')}>
                                        <Columns2 size={15} />
                                    </button>
                                )}
                                <button className={iconBtn} onClick={() => setScale(fontScale - 0.1)} disabled={fontScale <= 0.8}
                                    title={t('imnci_ui.courses.main.smaller_text', 'Smaller text')}><ZoomOut size={15} /></button>
                                <button className={iconBtn} onClick={() => setScale(fontScale + 0.1)} disabled={fontScale >= 2}
                                    title={t('imnci_ui.courses.main.larger_text', 'Larger text')}><ZoomIn size={15} /></button>
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight flex items-start gap-2">
                        <span className="min-w-0 flex-1">{openSection.title}</span>
                        {isDone && <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-1" aria-label={t('imnci_ui.courses.main.completed', 'Completed')} />}
                    </h1>
                    {siblings.length > 1 && here >= 0 && (
                        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-600 rounded-full transition-all"
                                style={{ width: `${((here + (isDone ? 1 : 0.5)) / siblings.length) * 100}%` }} />
                        </div>
                    )}
                </header>

                {!editingTab && !isDone && activitiesDone > 0 && firstLeft && resumeShown !== openSection.id && (
                    // Back in a lesson started earlier: offer to go straight to
                    // the first activity not done yet, as "return to your last
                    // location" does, rather than make the learner scroll for it.
                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex flex-wrap items-center gap-3">
                        <span className="text-sm text-sky-900 flex-1 min-w-[12rem]">
                            {t('imnci_ui.courses.practice.resume_text', 'You stopped after {{n}} of {{total}} activities. Continue where you stopped?', { n: activitiesDone, total: keys.length })}
                        </span>
                        <button onClick={() => { setResumeShown(openSection.id); goToActivity(firstLeft.key); }}
                            className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                            {t('imnci_ui.courses.practice.resume_go', 'Continue')} <ArrowRight size={16} className="rtl:rotate-180" />
                        </button>
                        <button onClick={() => setResumeShown(openSection.id)} className="text-xs text-slate-500 underline underline-offset-2">
                            {t('imnci_ui.courses.practice.resume_top', 'Start from the top')}
                        </button>
                    </div>
                )}
                {!editingTab && outline.length > 0 && <LessonChecklist key={openSection.id} outline={outline} doneKeys={doneKeys} />}

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 space-y-4">
                    {editingTab ? (
                        <SectionTabEditor
                            section={openSection} tab="all"
                            onCancel={() => setEditingTab(null)}
                            onSaved={() => { setEditingTab(null); reload(); }}
                        />
                    ) : compare && canCompare ? (
                        // Side by side on a wide screen, stacked on a phone: the
                        // point is to check one against the other, and on a small
                        // screen two narrow columns would defeat that.
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="lg:max-h-[38rem] lg:overflow-y-auto pe-1">
                                <div className="text-xs font-semibold text-slate-500 mb-2">{t('imnci_ui.courses.main.converted_text', 'Converted text')}</div>
                                <ActivityContext.Provider value={activityValue}>
                                    <ContentBlocks key={openSection.id} blocks={content.filter((b) => b.type !== 'page')} scale={fontScale} activities />
                                </ActivityContext.Provider>
                            </div>
                            <div className="lg:max-h-[38rem] lg:overflow-y-auto ps-1 border-s">
                                <div className="text-xs font-semibold text-slate-500 mb-2">{t('imnci_ui.courses.main.the_book', 'The book')}</div>
                                <ContentBlocks key={openSection.id} blocks={pages} />
                            </div>
                        </div>
                    ) : content.length > 0 ? (
                        <ActivityContext.Provider value={activityValue}>
                            <ContentBlocks key={openSection.id} blocks={content} scale={fontScale} activities />
                        </ActivityContext.Provider>
                    ) : (
                        <div className="text-sm text-slate-500 py-12 text-center border border-dashed rounded-lg">
                            {t('imnci_ui.courses.main.nothing_in_section', 'Nothing in this section yet.')}
                            {isAdmin && (
                                <div className="mt-1 text-xs">{t('imnci_ui.courses.main.use_edit_section', 'Use Edit section, above, to write it.')}</div>
                            )}
                        </div>
                    )}

                    {!editingTab && keys.length > 0 && activitiesDone >= keys.length && !isDone && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0"><Trophy size={20} /></span>
                            <div className="text-sm text-emerald-900">
                                <div className="font-bold">{t('imnci_ui.courses.activity.all_done', 'Well done: every activity in this section is done.')}</div>
                                <div>{next ? t('imnci_ui.courses.activity.go_on', 'Complete the section to go on to the next one.') : t('imnci_ui.courses.activity.finish', 'Mark the section complete to finish the module.')}</div>
                            </div>
                        </div>
                    )}

                    {openSection.bookFromPage && (
                        <div className="text-xs text-slate-400 pt-2 border-t">
                            {t('imnci_ui.courses.main.from_book_pages', 'From the module book, pages {{from}}–{{to}}.', { from: openSection.bookFromPage, to: openSection.bookToPage })}
                        </div>
                    )}

                    {isDone && (
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                <CheckCircle2 size={14} /> {t('imnci_ui.courses.main.completed_section', 'You have completed this section.')}
                            </span>
                            <button onClick={() => toggleComplete(openSection)} disabled={!user?.uid}
                                className="text-slate-500 hover:text-slate-700 underline underline-offset-2">
                                {t('imnci_ui.courses.look.mark_not_done', 'Mark as not done')}
                            </button>
                        </div>
                    )}
                </div>

                {!editingTab && (
                    <Suspense fallback={null}>
                        <SectionAiPanel section={openSection} canRefresh={isAdmin} />
                    </Suspense>
                )}
            </div>

            {/* Back and on, pinned above the phone's bottom bar so finishing a
                section never means scrolling to find the button. */}
            {!editingTab && (
                <div className="sticky bottom-[var(--bottom-nav,0px)] z-20 -mx-3 sm:mx-0 sm:mb-3 sm:rounded-xl sm:border border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] bg-white/95 backdrop-blur px-3 sm:px-4 py-3">
                    {!isDone && !canComplete ? (
                        <div className="text-xs text-amber-700 text-center mb-2">
                            {t('imnci_ui.courses.activity.left_to_do', 'Activities still to do before this lesson is complete: {{n}}', { n: keys.length - activitiesDone })}
                        </div>
                    ) : !nextAllowed && next && (
                        <div className="text-xs text-amber-700 text-center mb-2">
                            {t('imnci_ui.courses.look.finish_to_open', 'Finish this section to open the next')}
                        </div>
                    )}
                    {!isDone && isAdmin && firstLeft && (
                        <div className="text-xs text-slate-500 text-center mb-2">
                            {t('imnci_ui.courses.activity.manager_skip', 'You are managing this course, so you can go on. A learner must do every activity first.')}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button disabled={!prev} onClick={() => goTo(prev)}
                            title={prev?.title}
                            className="min-w-0 sm:max-w-[45%] inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-700">
                            <ArrowLeft size={18} className="rtl:rotate-180 shrink-0" />
                            <span className="truncate hidden sm:inline">
                                {prev ? `${number(here - 1)} ${prev.title}` : t('imnci_ui.courses.main.previous', 'Previous')}
                            </span>
                            <span className="sm:hidden">{prev ? number(here - 1) : ''}</span>
                        </button>
                        <span className="flex-1" />
                        {isDone ? (
                            next ? (
                                <button onClick={() => goTo(next)}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                                    {t('imnci_ui.courses.look.next_section', 'Next section')}
                                    <ArrowRight size={18} className="rtl:rotate-180" />
                                </button>
                            ) : (
                                <button onClick={back}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                                    <CheckCircle2 size={18} /> {t('imnci_ui.courses.look.back_to_course', 'Back to the course')}
                                </button>
                            )
                        ) : (<>
                            {nextAllowed && next && (
                                <button onClick={() => goTo(next)} title={t('imnci_ui.courses.look.next_section', 'Next section')}
                                    className="inline-flex items-center justify-center min-h-[44px] px-3 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-700">
                                    <ArrowRight size={18} className="rtl:rotate-180" />
                                </button>
                            )}
                            {canComplete ? (
                                <button onClick={completeAndContinue} disabled={!user?.uid}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:bg-slate-200 disabled:text-slate-400">
                                    {next ? t('imnci_ui.courses.look.complete_continue', 'Complete & continue') : t('imnci_ui.courses.main.mark_complete', 'Mark complete')}
                                    {next ? <ArrowRight size={18} className="rtl:rotate-180" /> : <CheckCircle2 size={18} />}
                                </button>
                            ) : (
                                <button onClick={completeAndContinue}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700">
                                    <ListChecks size={18} /> {t('imnci_ui.courses.activity.go_to_next', 'Go to the next activity')}
                                </button>
                            )}
                        </>)}
                    </div>
                </div>
            )}
        </div>
    );
}
