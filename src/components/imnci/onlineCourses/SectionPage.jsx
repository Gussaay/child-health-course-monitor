// src/components/imnci/onlineCourses/SectionPage.jsx
//
// One section: its Read, See and Practise tabs, the AI study helper, and
// Previous / Next within the module.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Pencil, ArrowLeft, ArrowRight, Columns2, CheckCircle2, Circle, ZoomIn, ZoomOut, Lock, Clock,
} from 'lucide-react';
import { Button } from '../../CommonComponents';
import { SECTION_TABS, tabContent } from '../book';
import { TAB_ICONS, ContentBlocks } from './blocks';
import { SectionTabEditor } from './SectionTabEditor';
import { SectionAiPanel } from './lazyParts';
import { useCourseScreen } from './screen';

export function SectionPage() {
    const { t } = useTranslation();
    const {
        back, compare, duration, editingTab, fontScale, go, inOrder, isAdmin,
        minutesById, openModule, openSection, progress, reload, sectionTab, sectionsByModule,
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

    return (
        <div className="space-y-4 max-w-5xl mx-auto">
            <button onClick={back}
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                <ArrowLeft size={15} className="rtl:rotate-180" /> {openModule?.title || t('imnci_ui.courses.main.back', 'Back')}
            </button>

            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
                    <div className="text-xs font-medium text-sky-700 flex flex-wrap gap-x-2">
                        {openModule?.title && <span>{openModule.title}</span>}
                        {minutesById[openSection.id] > 0 && (
                            <span className="text-slate-500 font-normal inline-flex items-center gap-1">
                                <Clock size={12} /> {t('imnci_ui.courses.time.about', 'about {{time}}', { time: duration(minutesById[openSection.id]) })}
                            </span>
                        )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 flex items-start gap-2">
                        <span className="min-w-0 flex-1">{openSection.title}</span>
                        {isDone && <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-1" aria-label={t('imnci_ui.courses.main.completed', 'Completed')} />}
                    </h2>
                </div>

                {/* Equal thirds, so the three tabs fit a phone without
                    scrolling sideways. */}
                <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
                    {SECTION_TABS.map((tb) => {
                        const Icon = TAB_ICONS[tb.id];
                        const n = tabContent(openSection, tb.id).length;
                        const active = sectionTab === tb.id;
                        return (
                            <button key={tb.id} disabled={!!editingTab && editingTab !== tb.id}
                                onClick={() => { setSectionTab(tb.id); setCompare(false); }}
                                className={`relative flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
                                    active ? 'text-sky-800 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                <Icon size={15} className="shrink-0" />
                                {tabName(tb)}
                                {n > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        active ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                                )}
                                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-600" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-5 space-y-4">
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
                                        className="text-xs text-slate-500 w-12 hover:text-sky-700">
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
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                        {isDone ? t('imnci_ui.courses.main.completed_section', 'You have completed this section.') : t('imnci_ui.courses.main.mark_when_done', 'Mark this section when you are done.')}
                    </span>
                    <Button onClick={() => toggleComplete(openSection)}
                        variant={isDone ? 'secondary' : 'primary'} disabled={!user?.uid}>
                        {isDone ? <><CheckCircle2 size={16} /> {t('imnci_ui.courses.main.completed', 'Completed')}</> : <><Circle size={16} /> {t('imnci_ui.courses.main.mark_complete', 'Mark complete')}</>}
                    </Button>
                </div>
            </div>

            {!editingTab && (
                <Suspense fallback={null}>
                    <SectionAiPanel section={openSection} canRefresh={isAdmin} />
                </Suspense>
            )}

            {siblings.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                    <button disabled={here <= 0} onClick={() => goTo(siblings[here - 1])}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-700">
                        <ArrowLeft size={18} className="rtl:rotate-180" />
                        <span className="hidden sm:inline">{t('imnci_ui.courses.main.previous', 'Previous')}</span>
                    </button>

                    <span className="text-xs text-slate-400 text-center">
                        {t('imnci_ui.courses.main.n_of_total', '{{n}} of {{total}}', { n: here + 1, total: siblings.length })}
                        {!nextAllowed && here < siblings.length - 1 && (
                            <span className="block text-amber-700">
                                {t('imnci_ui.courses.main.mark_to_go_on', 'Mark this section complete to go on')}
                            </span>
                        )}
                    </span>

                    <button disabled={here < 0 || here >= siblings.length - 1 || !nextAllowed}
                        onClick={() => goTo(siblings[here + 1])}
                        title={nextAllowed ? t('imnci_ui.courses.main.next_section', 'The next section') : t('imnci_ui.courses.main.finish_first', 'Finish this section first')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400">
                        <span className="hidden sm:inline">{t('imnci_ui.courses.main.next', 'Next')}</span>
                        {nextAllowed ? <ArrowRight size={18} className="rtl:rotate-180" /> : <Lock size={16} />}
                    </button>
                </div>
            )}

        </div>
    );
}
