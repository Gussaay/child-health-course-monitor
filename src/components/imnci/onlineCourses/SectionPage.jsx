// src/components/imnci/onlineCourses/SectionPage.jsx
//
// One section: its Read, See and Practise tabs, the AI study helper, and
// Previous / Next within the module.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Pencil, ArrowLeft, ArrowRight, Columns2, CheckCircle2, ZoomIn, ZoomOut, Clock,
} from 'lucide-react';
import { Button } from '../../CommonComponents';
import { SECTION_TABS, tabContent } from '../book';
import { TAB_ICONS, ContentBlocks } from './blocks';
import { SectionTabEditor } from './SectionTabEditor';
import { SectionAiPanel } from './lazyParts';
import { useCourseScreen } from './screen';
import { Pill } from './ui';

export function SectionPage() {
    const { t } = useTranslation();
    const {
        back, compare, duration, editingTab, fontScale, go, inOrder, isAdmin,
        minutesById, modules, openModule, openSection, progress, reload, sectionTab, sectionsByModule,
        setCompare, setEditingTab, setScale, setSectionTab, tabName, toggleComplete, user,
    } = useCourseScreen();

    const isDone = !!progress.completed?.[openSection.id];
    const content = tabContent(openSection, sectionTab);
    const meta = SECTION_TABS.find((x) => x.id === sectionTab) || SECTION_TABS[0];
    // Revising the converted text means holding it against the page it came
    // from. The captured pages make that possible without leaving the app.
    const pages = tabContent(openSection, 'see').filter((b) => b.type === 'page');
    const canCompare = sectionTab === 'read' && pages.length > 0;
    // Revision is done section by section, so it is worth being able to
    // move to the next one without returning to the list and losing the
    // tab and the compare view each time.
    const siblings = sectionsByModule[openSection.moduleId || '__none__'] || [];
    const here = siblings.findIndex((x) => x.id === openSection.id);
    const goTo = (sec) => { if (sec) go({ section: sec.id, tab: 'read' }); };
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
        if (!isDone) await toggleComplete(openSection);
        if (next) goTo(next);
    };
    const mins = minutesById[openSection.id];

    return (
        <div className="max-w-3xl mx-auto">
            <div className="space-y-4 pb-4">
                <button onClick={back}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {openModule?.title || t('imnci_ui.courses.main.back', 'Back')}
                </button>

                {/* Where this section sits, its name, and how long it takes. */}
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {moduleIndex >= 0 && here >= 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                {t('imnci_ui.courses.look.module_section_of', 'Module {{m}} · Section {{n}} of {{total}}', { m: moduleIndex + 1, n: here + 1, total: siblings.length })}
                            </span>
                        ) : <span />}
                        {mins > 0 && (
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                                <Clock size={14} /> {t('imnci_ui.courses.time.about', 'about {{time}}', { time: duration(mins) })}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight flex items-start gap-2">
                        <span className="min-w-0 flex-1">{openSection.title}</span>
                        {isDone && <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-1" aria-label={t('imnci_ui.courses.main.completed', 'Completed')} />}
                    </h1>
                    <div className="flex flex-wrap gap-1.5">
                        {SECTION_TABS.map((tb) => {
                            const n = tabContent(openSection, tb.id).length;
                            const Icon = TAB_ICONS[tb.id];
                            return n > 0 ? <Pill key={tb.id}><Icon size={12} /> {tabName(tb)} · {n}</Pill> : null;
                        })}
                        {isDone && <Pill tone="done"><CheckCircle2 size={12} /> {t('imnci_ui.courses.look.completed', 'Completed')}</Pill>}
                    </div>
                    {siblings.length > 1 && here >= 0 && (
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-600 rounded-full transition-all"
                                style={{ width: `${((here + (isDone ? 1 : 0.5)) / siblings.length) * 100}%` }} />
                        </div>
                    )}
                </header>

                {/* Read, See and Practise as a segmented control: equal thirds
                    so the three fit a phone without scrolling sideways. */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                    {SECTION_TABS.map((tb) => {
                        const Icon = TAB_ICONS[tb.id];
                        const n = tabContent(openSection, tb.id).length;
                        const active = sectionTab === tb.id;
                        return (
                            <button key={tb.id} disabled={!!editingTab && editingTab !== tb.id}
                                onClick={() => { setSectionTab(tb.id); setCompare(false); }}
                                className={`flex flex-col items-center justify-center min-h-[44px] px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${
                                    active ? 'bg-white text-sky-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                <span className="inline-flex items-center gap-1.5"><Icon size={15} className="shrink-0" />{tabName(tb)}</span>
                                <span className={`text-[11px] font-medium tabular-nums ${active ? 'text-sky-600' : 'text-slate-400'}`}>
                                    {n > 0 ? n : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">{t(`imnci_ui.courses.tab_hints.${meta.id}`, meta.hint)}</p>
                        <div className="flex items-center gap-1">
                            {isAdmin && !editingTab && (
                                <Button variant="secondary" className="px-2 py-1 h-auto"
                                    onClick={() => setEditingTab(sectionTab)}>
                                    <Pencil size={14} /> {t('imnci_ui.courses.main.edit_tab', 'Edit {{tab}}', { tab: tabName(meta) })}
                                </Button>
                            )}
                            {canCompare && !editingTab && (
                                <Button variant={compare ? 'primary' : 'secondary'} className="px-2 py-1 h-auto"
                                    onClick={() => setCompare(!compare)}
                                    title={t('imnci_ui.courses.main.compare_title', 'Show the book page beside the converted text')}>
                                    <Columns2 size={14} /> {t('imnci_ui.courses.main.compare', 'Compare')}
                                </Button>
                            )}
                            {sectionTab === 'read' && !editingTab && (
                                <>
                                    <Button variant="secondary" onClick={() => setScale(fontScale - 0.1)}
                                        disabled={fontScale <= 0.8} className="px-2 py-1 h-auto"><ZoomOut size={16} /></Button>
                                    <button onClick={() => setScale(1)} title={t('imnci_ui.courses.main.reset_size', 'Reset the reading size')}
                                        className="text-xs text-slate-500 w-12 hover:text-sky-700 tabular-nums">
                                        {Math.round(fontScale * 100)}%
                                    </button>
                                    <Button variant="secondary" onClick={() => setScale(fontScale + 0.1)}
                                        disabled={fontScale >= 2} className="px-2 py-1 h-auto"><ZoomIn size={16} /></Button>
                                </>
                            )}
                        </div>
                    </div>

                    {editingTab ? (
                        <SectionTabEditor
                            section={openSection} tab={editingTab}
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
                                <ContentBlocks blocks={content} scale={fontScale} />
                            </div>
                            <div className="lg:max-h-[38rem] lg:overflow-y-auto ps-1 border-s">
                                <div className="text-xs font-semibold text-slate-500 mb-2">{t('imnci_ui.courses.main.the_book', 'The book')}</div>
                                <ContentBlocks blocks={pages} />
                            </div>
                        </div>
                    ) : content.length > 0 ? (
                        <ContentBlocks blocks={content} scale={sectionTab === 'read' ? fontScale : 1} />
                    ) : (
                        <div className="text-sm text-slate-500 py-12 text-center border border-dashed rounded-lg">
                            {t('imnci_ui.courses.main.nothing_in_tab', 'Nothing in {{tab}} for this section yet.', { tab: tabName(meta) })}
                            {isAdmin && (
                                <div className="mt-1 text-xs">{t('imnci_ui.courses.main.use_edit_tab', 'Use Edit {{tab}}, above, to write it.', { tab: tabName(meta) })}</div>
                            )}
                        </div>
                    )}

                    {sectionTab === 'read' && openSection.bookFromPage && (
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
                    {!nextAllowed && next && (
                        <div className="text-xs text-amber-700 text-center mb-2">
                            {t('imnci_ui.courses.look.finish_to_open', 'Finish this section to open the next')}
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
                            <button onClick={completeAndContinue} disabled={!user?.uid}
                                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:bg-slate-200 disabled:text-slate-400">
                                {next ? t('imnci_ui.courses.look.complete_continue', 'Complete & continue') : t('imnci_ui.courses.main.mark_complete', 'Mark complete')}
                                {next ? <ArrowRight size={18} className="rtl:rotate-180" /> : <CheckCircle2 size={18} />}
                            </button>
                        </>)}
                    </div>
                </div>
            )}
        </div>
    );
}
