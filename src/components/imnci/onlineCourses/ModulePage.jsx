// src/components/imnci/onlineCourses/ModulePage.jsx
//
// The sections in one module, in order, with what each holds and how long
// it takes.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ArrowLeft, CheckCircle2, Wand2, Lock, Clock, RefreshCw, FileDown } from 'lucide-react';
import { Button } from '../../CommonComponents';
import { SECTION_TABS, tabContent } from '../book';
import { TAB_ICONS } from './blocks';
import { ConvertBookModal } from './ConvertBookModal';
import { ItemModal } from './ItemModals';
import { OfflineSave } from './OfflineSave';
import { useCourseScreen } from './screen';
import { useImnci } from '../shared';
import { notify } from '../../dialogs';
import { shareFile } from '../../../utils/sharePdf';
import { buildPackage, packageFileName } from './coursePackage';

export function ModulePage() {
    const { t } = useTranslation();
    const {
        back, convertOpen, duration, go, isAdmin, itemModal, minutesById,
        minutesLeft, modules, openCourse, openCourseId, openModule, progress, reload,
        removeItem, resync, sectionLocked, sectionsByModule, setConvertOpen, setEditingTab,
        setItemModal, syncing, tabName,
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
    const doneHere = secs.filter((s) => progress.completed?.[s.id]).length;
    const moduleNo = modules.findIndex((m) => m.id === openModule.id) + 1;

    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={back}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-700">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {openCourse.title}
                </button>
                {isAdmin && (
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {moduleNo > 0 && <>{t('imnci_ui.courses.look.module_n', 'Module {{n}}', { n: moduleNo })} · </>}
                        <span className="normal-case tracking-normal font-semibold text-sky-700">{openCourse.title}</span>
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
                    {secs.length > 0 && (
                        <div className="mt-3">
                            <OfflineSave moduleId={openModule.id} sections={secs} />
                        </div>
                    )}
                </div>

                {secs.length === 0 ? (
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
                            const filled = SECTION_TABS
                                .map((tb) => ({ tb, n: tabContent(s, tb.id).length }))
                                .filter((x) => x.n > 0);
                            return (
                                <li key={s.id} className={`flex items-center gap-3 px-4 sm:px-6 py-3.5 transition-colors ${
                                    locked ? 'bg-slate-50' : 'hover:bg-sky-50/60'}`}>
                                    <span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                                        done ? 'bg-emerald-50 text-emerald-600'
                                            : locked ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                        {done ? <CheckCircle2 size={15} /> : locked ? <Lock size={13} /> : i + 1}
                                    </span>
                                    <button className="flex-1 text-start min-w-0 disabled:cursor-not-allowed"
                                        disabled={locked}
                                        title={locked ? t('imnci_ui.courses.main.finish_before', 'Finish the section before this one first') : undefined}
                                        onClick={() => {
                                            go({ section: s.id, tab: 'read' });
                                            setEditingTab(null);
                                        }}>
                                        {moduleNo > 0 && (
                                            <div className="text-xs font-semibold text-slate-500">
                                                {t('imnci_ui.courses.look.section_n', 'Section {{n}}', { n: `${moduleNo}.${i + 1}` })}
                                            </div>
                                        )}
                                        <div className={`font-semibold truncate ${locked ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}</div>
                                        <div className="text-xs text-slate-500 flex gap-2 flex-wrap mt-0.5">
                                            {locked ? <span>{t('imnci_ui.courses.main.finish_previous', 'Finish the previous section first')}</span> : (<>
                                                {filled.map(({ tb, n }) => (
                                                    <span key={tb.id}>{tabName(tb)} {n}</span>
                                                ))}
                                                {filled.length === 0 && <span>{t('imnci_ui.courses.main.empty', 'empty')}</span>}
                                            </>)}
                                            {minutesById[s.id] > 0 && (
                                                <span className="inline-flex items-center gap-1"><Clock size={11} /> {duration(minutesById[s.id])}</span>
                                            )}
                                        </div>
                                    </button>
                                    {isAdmin && (
                                        <span className="flex gap-1 shrink-0">
                                            {SECTION_TABS.map((tb) => {
                                                const Icon = TAB_ICONS[tb.id];
                                                return (
                                                    <button key={tb.id} title={t('imnci_ui.courses.main.edit_tab', 'Edit {{tab}}', { tab: tabName(tb) })}
                                                        onClick={() => {
                                                            go({ section: s.id, tab: tb.id });
                                                            setEditingTab(tb.id, s.id);
                                                        }}
                                                        className="p-1.5 border rounded text-slate-500 hover:bg-slate-50 hover:text-sky-700">
                                                        <Icon size={14} />
                                                    </button>
                                                );
                                            })}
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
