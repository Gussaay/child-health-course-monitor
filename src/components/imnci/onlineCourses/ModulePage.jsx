// src/components/imnci/onlineCourses/ModulePage.jsx
//
// The sections in one module, in order, with what each holds and how long
// it takes. A locked lesson keeps its normal row, with a red "Locked" badge.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, Wand2, ChevronRight, Clock, RefreshCw, FileDown, Award, Share2 } from 'lucide-react';
import { Button, IS_NATIVE, useInPageBack } from '../../CommonComponents';
import { useFormTitle } from '../../../utils/pageChrome';
import { learnerContent } from '../book';
import { activityKeys } from './activityKeys';
import { ConvertBookModal } from './ConvertBookModal';
import { ItemModal } from './ItemModals';
import { OfflineSave } from './OfflineSave';
import { useCourseScreen } from './screen';
import { LockedBadge, LockedBanner, Pill } from './ui';
import { useImnci } from '../shared';
import { notify } from '../../dialogs';
import { shareFile } from '../../../utils/sharePdf';
import { buildPackage, packageFileName } from './coursePackage';
import { shareCourseLink } from '../../../utils/courseShare';

export function ModulePage() {
    const { t } = useTranslation();
    const {
        back, convertOpen, duration, go, isAdmin, itemModal, minutesById, moduleLocked,
        minutesLeft, modules, openCourse, openCourseId, openModule, progress, reload,
        removeItem, resync, sectionLocked, sectionsByModule, setConvertOpen, setEditingTab,
        setItemModal, syncing,
    } = useCourseScreen();

    const { exercises, loadExercises } = useImnci();
    const secs = sectionsByModule[openModule.id] || [];

    // The whole module as a course file: its sections in order, every block,
    // and the exercises they link to. Importing it rebuilds the module.
    const downloadFile = async () => {
        try {
            const all = exercises || (await loadExercises?.()) || [];
            const pkg = buildPackage({ course: openCourse, modules: [openModule], sectionsByModule: { [openModule.id]: secs }, exercises: all });
            const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
            await shareFile(blob, packageFileName(openModule.title), { title: openModule.title });
        } catch (e) {
            console.error('Could not make the module file:', e);
            notify(t('imnci_ui.courses.export.failed', 'Could not make the file. {{msg}}', { msg: e?.message || '' }), 'error');
        }
    };
    // A link that opens this module alone, to share on WhatsApp, SMS or e-mail.
    const shareModule = async () => {
        const res = await shareCourseLink(openCourse, {
            moduleId: openModule.id, title: openModule.title,
            text: t('imnci_ui.courses.share.module_message', 'Online course module: {{title}} ({{course}})', { title: openModule.title, course: openCourse.title }),
        });
        if (res === 'copied') notify(t('imnci_ui.courses.share.module_copied', 'Module link copied. Paste it in WhatsApp, SMS or e-mail.'), 'success');
        else if (res === 'failed') notify(t('imnci_ui.courses.share.failed', 'Could not share the link.'), 'error');
    };
    const doneHere = secs.filter((s) => progress.completed?.[s.id]).length;
    const moduleNo = modules.findIndex((m) => m.id === openModule.id) + 1;
    // A module opened by its link before the one before it is finished.
    const locked = moduleNo > 1 && !!moduleLocked?.(moduleNo - 1);
    // The lesson to do next: the first one not finished.
    const firstOpen = secs.findIndex((s) => !progress.completed?.[s.id]);

    // In the Android app the top bar names the course and its arrow steps back.
    useFormTitle(openCourse.title, '', IS_NATIVE);
    useInPageBack(back, IS_NATIVE);

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            {(!IS_NATIVE || isAdmin) && <div className="flex flex-wrap items-center justify-between gap-2">
                {!IS_NATIVE ? (
                    <button onClick={back}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                        <ArrowLeft size={15} className="rtl:rotate-180" /> {openCourse.title}
                    </button>
                ) : <span />}
                <div className="flex flex-wrap gap-2">
                    {/* Sharing is for those who manage the course; a draft's link would open nothing. */}
                    {isAdmin && openCourse.isPublished && (
                        <Button variant="secondary" onClick={shareModule} data-testid="share-module">
                            <Share2 size={16} /> {t('imnci_ui.courses.share.button', 'Share link')}
                        </Button>
                    )}
                {isAdmin && (
                    <>
                        <Button variant="secondary" onClick={downloadFile}
                            title={t('imnci_ui.courses.export.title', 'Save this module, its sections and its exercises as a course file that can be imported again')}>
                            <FileDown size={16} /> {t('imnci_ui.courses.export.download', 'Download file')}
                        </Button>
                        <Button variant="secondary" onClick={() => setConvertOpen(true)}>
                            <Wand2 size={16} /> {t('imnci_ui.courses.main.convert_book', 'Convert a book')}
                        </Button>
                        <Button variant="secondary" onClick={() => setItemModal({ kind: 'module', item: openModule })}>
                            <Pencil size={16} /> {t('imnci_ui.courses.item_modal.module', 'Module')}
                        </Button>
                        <Button onClick={() => setItemModal({ kind: 'section' })}>
                            <Plus size={16} /> {t('imnci_ui.courses.item_modal.add_section', 'Add section')}
                        </Button>
                    </>
                )}
                </div>
            </div>}

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {moduleNo > 0 && t('imnci_ui.courses.look.module_n', 'Module {{n}}', { n: moduleNo })}
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1">{openModule.title}</h2>
                    <div className="text-sm text-slate-500 mt-1 tabular-nums">
                        {t('imnci_ui.courses.main.sections_complete', '{{n}} sections · {{done}} complete', { n: secs.length, done: doneHere })}
                        {minutesLeft(secs) > 0 && ' · ' + t('imnci_ui.courses.time.left', 'about {{time}} left', { time: duration(minutesLeft(secs)) })}
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden max-w-md">
                        <div className="h-full bg-sky-600 rounded-full transition-all"
                            style={{ width: `${secs.length ? (doneHere / secs.length) * 100 : 0}%` }} />
                    </div>
                    {secs.length > 0 && doneHere === secs.length && (
                        // The module's badge, earned by finishing every lesson in it.
                        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-300 px-3 py-2.5 flex items-center gap-3" data-testid="module-badge">
                            <span className="w-10 h-10 rounded-full bg-amber-400 text-amber-950 grid place-items-center shrink-0"><Award size={20} /></span>
                            <span className="text-sm text-amber-950">
                                <span className="block font-bold">{t('imnci_ui.courses.practice.badge_title', 'Module {{n}} badge earned', { n: moduleNo })}</span>
                                <span className="block">{t('imnci_ui.courses.practice.badge_text', 'You finished every lesson of this module.')}</span>
                            </span>
                        </div>
                    )}
                    {secs.length > 0 && (
                        <div className="mt-3">
                            <OfflineSave moduleId={openModule.id} sections={secs} />
                        </div>
                    )}
                </div>

                {locked ? (
                    <div className="p-4">
                        <LockedBanner
                            title={t('imnci_ui.courses.look.module_locked', 'This module is locked')}
                            reason={t('imnci_ui.courses.look.requires_module', 'Requires completion of Module {{n}}', { n: moduleNo - 1 })}
                            action={(
                                <button onClick={() => go({ module: modules[moduleNo - 2].id, section: null, tab: 'read' })}
                                    className="mt-1 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800">
                                    {t('imnci_ui.courses.look.go_to_module', 'Go to Module {{n}}', { n: moduleNo - 1 })}
                                </button>
                            )} />
                    </div>
                ) : secs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm space-y-2">
                        <div>{syncing ? t('imnci_ui.courses.main.checking_sections', 'Checking for sections…') : t('imnci_ui.courses.main.no_sections', 'No sections yet.')}</div>
                        {isAdmin && !syncing && (
                            <div className="text-xs">{t('imnci_ui.courses.main.convert_to_create', 'Convert the module book to create them.')}</div>
                        )}
                        {!syncing && (
                            <Button variant="secondary" onClick={resync}>
                                <RefreshCw size={15} /> {t('imnci_ui.courses.main.check_again', 'Check again')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <ol className="divide-y divide-slate-100">
                        {secs.map((s, i) => {
                            const done = !!progress.completed?.[s.id];
                            const locked = sectionLocked(secs, i);
                            const all = learnerContent(s);
                            const actKeys = activityKeys(all);
                            const activities = actKeys.length;
                            const saved = progress.activities?.[s.id] || [];
                            const activitiesDone = done ? activities : actKeys.filter((k) => saved.includes(k)).length;
                            const started = !done && activitiesDone > 0;
                            const current = !done && !locked && i === firstOpen;
                            return (
                                <li key={s.id} data-locked={locked ? 'true' : 'false'}
                                    className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors ${
                                    locked ? '' : 'hover:bg-sky-50/60'} ${current ? 'border-s-4 border-s-sky-600' : ''}`}>
                                    <span className={`w-10 h-10 rounded-full grid place-items-center text-sm font-bold shrink-0 tabular-nums ${
                                        done ? 'bg-emerald-50 text-emerald-600'
                                            : current ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                        {done ? <CheckCircle2 size={20} /> : i + 1}
                                    </span>
                                    <button className="flex-1 text-start min-w-0 disabled:cursor-not-allowed"
                                        disabled={locked}
                                        title={locked ? t('imnci_ui.courses.main.finish_before', 'Finish the section before this one first') : undefined}
                                        onClick={() => {
                                            go({ section: s.id, tab: 'read' });
                                            setEditingTab(null);
                                        }}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {moduleNo > 0 && (
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                    {t('imnci_ui.courses.look.section_n', 'Section {{n}}', { n: `${moduleNo}.${i + 1}` })}
                                                </span>
                                            )}
                                            {locked && <LockedBadge>{t('imnci_ui.courses.look.locked', 'Locked')}</LockedBadge>}
                                            {done && <Pill tone="done">{t('imnci_ui.courses.look.completed', 'Completed')}</Pill>}
                                            {current && <Pill tone="active">{started ? t('imnci_ui.courses.look.in_progress', 'In progress') : t('imnci_ui.courses.look.up_next', 'Up next')}</Pill>}
                                        </div>
                                        <div className="font-bold text-base text-slate-900 leading-snug mt-0.5">{s.title}</div>
                                        <div className="text-xs text-slate-500 flex gap-2 flex-wrap mt-0.5">
                                            {locked ? (
                                                <span className="font-semibold text-slate-900">{t('imnci_ui.courses.main.finish_previous', 'Finish the previous section first')}</span>
                                            ) : (<>
                                                {activities > 0 && (
                                                    <span className={started ? 'font-semibold text-sky-700' : undefined}>
                                                        {started || done
                                                            ? t('imnci_ui.courses.activity.n_of_done', '{{n}} of {{total}} activities done', { n: activitiesDone, total: activities })
                                                            : t('imnci_ui.courses.activity.n_activities', '{{n}} activities', { n: activities })}
                                                    </span>
                                                )}
                                                {all.length === 0 && <span>{t('imnci_ui.courses.main.empty', 'empty')}</span>}
                                            </>)}
                                            {minutesById[s.id] > 0 && (
                                                <span className="inline-flex items-center gap-1"><Clock size={11} /> {duration(minutesById[s.id])}</span>
                                            )}
                                        </div>
                                    </button>
                                    {!isAdmin && !locked && <ChevronRight size={20} className="text-slate-400 shrink-0 rtl:rotate-180" />}
                                    {isAdmin && (
                                        <span className="flex gap-1 shrink-0">
                                            <button title={t('imnci_ui.courses.main.edit_section', 'Edit section')}
                                                onClick={() => {
                                                    go({ section: s.id, tab: 'read' });
                                                    setEditingTab('all', s.id);
                                                }}
                                                className="p-1.5 border rounded text-slate-500 hover:bg-slate-50 hover:text-sky-700">
                                                <Pencil size={14} />
                                            </button>
                                            <Button variant="danger" className="px-2 py-1 h-auto"
                                                onClick={() => removeItem(s)}><Trash2 size={13} /></Button>
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>

            <ItemModal
                isOpen={!!itemModal} onClose={() => setItemModal(null)}
                item={itemModal?.item} kind={itemModal?.kind || 'section'}
                courseId={openCourseId} modules={modules} onSaved={reload}
            />
            <ConvertBookModal
                isOpen={convertOpen} onClose={() => setConvertOpen(false)}
                courseId={openCourseId} modules={modules}
                existingFor={(mid) => sectionsByModule[mid] || []}
                onRefresh={reload}
            />
        </div>
    );
}
